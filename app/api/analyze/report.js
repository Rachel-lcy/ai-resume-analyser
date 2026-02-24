export function buildReport({
  resumeText,
  jobDescription,
  resumeSkills,
  jdSkills,
  match,
}) {
  const now = new Date();

  // 给 UI / explain 用：JD Top Skills
  const jdTopSkills = Array.isArray(jdSkills) ? jdSkills.slice(0, 12) : [];

  return {
    meta: {
      reportId: `rpt_${Date.now()}`,
      createdAt: now.toISOString(),
      model: match?.meta
        ? "phase4-rule-based-v2 (transparent scoring)"
        : "phase4-rule-based-v1",
    },

    // 分数
    scores: match?.scores || { jobMatchScore: 0, resumeStrengthScore: 0 },

    // 技能结果
    skills: {
      resumeSkills: Array.isArray(resumeSkills) ? resumeSkills : [],
      jdSkills: Array.isArray(jdSkills) ? jdSkills : [],
      matchedSkills: Array.isArray(match?.matched) ? match.matched : [],
      missingSkills: Array.isArray(match?.missing) ? match.missing : [],
      coverage: typeof match?.coverage === "number" ? match.coverage : 0,
      jdTopSkills,
    },

    // 前端 UI 直接用 report.scoreMeta 就能拿到所有 breakdown
    scoreMeta: match?.meta || null,

    insights: {
      doingWell: [
        "Resume contains relevant technical keywords for this role.",
        "Skill coverage indicates partial alignment with the job requirements.",
      ],
      fallsShort: (match?.missing?.length || 0)
        ? ["Some key skills from the job description are missing from the resume."]
        : ["No major skill gaps detected from the current skill bank."],
    },

    improvements: {
      recommended: (Array.isArray(match?.missing) ? match.missing : [])
        .slice(0, 6)
        .map((s) => `Add evidence of ${s} experience in your project bullets`),
    },

    interviewQuestions: [
      "Explain one project where you used a key technology from this role.",
      "How do you debug production issues in a web application?",
      "What trade-offs did you make in your architecture decisions?",
    ],
  };
}
