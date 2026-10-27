import "server-only";
import { SKILL_ALIASES } from "@/server/ats/skills";

// Checks on AI edits to the user's own bullets. The model is told to keep the
// facts; these make sure it did, so a suggestion can never put a technology or
// a claim on someone's resume that they didn't write.

// Aliases that are also everyday words ("rest", "testing", "go"), so seeing
// them in a suggestion isn't proof the model added a technology
const GENERIC_ALIASES = new Set([
  "api",
  "rest",
  "restful",
  "testing",
  "unit testing",
  "integration testing",
  "e2e testing",
  "authentication",
  "real-time",
  "containers",
  "containerization",
  "version control",
  "serverless",
  "ai",
  "ml",
  "dl",
  "data structures",
  "algorithms",
  "go",
  "next",
  "node",
  "express",
  "spring",
  "swift",
  "rust",
  "ruby",
  "lambda",
]);

const TECH_PATTERNS = Object.entries(SKILL_ALIASES).map(([skill, aliases]) => ({
  skill,
  patterns: aliases
    .filter((alias) => !GENERIC_ALIASES.has(alias))
    .map(
      (alias) =>
        new RegExp(`(^|[^a-z0-9+#.])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9+#])`, "i")
    ),
}));

// Technologies a bullet names (canonical names, e.g. "react native"), so the
// prompt can tell the model to keep them
export function technologies(text) {
  const found = new Set();
  for (const { skill, patterns } of TECH_PATTERNS) {
    if (patterns.some((re) => re.test(text))) found.add(skill);
  }
  return found;
}

// Words that carry no fact, so dropping them is fine
const FILLER = new Set([
  "that",
  "this",
  "with",
  "from",
  "into",
  "using",
  "used",
  "various",
  "successfully",
  "order",
  "also",
  "which",
  "their",
  "were",
  "been",
  "have",
  "while",
  "over",
  "across",
  "such",
  "like",
  "including",
  "several",
  "many",
  "some",
  "more",
  "very",
]);

// Meaningful words, keyed by a short stem so "build" and "built" match.
// The opening verb is skipped: swapping it for a stronger one is the point.
function contentWords(text, { skipFirst = false } = {}) {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean);
  const map = new Map();
  for (const word of skipFirst ? words.slice(1) : words) {
    if (word.length >= 4 && !FILLER.has(word)) map.set(word.slice(0, 4), word);
  }
  return map;
}

// One verb may be swapped for a synonym ("implementing" -> "incorporating");
// nouns can't be, since they carry the facts ("Python", "integration")
const isVerbForm = (word) => /(ed|ing)$/.test(word);

const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[^a-z0-9+#%]+/g, " ")
    .trim();

/**
 * Check one AI rewrite of a bullet. Returns the text to offer (with the
 * original's ending punctuation) or null when it must be dropped because it:
 * - adds a technology the bullet didn't mention, or (unless `allowCuts`)
 *   drops one it did
 * - (unless `allowCuts`, for shortening) drops a meaningful word other than
 *   the opening verb or one swapped verb, which is how a model quietly
 *   changes what the work was about ("unit and integration tests" -> "unit tests")
 * - only changes punctuation or articles
 */
export function checkRewrite(original, suggested, { allowCuts = false } = {}) {
  let text = suggested.trim();
  // Keep the user's style for the final period
  if (!/[.!]$/.test(original.trim())) text = text.replace(/\.$/, "");

  if (normalize(text) === normalize(original)) return null;

  const before = technologies(original);
  const after = technologies(text);
  for (const skill of after) if (!before.has(skill)) return null;
  if (!allowCuts) {
    for (const skill of before) if (!after.has(skill)) return null;
    const kept = contentWords(text);
    const dropped = [...contentWords(original, { skipFirst: true })].filter(([stem]) => !kept.has(stem));
    if (dropped.length > 1 || dropped.some(([, word]) => !isVerbForm(word))) return null;
  }
  return text;
}
