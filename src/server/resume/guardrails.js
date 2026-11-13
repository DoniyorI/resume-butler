import "server-only";
import { PRACTICE_SKILLS, matchSkills } from "@/server/ats/skills";

// Checks on AI edits to the user's own bullets. The model is told to keep the
// facts; these make sure it did, so a suggestion can never put a technology or
// a claim on someone's resume that they didn't write.

// Technologies a bullet names (canonical names, e.g. "react native"), so the
// prompt can tell the model to keep them. Uses the resume rules of
// matchSkills: plain technology names match in any case, but a name that is
// also an ordinary word counts only in its exact spelling ("Excel", "Spark",
// "Unity", "Go"), so "excel at", "sparked" or "shell out" in a rewrite are not
// an added technology, while "Rewrote it in Go" is. Ways of working
// ("testing", "system design", "concurrency") are left to the word checks
// below rather than treated as technologies.
export function technologies(text) {
  const found = new Set();
  for (const skill of matchSkills(String(text || ""), { technical: true })) {
    if (!PRACTICE_SKILLS.has(skill)) found.add(skill);
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
