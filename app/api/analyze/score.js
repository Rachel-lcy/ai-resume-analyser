

export function computeMatch(resumeSkills = [], jdSkills = []){
  const jdSet = new Set(jdSkills);
  const resumeSet = new Set(resumeSkills)

  const matched = jdSkills.filter((s) => resumeSet.has(s));
  const missing = jdSkills.filter((s)=> !resumeSet.has(s));

  // 覆盖率：JD 技能中，简历覆盖了多少
  const coverage = jdSkills.length? matched.length/ jdSkills.length:0;

  // 分数（0-100）：coverage 权重为主
  const jobMarchScore = Math.round(50 + coverage*50) //50-100
  const resumeStrengthScore = Math.round(55 + Math.min(resumeSkills.length, 20)*2) // 简历技能越多越高（上限）

  return{
    matched,
    missing,
    coverage: Number(coverage.toFixed(2)),
    scores: {
      jobMatchScore:Math.min(jobMarchScore,100),
      resumeStrengthScore: Math.min(resumeStrengthScore,100)
    }

  }


}