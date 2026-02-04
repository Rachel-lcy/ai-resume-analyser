export function extractSkills(text = "", skillBank = []){
  const lower = text.toLowerCase();
  const found = [];

  for(const skill of skillBank){
    const s = skill.toLowerCase();
    if(lower.includes(s)) found.push(skill)

  }
  return Array.from(new Set(found))

}