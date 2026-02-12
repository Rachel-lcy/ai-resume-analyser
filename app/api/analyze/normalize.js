export function normalizeText(text = "") {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    // 统一各种破折号/连字符
    .replace(/[‐-‒–—−]/g, "-")
    // 统一各种引号
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // 常见分隔符统一成空格（保留 + # . - / 因为技能会用到）
    .replace(/[|·•●▪︎■◦]/g, " ")
    // 把括号/逗号/冒号/分号等变成空格
    .replace(/[()[\]{}<>,:;!?]/g, " ")
    // tab 多空格归一
    .replace(/[ \t]+/g, " ")
    // 多空行归一
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 用于技能匹配的“更强 normalize”（避免各种写法导致 miss）
export function normalizeForMatching(text = "") {
  const t = normalizeText(text)
    .toLowerCase()
    // 常见写法统一
    .replace(/\bnode\s*js\b/g, "node.js")
    .replace(/\bnext\s*js\b/g, "next.js")
    .replace(/\breact\s*js\b/g, "react")
    .replace(/\bexpress\s*js\b/g, "express")
    .replace(/\bpostgres\b/g, "postgresql")
    .replace(/\bpostgre\s*sql\b/g, "postgresql")
    .replace(/\bci\s*\/\s*cd\b/g, "ci/cd")
    .replace(/\bci\s*cd\b/g, "ci/cd")
    .replace(/\bamazon\s*web\s*services\b/g, "aws")
    .replace(/\bamazon\s*bedrock\b/g, "amazon bedrock")
    // 把多余点号重复归一
    .replace(/\.{2,}/g, ".")
    // 再做一次空格归一
    .replace(/\s+/g, " ")
    .trim();

  return t;
}