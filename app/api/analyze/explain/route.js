import { NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const runtime = "nodejs";

/** ---------------------------
 * Utils
 * -------------------------- */
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function clampArray(arr, max = 3) {
  return safeArray(arr).slice(0, max);
}

function clampWords(text = "", maxWords = 140) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(text || "").trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

function validateInput(payload) {
  const jobMatchScore = Number(payload?.jobMatchScore);
  const resumeStrengthScore = Number(payload?.resumeStrengthScore);

  if (!Number.isFinite(jobMatchScore)) {
    return { ok: false, message: "jobMatchScore is required and must be a number." };
  }
  if (!Number.isFinite(resumeStrengthScore)) {
    return { ok: false, message: "resumeStrengthScore is required and must be a number." };
  }
  return { ok: true };
}

function computeBreakdown(data) {
  const matched = safeArray(data?.matched);
  const missing = safeArray(data?.missing);
  const jdTopSkills = safeArray(data?.jdTopSkills);

  const coverage = typeof data?.coverage === "number" ? data.coverage : null;

  const jdCount =
    matched.length + missing.length > 0
      ? matched.length + missing.length
      : Math.max(jdTopSkills.length, 0);

  const coveragePct =
    typeof coverage === "number"
      ? Math.round(coverage * 100)
      : (jdCount > 0 ? Math.round((matched.length / jdCount) * 100) : null);

  // ✅ Resume Strength breakdown
  const resumeSkillCount = Number.isFinite(Number(data?.resumeSkillCount))
    ? Number(data.resumeSkillCount)
    : null;

  const usedCount = resumeSkillCount === null ? null : Math.min(resumeSkillCount, 20);
  const computedStrength = usedCount === null ? null : Math.min(55 + usedCount * 2, 100);

  return {
    jobMatchScore: Number(data?.jobMatchScore) || 0,
    resumeStrengthScore: Number(data?.resumeStrengthScore) || 0,
    coveragePct,
    matchedCount: matched.length,
    jdCount,
    formula: "Job Match Score = 50 + coverage*50 (coverage = matched_jd_skills / total_jd_skills)",

    resumeSkillCount,
    strengthCap: 20,
    usedCount,
    computedStrength,
    strengthFormula: "Resume Strength Score = 55 + min(resume_skill_count, 20)*2",
  };
}

function buildFallbackExplain(data) {
  const matched = safeArray(data?.matched);
  const missing = safeArray(data?.missing);
  const jdTopSkills = safeArray(data?.jdTopSkills);

  const breakdown = computeBreakdown(data);
  const scoreMeta = report?.scoreMeta ?? null;


  const topMatched = clampArray(matched, 3);
  const topMissing = clampArray(missing, 3);

  const missingFromTop = topMissing.length ? topMissing : clampArray(jdTopSkills, 2);

  const actions = [
    {
      title: missingFromTop[0]
        ? `Add 1 bullet proving ${missingFromTop[0]}`
        : "Add 1 bullet proving a missing core skill",
      why: "Increases coverage and adds evidence, which raises Job Match Score.",
      impact: "+5 to +10",
    },
    {
      title: missingFromTop[1]
        ? `Add a small project using ${missingFromTop[1]}`
        : "Add a small project showing a missing skill",
      why: "Adds measurable proof and improves both alignment and strength.",
      impact: "+3 to +8",
    },
  ].filter(Boolean);

  return {
    breakdown: {
      jobMatchScore: breakdown.jobMatchScore,
      coveragePct: breakdown.coveragePct ?? 0,
      matchedCount: breakdown.matchedCount,
      jdCount: breakdown.jdCount,
      formula: breakdown.formula,

      resumeStrengthScore: breakdown.resumeStrengthScore,
      resumeSkillCount: breakdown.resumeSkillCount,
      usedCount: breakdown.usedCount,
      computedStrength: breakdown.computedStrength,
      strengthFormula: breakdown.strengthFormula,
    },
    drivers: {
      topMatched: topMatched.length ? topMatched : ["Not enough data"],
      topMissing: missingFromTop.length ? missingFromTop : ["Not enough data"],
    },
    actions,
  };
}

function buildPrompt(data) {
  const breakdown = computeBreakdown(data);
  const matched = safeArray(data?.matched);
  const missing = safeArray(data?.missing);
  const jdTopSkills = safeArray(data?.jdTopSkills);

  return `You are explaining a scoring algorithm to a user.

Context:
- Job Match Score (0-100) = 50 + coverage*50, where coverage = matched_jd_skills / total_jd_skills.
- Resume Strength Score (0-100) = 55 + min(resume_skill_count, 20)*2.

Input:
- jobMatchScore: ${breakdown.jobMatchScore}
- resumeStrengthScore: ${breakdown.resumeStrengthScore}
- coveragePct: ${breakdown.coveragePct ?? "N/A"}
- matchedCount: ${matched.length}
- missingCount: ${missing.length}
- matched skills: ${matched.join(", ") || "N/A"}
- missing skills: ${missing.join(", ") || "N/A"}
- top job skills: ${jdTopSkills.join(", ") || "N/A"}
- resumeSkillCount: ${breakdown.resumeSkillCount ?? "N/A"}
- usedCount (cap at 20): ${breakdown.usedCount ?? "N/A"}
- computedStrength (from formula): ${breakdown.computedStrength ?? "N/A"}

Return STRICT JSON only with keys:
{
  "breakdown": {
    "jobMatchScore": number,
    "coveragePct": number,
    "matchedCount": number,
    "jdCount": number,
    "formula": string,

    "resumeStrengthScore": number,
    "resumeSkillCount": number,
    "usedCount": number,
    "computedStrength": number,
    "strengthFormula": string
  },
  "drivers": { "topMatched": string[], "topMissing": string[] },
  "actions": [ { "title": string, "why": string, "impact": string } ]
}

Rules:
- Focus on WHY the score is this number and WHAT changes will increase the score fastest.
- Keep arrays short (max 3).
- Output JSON only. No markdown. No extra keys.`;
}

function tryParseJsonStrict(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const jsonStr = t.slice(first, last + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function parseClaudeText(json) {
  if (json && Array.isArray(json.content)) {
    const t = json.content.find((c) => c?.type === "text")?.text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  if (typeof json?.completion === "string" && json.completion.trim()) return json.completion.trim();
  if (typeof json?.outputText === "string" && json.outputText.trim()) return json.outputText.trim();
  if (typeof json?.generation === "string" && json.generation.trim()) return json.generation.trim();
  return "";
}

async function callBedrockClaude(prompt) {
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) throw new Error("Missing env BEDROCK_MODEL_ID");

  const client = new BedrockRuntimeClient({ region });

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 420,
    temperature: 0.2,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  });

  const resp = await client.send(command);
  const raw = new TextDecoder("utf-8").decode(resp.body);
  const json = JSON.parse(raw);
  return parseClaudeText(json);
}

function normalizeAiJson(aiJson, fallbackData) {
  const fb = buildFallbackExplain(fallbackData);

  const b = aiJson?.breakdown || {};
  const d = aiJson?.drivers || {};
  const actions = safeArray(aiJson?.actions);

  const out = {
    breakdown: {
      jobMatchScore: Number(b.jobMatchScore ?? fb.breakdown.jobMatchScore) || fb.breakdown.jobMatchScore,
      coveragePct: Number(b.coveragePct ?? fb.breakdown.coveragePct) || fb.breakdown.coveragePct,
      matchedCount: Number(b.matchedCount ?? fb.breakdown.matchedCount) || fb.breakdown.matchedCount,
      jdCount: Number(b.jdCount ?? fb.breakdown.jdCount) || fb.breakdown.jdCount,
      formula: String(b.formula || fb.breakdown.formula),

      // ✅ 关键：别再丢掉这些字段
      resumeStrengthScore:
        Number(b.resumeStrengthScore ?? fb.breakdown.resumeStrengthScore) || fb.breakdown.resumeStrengthScore,
      resumeSkillCount:
        Number.isFinite(Number(b.resumeSkillCount)) ? Number(b.resumeSkillCount) : fb.breakdown.resumeSkillCount,
      usedCount:
        Number.isFinite(Number(b.usedCount)) ? Number(b.usedCount) : fb.breakdown.usedCount,
      computedStrength:
        Number.isFinite(Number(b.computedStrength)) ? Number(b.computedStrength) : fb.breakdown.computedStrength,
      strengthFormula: String(b.strengthFormula || fb.breakdown.strengthFormula),
    },
    drivers: {
      topMatched: clampArray(d.topMatched || fb.drivers.topMatched, 3),
      topMissing: clampArray(d.topMissing || fb.drivers.topMissing, 3),
    },
    actions: clampArray(actions.length ? actions : fb.actions, 3).map((a) => ({
      title: clampWords(a?.title || "", 18) || "Improve one missing core skill",
      why: clampWords(a?.why || "", 28) || "Improves coverage and adds evidence.",
      impact: String(a?.impact || "+3 to +10"),
    })),
  };

  return out;
}

/** ---------------------------
 * Route
 * -------------------------- */
export async function POST(req) {
  try {
    // ✅ 防止 “Unexpected end of JSON input”
    const rawText = await req.text();
    if (!rawText) {
      return NextResponse.json({ error: "Empty request body." }, { status: 400 });
    }

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const v = validateInput(data);
    if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

    const prompt = buildPrompt(data);

    let finalJson = null;
    try {
      const text = await callBedrockClaude(prompt);
      const aiJson = tryParseJsonStrict(text);
      finalJson = normalizeAiJson(aiJson, data);
    } catch {
      finalJson = buildFallbackExplain(data);
    }

    return NextResponse.json(finalJson);
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
