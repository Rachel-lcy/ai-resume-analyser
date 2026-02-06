import { NextResponse } from "next/server";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

import { normalizeText } from "../analyze/normalize";
import { SKILL_BANK } from "../analyze/skillBank";
import { extractSkills } from "../analyze/extract";
import { computeMatch } from "../analyze/score";
import { buildReport } from "../analyze/report";

export const runtime = "nodejs";

/* ---------------- Utils ---------------- */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampText(str = "", maxLen = 12000) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function validateInput({ jobDescription, resumeText }) {
  const jd = (jobDescription || "").trim();
  const rt = (resumeText || "").trim();
  if (!jd) return { ok: false, message: "Job description is required." };
  if (!rt) return { ok: false, message: "Unable to extract text from the PDF." };
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

/* ---------------- PDF legacy ---------------- */
async function extractTextFromPdfArrayBuffer(pdfjsLib, arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8, disableWorker: true });
  const pdf = await loadingTask.promise;

  let extracted = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .join(" ");
    extracted += pageText + "\n";
  }
  return extracted;
}

/* ---------------- Bedrock ---------------- */
function buildAiPrompt({ report, resumeText, jobDescription }) {
  const resumeSummary = clampText(resumeText, 1400);
  const jdSummary = clampText(jobDescription, 1100);

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
  const region = (process.env.AWS_REGION || "us-east-1").trim();
  const modelId = (process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0").trim();

  // 🔎 排查用：看看你到底读到了什么
  console.log("[bedrock] region =", JSON.stringify(region));
  console.log("[bedrock] modelId =", JSON.stringify(modelId));

  const bedrock = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1", });

  const prompt = buildAiPrompt({ report, resumeText, jobDescription });

  const cmd = new ConverseCommand({
    modelId,
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: {
      maxTokens: 700,
      temperature: 0.3,
      topP: 0.9,
    },
  });

  const resp = await bedrock.send(cmd);
  console.log("[bedrock] success");

  const content = resp?.output?.message?.content ?? [];
  const text =
    content.find((c) => typeof c?.text === "string")?.text ?? "";

  // 先尝试直接 JSON.parse
  try {
    return JSON.parse(text);
  } catch {
    // 再尝试从混杂输出里挖 JSON
    const extracted = extractJsonFromText(text);
    if (extracted) return extracted;
    throw new Error("Bedrock returned non-JSON output.");
  }
}

function applyAiToPhase4Report(phase4Report, aiJson) {
  const next = { ...phase4Report };

  next.meta = {
    ...next.meta,
    model: aiJson ? "phase5-bedrock-haiku + phase4-rule-based-v1" : next.meta?.model,
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
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const formData = await req.formData();
    const file = formData.get("resume");
    const jobDescriptionRaw = formData.get("jobDescription");
    const simulateRaw = formData.get("simulate");
    const delayMsRaw = formData.get("delayMs");

    const jobDescription = clampText((jobDescriptionRaw || "").toString(), 4000);
    const simulate = (simulateRaw || "").toString() || undefined;

    const delayMsParsed = Number(delayMsRaw);
    const delayMs = Number.isFinite(delayMsParsed) ? delayMsParsed : 900;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: { code: "FILE_REQUIRED", message: "Resume PDF is required." } },
        { status: 400 }
      );
    }
    if (typeof file === "string" || !file.name) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_FILE", message: "Invalid file upload." } },
        { status: 400 }
      );
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json(
        { ok: false, error: { code: "PDF_ONLY", message: "Please upload a PDF file." } },
        { status: 400 }
      );
    }

    await sleep(delayMs);

    let resumeText = "";
    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawText = await extractTextFromPdfArrayBuffer(pdfjsLib, arrayBuffer);
      resumeText = clampText(normalizeText(rawText || ""), 12000);
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

    const validation = validateInput({ jobDescription, resumeText });
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: validation.message } },
        { status: 400 }
      );
    }

    const shouldFail = simulate === "fail" ? true : simulate === "success" ? false : false;
    if (shouldFail) {
      return NextResponse.json(
        { ok: false, error: { code: "ANALYSIS_FAILED", message: "We couldn't analyze your resume at this time. Please try again." } },
        { status: 500 }
      );
    }

    // -------- Phase 4 (rule-based) --------
    const resumeSkills = extractSkills(resumeText, SKILL_BANK);
    const jdSkills = extractSkills(jobDescription, SKILL_BANK);
    const match = computeMatch(resumeSkills, jdSkills);

    const phase4Report = buildReport({
      resumeText,
      jobDescription,
      resumeSkills,
      jdSkills,
      match,
    });

    // -------- Phase 5 (Bedrock AI) --------
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
      finalReport = phase4Report; // AI 失败也不影响主流程
    }

    return NextResponse.json(
      {
        ok: true,
        report: finalReport,
        meta: {
          aiStatus,
          aiError,
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
  });
}
