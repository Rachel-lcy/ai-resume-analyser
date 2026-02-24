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

function isFiniteNumber(x) {
  const n = Number(x);
  return Number.isFinite(n);
}

function toNumberOrNull(x) {
  return isFiniteNumber(x) ? Number(x) : null;
}

function toNumberOr(x, fallback) {
  return isFiniteNumber(x) ? Number(x) : fallback;
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

/**
 * Score breakdown 计算：
 * - Job Match: 50 + coverage*50
 * - Strength: 优先使用 analyze 返回的 scoreMeta.breakdown（base+breadth+relevance+evidence）
 * - 否则降级到老公式（55 + min(resume_skill_count, 20)*2）
 */
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

  // ---------- Strength meta from analyze ----------
  // scoreMeta: {
  //   resumeSkillCount, matchedSkillCount, jdCount, evidenceScore,
  //   breakdown: { base, breadth, relevance, evidence },
  //   formula: { jobMatch, strength }
  // }
  const scoreMeta = data?.scoreMeta ?? null;
  const metaBreakdown = scoreMeta?.breakdown ?? null;

  const base = toNumberOrNull(metaBreakdown?.base);
  const breadth = toNumberOrNull(metaBreakdown?.breadth);
  const relevance = toNumberOrNull(metaBreakdown?.relevance);
  const evidence = toNumberOrNull(metaBreakdown?.evidence);

  const hasNewStrength =
    base !== null && breadth !== null && relevance !== null && evidence !== null;

  const computedStrengthNew =
    hasNewStrength ? Math.round(base + breadth + relevance + evidence) : null;

  // ---------- Legacy strength fallback ----------
  const resumeSkillCountLegacy = toNumberOrNull(data?.resumeSkillCount);
  const usedCountLegacy = resumeSkillCountLegacy === null ? null : Math.min(resumeSkillCountLegacy, 20);
  const computedStrengthLegacy =
    usedCountLegacy === null ? null : Math.min(55 + usedCountLegacy * 2, 100);

  const strengthFormula =
    (typeof scoreMeta?.formula?.strength === "string" && scoreMeta.formula.strength.trim())
      ? scoreMeta.formula.strength.trim()
      : (hasNewStrength
          ? "40 (base) + breadth(0~20) + relevance(0~25) + evidence(0/5/10/15)"
          : "Resume Strength Score = 55 + min(resume_skill_count, 20)*2");

  const jobMatchFormula =
    (typeof scoreMeta?.formula?.jobMatch === "string" && scoreMeta.formula.jobMatch.trim())
      ? scoreMeta.formula.jobMatch.trim()
      : "Job Match Score = 50 + coverage*50 (coverage = matched_jd_skills / total_jd_skills)";

  return {
    // Scores (input)
    jobMatchScore: toNumberOr(data?.jobMatchScore, 0),
    resumeStrengthScore: toNumberOr(data?.resumeStrengthScore, 0),

    // Coverage
    coveragePct,
    matchedCount: matched.length,
    jdCount,

    // Formulas
    formula: jobMatchFormula,
    strengthFormula,

    // New strength details (preferred)
    strengthParts: hasNewStrength ? { base, breadth, relevance, evidence } : null,
    computedStrength: hasNewStrength ? computedStrengthNew : computedStrengthLegacy,

    // Helpful meta
    resumeSkillCount:
      toNumberOrNull(scoreMeta?.resumeSkillCount) ??
      resumeSkillCountLegacy ??
      null,

    strengthCap: 20,
    usedCount: hasNewStrength ? null : usedCountLegacy,
  };
}

function buildFallbackExplain(data) {
  const matched = safeArray(data?.matched);
  const missing = safeArray(data?.missing);
  const jdTopSkills = safeArray(data?.jdTopSkills);

  const breakdown = computeBreakdown(data);


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

      strengthParts: breakdown.strengthParts,
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

  const strengthPartsText = breakdown.strengthParts
    ? `- strengthParts: ${JSON.stringify(breakdown.strengthParts)}`
    : `- strengthParts: N/A (legacy mode)`;

  return `You are explaining a scoring algorithm to a user.

Context:
- Job Match Score (0-100) = 50 + coverage*50, where coverage = matched_jd_skills / total_jd_skills.
- Resume Strength Score (0-100) uses ONE of these:
  (A) New formula (preferred): base + breadth + relevance + evidence.
  (B) Legacy fallback: 55 + min(resume_skill_count, 20)*2.
Use the provided formula/parts if available and explain clearly.

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
${strengthPartsText}
- computedStrength (from formula): ${breakdown.computedStrength ?? "N/A"}
- jobMatch formula: ${breakdown.formula}
- strength formula: ${breakdown.strengthFormula}

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
    "usedCount": number | null,
    "computedStrength": number | null,
    "strengthFormula": string,
    "strengthParts": { "base": number, "breadth": number, "relevance": number, "evidence": number } | null
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
      jobMatchScore: toNumberOr(b.jobMatchScore, fb.breakdown.jobMatchScore),
      coveragePct: toNumberOr(b.coveragePct, fb.breakdown.coveragePct),
      matchedCount: toNumberOr(b.matchedCount, fb.breakdown.matchedCount),
      jdCount: toNumberOr(b.jdCount, fb.breakdown.jdCount),
      formula: String(b.formula || fb.breakdown.formula),

      resumeStrengthScore: toNumberOr(b.resumeStrengthScore, fb.breakdown.resumeStrengthScore),
      resumeSkillCount:
        isFiniteNumber(b.resumeSkillCount) ? Number(b.resumeSkillCount) : fb.breakdown.resumeSkillCount,
      usedCount:
        (b.usedCount === null || b.usedCount === undefined)
          ? fb.breakdown.usedCount
          : (isFiniteNumber(b.usedCount) ? Number(b.usedCount) : fb.breakdown.usedCount),
      computedStrength:
        (b.computedStrength === null || b.computedStrength === undefined)
          ? fb.breakdown.computedStrength
          : (isFiniteNumber(b.computedStrength) ? Number(b.computedStrength) : fb.breakdown.computedStrength),
      strengthFormula: String(b.strengthFormula || fb.breakdown.strengthFormula),

      strengthParts:
        b.strengthParts && typeof b.strengthParts === "object"
          ? b.strengthParts
          : fb.breakdown.strengthParts ?? null,
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

    const rawText = await req.text();
    if (!rawText) {
      return NextResponse.json({ error: "Empty request body." }, { status: 400 });
    }

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error("[explain] invalid json body:", e);
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
    } catch (e) {

      console.error("[explain] bedrock/parse failed, using fallback:", e);
      finalJson = buildFallbackExplain(data);
    }

    return NextResponse.json(finalJson);
  } catch (err) {
    console.error("[explain] server error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}