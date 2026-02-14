function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function uniq(arr) {
  return Array.from(
    new Set(safeArray(arr).map((s) => String(s).trim()).filter(Boolean))
  );
}

/**
 * Evidence score bucket (0/5/10/15)
 * 目标：不要太容易满分；只看“证据强度信号”的数量
 */
export function computeEvidenceScore(resumeText = "") {
  const text = String(resumeText || "");

  const verbs = [
    "built","developed","implemented","designed","created","optimized","improved","increased",
    "reduced","led","delivered","launched","migrated","integrated","deployed","automated",
    "refactored","tested","debugged","collaborated","analyzed"
  ];

  // 动词（最多算 6 个信号）
  const verbRegex = new RegExp(`\\b(${verbs.join("|")})\\b`, "gi");
  const verbCount = Math.min((text.match(verbRegex) || []).length, 6);

  // 量化（只算真正“数字/百分比/单位”，不要把 api 这种词当量化）
  const metricRegex = /(\b\d+(\.\d+)?\b)|(%|\bms\b|\bsec\b|\bseconds\b|\busers?\b|\brequests?\b)/gi;
  const metricCount = Math.min((text.match(metricRegex) || []).length, 6);

  // 项目/交付信号（最多算 3 个信号）
  const projectRegex = /\b(project|capstone|portfolio|dashboard|deployed|ci\/cd|github actions)\b/gi;
  const projectCount = Math.min((text.match(projectRegex) || []).length, 3);

  // 工具链信号（最多算 3 个信号）
  const toolRegex = /\b(aws|docker|kubernetes|terraform|cloudfront|lambda|dynamodb|s3|bedrock)\b/gi;
  const toolCount = Math.min((text.match(toolRegex) || []).length, 3);

  const signals = verbCount + metricCount + projectCount + toolCount;

  // 分档：0/5/10/15（更稳）
  if (signals >= 8) return 15;
  if (signals >= 5) return 10;
  if (signals >= 2) return 5;
  return 0;
}

/**
 * Job Match Score: 50 + coverage*50 （保持你原来）
 * Resume Strength Score: 40 + breadth(0~20) + relevance(0~25) + evidence(0~15)
 */
export function computeMatch({ resumeSkills = [], jdSkills = [], resumeText = "" }) {
  const jd = uniq(jdSkills);
  const rs = uniq(resumeSkills);

  const jdSet = new Set(jd);
  const rsSet = new Set(rs);

  const matched = jd.filter((s) => rsSet.has(s));
  const missing = jd.filter((s) => !rsSet.has(s));

  // coverage for Job Match
  const coverage = jd.length ? matched.length / jd.length : 0;
  const jobMatchScore = Math.round(50 + coverage * 50); // 50~100

  // ---------- Resume Strength (more reasonable) ----------
  const base = 40;

  // breadth: 0~20（把“技能数量”压缩到合理权重）
  const resumeSkillCount = rs.length;
  const breadth = Math.round((Math.min(resumeSkillCount, 30) / 30) * 20);

  // relevance: 0~25（真正随 JD 变化：matched/jdCount）
  const jdCount = jd.length || 1;
  const relevance = Math.round((matched.length / jdCount) * 25);

  // evidence: 0/5/10/15
  const evidence = computeEvidenceScore(resumeText);

  const resumeStrengthScore = Math.min(100, base + breadth + relevance + evidence);

  return {
    matched,
    missing,
    coverage: Number(coverage.toFixed(2)),
    meta: {
      resumeSkillCount,
      matchedSkillCount: matched.length,
      jdCount: jd.length,
      evidenceScore: evidence,
      breakdown: {
        base,
        breadth,
        relevance,
        evidence,
      },
      formula: {
        jobMatch: "50 + coverage*50 (coverage = matched_jd_skills / total_jd_skills)",
        strength:
          "40 + breadth(0~20) + relevance(0~25 using matched/jdCount) + evidence(0/5/10/15)",
      },
    },
    scores: {
      jobMatchScore: Math.min(jobMatchScore, 100),
      resumeStrengthScore,
    },
  };
}
