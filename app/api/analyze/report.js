export function buildReport({resumeText, jobDescription, resumeSkills, jdSkills,match}) {
  return{
    meta:{
      reportId: `rpt_${Date.now()}`,
      createdAt: new Date().toISOString(),
      model: "phase4-rule-based-v1",
    },
    scores: match.scores,
    skills: {
      resumeSkills,
      jdSkills,
      matchedSkills: match.matched,
      missingSkills: match.missing,
      coverage:match.coverage,
    },
    insights:{
      doingWell:[
         "Resume contains relevant technical keywords for this role.",
        "Skill coverage indicates partial alignment with the job requirements.",
      ],
      fallsShort: match.missing.length
      ? ["Some key skills from the job description are missing from the resume."]
      :["No major skill gaps detected from the current skill bank."]
    },
    improvements: {
      recommended: match.missing.slice(0,6).map((s) => `Add evidence of ${s} experience in your project bullets`)
    },
    interviewQuestions:[
      "Explain one project where you used a key technology from this role.",
      "How do you debug production issues in a web application?",
      "What trade-offs did you make in your architecture decisions?",
    ],
  }
}