
import { normalizeForMatching } from "./normalize";
import { SKILL_ALIASES } from "./skillAlias";

/**
 * 转义正则特殊字符
 */
function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 把 “CI/CD” “Node.js” “React Native” 这类技能拆成更稳的 token pattern
 * - 允许 skill 里有空格、点、#、+、/、- 等符号
 * - 对 C/C++/C#/.NET 做特殊处理
 * - 默认用“边界”防止误判：比如 "css" 不会匹配到 "process"
 */
function buildSkillRegex(skill) {
  const raw = String(skill || "").trim().toLowerCase();
  if (!raw) return null;

  // ===== 特例：强规则（最容易误判的）=====
  if (raw === "c++") return /(^|[\s,;()])c\+\+([\s,;()\.]|$)/i;
  if (raw === "c#") return /(^|[\s,;()])c#([\s,;()\.]|$)/i;

  // .net / dotnet：允许 ".NET" "dotnet" "ASP.NET"
  if (raw === ".net" || raw === "dotnet") {
    return /(^|[\s,;()])(\.net|dotnet|asp\.net)([\s,;()\.]|$)/i;
  }

  // ===== 一般情况 =====
  // 关键：把常见分隔符当作边界：空格、逗号、括号、斜杠、换行等
  // 避免纯 \b 在 "node.js" / "ci/cd" / "react-native" 这种场景不稳定
  const token = escapeRegex(raw);

  // 左边界：开头 或 常见分隔符
  // 右边界：结尾 或 常见分隔符
  const left = `(^|[\\s,;()\\[\\]{}<>:"'\\/\\\\|])`;
  const right = `($|[\\s,;()\\[\\]{}<>:"'\\.\\/\\\\|])`;

  // 注意：右边界包含了 "."，保证 "node.js" 后面句号也算边界
  return new RegExp(`${left}${token}${right}`, "i");
}

/**
 * 对 alias 表进行“清洗 + 合并”，避免 alias 里大小写/空格差异导致重复
 */
function normalizeAliasMap(map) {
  const out = {};
  for (const [canonical, aliases] of Object.entries(map || {})) {
    const c = String(canonical || "").trim();
    if (!c) continue;

    const list = Array.isArray(aliases) ? aliases : [];
    const merged = [c, ...list]
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    // 去重（不区分大小写）
    const seen = new Set();
    const uniq = [];
    for (const item of merged) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(item);
    }

    out[c] = uniq;
  }
  return out;
}

export function extractSkills(text = "", skillBank = []) {
  const normalizedText = normalizeForMatching(text);
  const found = new Set();

  const aliasMap = normalizeAliasMap(SKILL_ALIASES);

  // 1) 先扫 别名 aliases：命中任何 alias -> 加入 canonical
  for (const [canonical, allForms] of Object.entries(aliasMap)) {
    for (const form of allForms) {
      const rx = buildSkillRegex(form);
      if (!rx) continue;
      if (rx.test(normalizedText)) {
        found.add(canonical);
        break;
      }
    }
  }

  // 2) 再扫 skillBank：兜底，避免 skillBank 新增但 aliases 没跟上
  for (const skill of Array.isArray(skillBank) ? skillBank : []) {
    const s = String(skill || "").trim();
    if (!s) continue;

    // 如果 alias 已经命中过 canonical，就不必再加重复项
    // （但如果你的 skillBank 里 canonical 名字和 alias canonical 不一致，
    //  这里仍然会加入 skillBank 的原值；这就是“兜底”设计）
    const rx = buildSkillRegex(s);
    if (!rx) continue;

    if (rx.test(normalizedText)) {
      found.add(s);
    }
  }

  return Array.from(found);
}
