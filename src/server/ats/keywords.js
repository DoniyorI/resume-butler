import "server-only";
import { SKILL_ALIASES } from "@/server/ats/skills";

const COMPOUND_PATTERNS = [
  { re: /bachelor'?s?\s*(degree)?/i, label: "bachelor's degree" },
  { re: /master'?s?\s*(degree)?/i, label: "master's degree" },
  { re: /ph\.?d\.?/i, label: "PhD" },
  { re: /computer science/i, label: "computer science" },
  { re: /software engineer(ing)?/i, label: "software engineering" },
  { re: /full[\s-]?stack/i, label: "full stack" },
  { re: /front[\s-]?end/i, label: "frontend" },
  { re: /back[\s-]?end/i, label: "backend" },
  { re: /machine learning/i, label: "machine learning" },
  { re: /data (science|scientist|engineer)/i, label: "data science" },
  { re: /devops/i, label: "devops" },
  { re: /cloud (engineer|architect)/i, label: "cloud engineering" },
  { re: /project manage(ment|r)/i, label: "project management" },
  { re: /product manage(ment|r)/i, label: "product management" },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWord(text, word) {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(text);
}

// Keywords the job description asks for, in the order they were found
export function extractKeywords(jobDescription) {
  const lower = jobDescription.toLowerCase();
  const found = new Set();

  for (const [skill, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.some((alias) => containsWord(lower, alias))) found.add(skill);
  }

  // e.g. "5+ years of experience"
  const years = lower.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi);
  (years || []).forEach((m) => found.add(m.trim()));

  COMPOUND_PATTERNS.forEach(({ re, label }) => {
    if (re.test(lower)) found.add(label);
  });

  return [...found];
}

// Crude suffix stripping so "software engineering" also matches "software engineer"
function stem(word) {
  return word
    .toLowerCase()
    .replace(/(ing|ed|er|ment|tion|sion|ness|ity|ous|ive|able|ible|ist|ent|ant|al|ful|less|ly)$/, "")
    .replace(/s$/, "");
}

export function findInResume(keyword, resumeText) {
  const lower = resumeText.toLowerCase();

  if (containsWord(lower, keyword)) return true;
  if ((SKILL_ALIASES[keyword] || []).some((alias) => containsWord(lower, alias))) return true;

  const keywordWords = keyword.toLowerCase().split(/\s+/);
  if (keywordWords.length >= 2) {
    const resumeStems = lower.split(/\s+/).map(stem);
    return keywordWords.map(stem).every((ks) => resumeStems.includes(ks));
  }

  return false;
}
