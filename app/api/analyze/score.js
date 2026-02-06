

export function computeMatch(resumeSkills = [], jdSkills = []){
  const jdSet = new Set(jdSkills);
  const resumeSet = new Set(resumeSkills)

  const matched = jdSkills.filter((s) => resumeSet.has(s));
  const missing = jdSkills.filter((s)=> !resumeSet.has(s));

  // 覆盖率：JD 技能中，简历覆盖了多少/
  // 覆盖率 = 命中数量 / JD 技能总数
  const coverage = jdSkills.length? matched.length/ jdSkills.length:0;

  // 分数（0-100）：coverage 权重为主
  const jobMarchScore = Math.round(50 + coverage*50) //50-100
  const resumeStrengthScore = Math.round(55 + Math.min(resumeSkills.length, 20)*2) // 简历技能越多越高

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


// 例子 1：JD 6 个技能，简历命中 4 个

// JD：
// ["React","Next.js","Tailwind","Node.js","SQL","AWS"]（6个）

// Resume：
// ["React","Tailwind","AWS","Git","Figma","Next.js","TypeScript","Jest"]（8个）

// matched

// 命中的：React、Next.js、Tailwind、AWS → matched.length = 4

// missing

// 缺失的：Node.js、SQL → missing.length = 2

// coverage

// coverage = 4 / 6 = 0.6666… → 0.67

// jobMatchScore

// 50 + 0.6666*50 = 50 + 33.333 = 83.333
// Math.round → 83

// ✅ jobMatchScore = 83

// resumeStrengthScore

// 简历技能数 8（<=20）
// 55 + 8*2 = 71
// round → 71

// ✅ resumeStrengthScore = 71