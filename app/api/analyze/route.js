import { NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
// import pdfParse from "pdf-parse";

import { normalizeText } from "../analyze/normalize";
import { SKILL_BANK } from "../analyze/skillBank";
import { extractSkills } from "../analyze/extract";
import { computeMatch } from "../analyze/score";
import { buildReport } from "../analyze/report";

export const runtime = "nodejs";

/* ---------------- Constants ---------------- */
const REGION = (process.env.AWS_REGION || "us-east-1").trim();
const MODEL_ID = (
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0"
).trim();
const MAX_RESUME_TEXT_LEN = 12000;
const MAX_JOB_DESCRIPTION_LEN = 4000;
const MAX_RESUME_SUMMARY_LEN = 1400;
const MAX_JD_SUMMARY_LEN = 1100;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const bedrock = new BedrockRuntimeClient({ region: REGION });

/* ---------------- Utils ---------------- */
function clampText(str = "", maxLen = 12000) {
  if (!str) return "";
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function validateInput({ jobDescription, resumeText }) {
  const jd = (jobDescription || "").trim();
  const rt = (resumeText || "").trim();

  if (!jd) {
    return { ok: false, message: "Job description is required." };
  }

  if (!rt) {
    return { ok: false, message: "Unable to extract text from the PDF." };
  }

  return { ok: true };
}

function extractJsonFromText(text = "") {
  if (typeof text !== "string") return null;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) return null;

  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

/* ---------------- PDF ---------------- */
async function extractTextFromPdfArrayBuffer(arrayBuffer) {

  // const buffer = Buffer.from(arrayBuffer);
  // const data = await pdf(buffer);
  // return data?.text || "";
  try {
    const pdfParse = require("pdf-parse");

    const buffer = Buffer.from(arrayBuffer);
    const data = await pdfParse(buffer);

    console.log("PDF pages:", data?.numpages);
    console.log("PDF text length:", data?.text?.length || 0);

    if (!data?.text || data.text.trim().length < 20) {
      throw new Error("PDF contains no extractable text.");
    }

    return data?.text || "";
  } catch (error) {
    console.error("pdf-parse error:", error);
    throw error;
  }


}

/* ---------------- Bedrock ---------------- */
function buildAiPrompt({ report, resumeText, jobDescription }) {
  const resumeSummary = clampText(resumeText, MAX_RESUME_SUMMARY_LEN);
  const jdSummary = clampText(jobDescription, MAX_JD_SUMMARY_LEN);

  const matched = report?.skills?.matchedSkills ?? [];
  const missing = report?.skills?.missingSkills ?? [];
  const coverage = report?.skills?.coverage ?? null;
  const matchScore = report?.scores?.jobMatchScore ?? null;

  return `
Return ONLY valid JSON. No markdown. No extra text.

Schema:
{
  "insights": { "doingWell": string[3], "fallsShort": string[3] },
  "improvements": { "recommended": string[5] },
  "interviewQuestions": string[3]
}

Rules:
- Align to the job description.
- Do NOT invent skills not supported by resume summary.
- Each bullet <= 160 chars.
- Make suggestions actionable and ATS-friendly.

Inputs:
resumeSummary: ${resumeSummary}
jobDescriptionSummary: ${jdSummary}
coverage: ${coverage}
ruleMatchScore: ${matchScore}
matchedSkills: ${JSON.stringify(matched)}
missingSkills: ${JSON.stringify(missing)}
`.trim();
}

async function callHaikuAndGetJson({ report, resumeText, jobDescription }) {
  console.log("[bedrock] region =", JSON.stringify(REGION));
  console.log("[bedrock] modelId =", JSON.stringify(MODEL_ID));

  const prompt = buildAiPrompt({ report, resumeText, jobDescription });

  const cmd = new ConverseCommand({
    modelId: MODEL_ID,
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: {
      maxTokens: 650,
      temperature: 0.3,
      topP: 0.9,
    },
  });

  const resp = await bedrock.send(cmd);
  console.log("[bedrock] call ok");

  const content = resp?.output?.message?.content ?? [];
  const text = content.find((c) => typeof c?.text === "string")?.text ?? "";

  try {
    return JSON.parse(text);
  } catch {
    const extracted = extractJsonFromText(text);
    if (extracted) return extracted;
    throw new Error("Bedrock returned non-JSON output.");
  }
}

function applyAiToPhase4Report(phase4Report, aiJson) {
  const next = { ...phase4Report };

  next.meta = {
    ...next.meta,
    model: aiJson
      ? "phase5-bedrock-haiku + phase4-rule-based-v1"
      : next.meta?.model,
  };

  if (aiJson?.insights?.doingWell && aiJson?.insights?.fallsShort) {
    next.insights = {
      ...next.insights,
      doingWell: aiJson.insights.doingWell,
      fallsShort: aiJson.insights.fallsShort,
    };
  }

  if (aiJson?.improvements?.recommended) {
    next.improvements = {
      ...next.improvements,
      recommended: aiJson.improvements.recommended,
    };
  }

  if (Array.isArray(aiJson?.interviewQuestions)) {
    next.interviewQuestions = aiJson.interviewQuestions;
  }

  return next;
}

/* ---------------- API ---------------- */
export async function POST(req) {
  try {
    // 1) Access control
    const accessCookie = req.cookies.get("demo_access")?.value;

    if (accessCookie !== "granted") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Unauthorized. Please enter a valid access code first.",
          },
        },
        { status: 401 }
      );
    }

    // 2) Read form data
    const formData = await req.formData();
    const file = formData.get("resume");
    const jobDescriptionRaw = formData.get("jobDescription");

    const jobDescription = clampText(
      normalizeText((jobDescriptionRaw || "").toString()),
      MAX_JOB_DESCRIPTION_LEN
    );

    // 3) Validate file
    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FILE_REQUIRED",
            message: "Resume PDF is required.",
          },
        },
        { status: 400 }
      );
    }

    if (typeof file === "string" || !file.name) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_FILE",
            message: "Invalid file upload.",
          },
        },
        { status: 400 }
      );
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PDF_ONLY",
            message: "Please upload a PDF file.",
          },
        },
        { status: 400 }
      );
    }

    if (typeof file.size === "number" && file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "Please upload a PDF smaller than 5MB.",
          },
        },
        { status: 413 }
      );
    }

    // 4) Extract resume text
    let resumeText = "";

    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawText = await extractTextFromPdfArrayBuffer(arrayBuffer);
      resumeText = clampText(
        normalizeText(rawText || ""),
        MAX_RESUME_TEXT_LEN
      );
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PDF_PARSE_FAILED",
            message: "Failed to extract text from the PDF.",
            detail: String(e?.message || e),
          },
        },
        { status: 422 }
      );
    }

    console.log("resumeText:", resumeText);

    // 5) Validate input
    const validation = validateInput({ jobDescription, resumeText });
    console.log("validation:", validation);

    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.message,
          },
        },
        { status: 400 }
      );
    }

    // 6) Phase 4 (rule-based)
    const resumeSkills = extractSkills(resumeText, SKILL_BANK);
    const jdSkills = extractSkills(jobDescription, SKILL_BANK);

    const match = computeMatch({
      resumeSkills,
      jdSkills,
      resumeText,
    });

    console.log("jdSkills:", jdSkills);
    console.log("jdSkills length:", jdSkills.length);
    console.log("resumeSkills length:", resumeSkills.length);
    console.log(
      "coverage:",
      match?.coverage,
      "jobMatchScore:",
      match?.scores?.jobMatchScore
    );
    console.log("strength breakdown meta:", match?.meta);

    const phase4Report = buildReport({
      resumeText,
      jobDescription,
      resumeSkills,
      jdSkills,
      match,
    });

    phase4Report.meta = {
      ...(phase4Report.meta || {}),
      scoreMeta: match?.meta || null,
    };

    // 7) Phase 5 (Bedrock AI)
    let finalReport = phase4Report;
    let aiStatus = "skipped";
    let aiError = null;

    try {
      const aiJson = await callHaikuAndGetJson({
        report: phase4Report,
        resumeText,
        jobDescription,
      });

      finalReport = applyAiToPhase4Report(phase4Report, aiJson);
      aiStatus = "ok";
    } catch (e) {
      aiStatus = "failed";
      aiError = String(e?.message || e);
      console.log("[bedrock] failed:", aiError);
      finalReport = phase4Report;
    }

    // 8) Success response
    return NextResponse.json(
      {
        ok: true,
        report: finalReport,
        meta: {
          aiStatus,
          aiError,
          region: REGION,
          modelId: MODEL_ID,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: "Unexpected server error.",
          detail: String(err?.message || err),
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "analyze-mvp",
    version: "phase5-bedrock-haiku+phase4",
    region: REGION,
    modelId: MODEL_ID,
  });
}