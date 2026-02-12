import { NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

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

  // 估算 JD 技能总数：优先用 matched+missing，否则用 jdTopSkills
  const jdCount =
    matched.length + missing.length > 0
      ? matched.length + missing.length
      : Math.max(jdTopSkills.length, 0);

  const coveragePct =
    typeof coverage === "number"
      ? Math.round(coverage * 100)
      : (jdCount > 0 ? Math.round((matched.length / jdCount) * 100) : null);

  return {
    jobMatchScore: Number(data?.jobMatchScore) || 0,
    resumeStrengthScore: Number(data?.resumeStrengthScore) || 0,
    coveragePct,
    matchedCount: matched.length,
    jdCount,
    formula: "Job Match Score = 50 + coverage*50 (coverage = matched_jd_skills / total_jd_skills)",
    strengthFormula: "Resume Strength Score = 55 + min(resume_skill_count, 20)*2",
  };
}

function buildFallbackExplain(data) {
  const matched = safeArray(data?.matched);
  const missing = safeArray(data?.missing);
  const jdTopSkills = safeArray(data?.jdTopSkills);

  const breakdown = computeBreakdown(data);

  const topMatched = clampArray(matched, 3);
  const topMissing = clampArray(missing, 3);

  // 如果 matched/missing 为空，试着从 jdTopSkills 推断缺口
  const missingFromTop =
    topMissing.length ? topMissing : clampArray(jdTopSkills, 2);

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
      resumeStrengthScore: breakdown.resumeStrengthScore,
      coveragePct: breakdown.coveragePct ?? 0,
      matchedCount: breakdown.matchedCount,
      jdCount: breakdown.jdCount,
      formula: breakdown.formula,
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
- Job Match Score (0-100) is computed as: 50 + coverage*50, where coverage = matched_jd_skills / total_jd_skills.
- Resume Strength Score (0-100) is computed as: 55 + min(resume_skill_count, 20)*2.

Input:
- jobMatchScore: ${breakdown.jobMatchScore}
- resumeStrengthScore: ${breakdown.resumeStrengthScore}
- coveragePct: ${breakdown.coveragePct ?? "N/A"}
- matchedCount: ${matched.length}
- missingCount: ${missing.length}
- matched skills: ${matched.join(", ") || "N/A"}
- missing skills: ${missing.join(", ") || "N/A"}
- top job skills: ${jdTopSkills.join(", ") || "N/A"}

Return STRICT JSON with keys:
{
  "breakdown": {
    "jobMatchScore": number,
    "coveragePct": number,
    "matchedCount": number,
    "jdCount": number,
    "formula": string,
    "resumeStrengthScore": number
  },
  "drivers": {
    "topMatched": string[],
    "topMissing": string[]
  },
  "actions": [
    {"title": string, "why": string, "impact": string}
  ]
}

Rules:
- Do NOT repeat generic resume advice already covered elsewhere.
- Focus on WHY the score is this number and WHAT changes will increase the score fastest.
- Keep arrays short (max 3 items each).
- Output JSON only. No markdown. No extra keys.`;
}

function tryParseJsonStrict(text) {
  const t = String(text || "").trim();
  if (!t) return null;

  // 有些模型会在前后夹杂内容，这里尽量截取最外层 JSON
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
  // Claude Messages API: { content: [{type:"text", text:"..."}] }
  if (json && Array.isArray(json.content)) {
    const t = json.content.find((c) => c?.type === "text")?.text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  // 兜底字段
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
    max_tokens: 380,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
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

  const text = parseClaudeText(json);
  return text;
}

function normalizeAiJson(aiJson, fallbackData) {
  // 最小字段保护
  const fb = buildFallbackExplain(fallbackData);

  const breakdown = aiJson?.breakdown || {};
  const drivers = aiJson?.drivers || {};
  const actions = safeArray(aiJson?.actions);

  const out = {
    breakdown: {
      jobMatchScore: Number(breakdown.jobMatchScore ?? fb.breakdown.jobMatchScore) || fb.breakdown.jobMatchScore,
      resumeStrengthScore:
        Number(breakdown.resumeStrengthScore ?? fb.breakdown.resumeStrengthScore) ||
        fb.breakdown.resumeStrengthScore,
      coveragePct: Number(breakdown.coveragePct ?? fb.breakdown.coveragePct) || fb.breakdown.coveragePct,
      matchedCount: Number(breakdown.matchedCount ?? fb.breakdown.matchedCount) || fb.breakdown.matchedCount,
      jdCount: Number(breakdown.jdCount ?? fb.breakdown.jdCount) || fb.breakdown.jdCount,
      formula: String(breakdown.formula || fb.breakdown.formula),
    },
    drivers: {
      topMatched: clampArray(drivers.topMatched || fb.drivers.topMatched, 3),
      topMissing: clampArray(drivers.topMissing || fb.drivers.topMissing, 3),
    },
    actions: clampArray(
      actions.length ? actions : fb.actions,
      3
    ).map((a) => ({
      title: clampWords(a?.title || "", 18) || "Improve one missing core skill",
      why: clampWords(a?.why || "", 26) || "Improves coverage and adds evidence.",
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
    const data = await req.json().catch(() => null);
    if (!data) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const v = validateInput(data);
    if (!v.ok) {
      return NextResponse.json({ error: v.message }, { status: 400 });
    }

    const prompt = buildPrompt(data);

    let finalJson = null;

    try {
      const text = await callBedrockClaude(prompt);
      const aiJson = tryParseJsonStrict(text);
      finalJson = normalizeAiJson(aiJson, data);
    } catch {
      // AI 调用失败或解析失败
      finalJson = buildFallbackExplain(data);
    }

    return NextResponse.json(finalJson);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
