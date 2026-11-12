import "server-only";
import { SATISFIED_BY, SKILL_ALIASES, containsTerm, matchSkills } from "@/server/ats/skills";

// Degree requirements. Bare abbreviations are case-sensitive and, in a posting,
// need "in"/"of"/"degree" or another degree after them, so "BA" (business
// analyst) or "MS Office" don't read as degrees. "master" alone never counts:
// "Scrum master", "master branch", "mastery", "master data" are not degrees.
const FIELD =
  "(?:computer|data|information|software|electrical|mechanical|civil|engineering|science|sciences|mathematics|math|statistics|business|economics|finance|physics|design|a\\s+related|related|a\\s+relevant|relevant|a\\s+technical|technical|cs|stem)";
const DEGREE_FOLLOWS = String.raw`(?=\s+(?:in|of|degree)\b|\s*\/\s*(?:B\.?S|B\.?A|M\.?S|MSc|M\.?Eng|Ph\.?D)|\s+or\s+(?:B\.?S|B\.?A|M\.?S|MSc|Ph\.?D|equivalent|higher|above)\b)`;

const DEGREES = [
  {
    label: "bachelor's degree",
    level: 1,
    posting: [
      /\bbachelor(?:'s|’s|s)?(?![A-Za-z])/i,
      /(?<![A-Za-z0-9.])B\.\s?(?:S|A|Sc|Eng|Tech)\.?(?![A-Za-z0-9])/,
      new RegExp(String.raw`(?<![A-Za-z0-9])(?:BS|BA|BSc|BEng|BTech)` + DEGREE_FOLLOWS),
    ],
    // In the resume's education entries a bare "BS"/"BA" is a degree
    education: [/(?<![A-Za-z0-9])(?:BS|BA|BSc|BEng|BTech|AB|SB)(?![A-Za-z0-9])/],
  },
  {
    label: "master's degree",
    level: 2,
    posting: [
      /\bmaster(?:'s|’s)(?![A-Za-z])/i,
      new RegExp(String.raw`\bmasters?\s+(?:degree|program|level|in\s+${FIELD}\b)`, "i"),
      /\bmaster\s+of\s+(?:science|arts|engineering|business|computer|information|fine\s+arts|public|data|applied)\b/i,
      /(?<![A-Za-z0-9.])M\.\s?(?:S|A|Sc|Eng|Tech)\.?(?![A-Za-z0-9])/,
      new RegExp(String.raw`(?<![A-Za-z0-9])(?:MS|MSc|MEng|MTech|MBA)` + DEGREE_FOLLOWS),
    ],
    education: [/(?<![A-Za-z0-9])(?:MS|MSc|MEng|MTech|MBA|MA|SM|MPhil)(?![A-Za-z0-9])/],
  },
  {
    label: "PhD",
    level: 3,
    posting: [/\bph\.?\s?d(?![A-Za-z])/i, /\bdoctorate\b/i, /\bdoctoral\s+degree\b/i, /\bdoctor\s+of\s+philosophy\b/i],
    education: [/\bDPhil\b/],
  },
];
const DEGREE_BY_LABEL = Object.fromEntries(DEGREES.map((degree) => [degree.label, degree]));

const COMPOUND_PATTERNS = [
  { re: /computer science/i, label: "computer science" },
  { re: /software engineer(ing)?/i, label: "software engineering" },
  { re: /full[\s-]?stack/i, label: "full stack" },
  { re: /front[\s-]?end/i, label: "frontend" },
  { re: /back[\s-]?end/i, label: "backend" },
  { re: /machine learning/i, label: "machine learning" },
  { re: /data scien(ce|tist)/i, label: "data science" },
  { re: /data engineer(ing)?/i, label: "data engineering" },
  { re: /devops/i, label: "devops" },
  { re: /cloud (engineer|architect)/i, label: "cloud engineering" },
  { re: /project management/i, label: "project management" },
  { re: /product management/i, label: "product management" },
];

// Keywords the job description asks for: skills, then degrees, then roles
export function extractKeywords(jobDescription) {
  const found = new Set(matchSkills(jobDescription));

  for (const degree of DEGREES) {
    if (degree.posting.some((re) => re.test(jobDescription))) found.add(degree.label);
  }

  COMPOUND_PATTERNS.forEach(({ re, label }) => {
    if (re.test(jobDescription)) found.add(label);
  });

  return [...found];
}

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };
const N = String.raw`(\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})`;
const YEARS = String.raw`\s*(?:years?|yrs?)(?:'|’)?`;
// A years phrase is a requirement only when it says so:
// - a range or minimum marker: "3-5 years", "3 to 5 years", "5+ years",
//   "5 or more years", "at least 2 years", "minimum (of) 4 years";
// - or the word "experience" within a few words after it: "3 years of
//   professional experience", "4 years' experience".
// Other numbers of years ("founded 10 years ago", "for 10 years running") are
// not requirements. The smallest stated requirement wins.
const YEARS_PATTERNS = [
  new RegExp(String.raw`\b${N}\s*\+?\s*(?:-|–|—|to)\s*\d{1,2}\s*\+?${YEARS}`, "gi"),
  new RegExp(String.raw`\b${N}\s*\+${YEARS}`, "gi"),
  new RegExp(String.raw`\b${N}${YEARS}\s+or\s+more\b`, "gi"),
  new RegExp(String.raw`\b${N}\s+or\s+more${YEARS}`, "gi"),
  new RegExp(String.raw`\b(?:at\s+least|(?:a\s+)?minimum(?:\s+of)?|min\.?)\s+${N}\s*\+?${YEARS}`, "gi"),
  new RegExp(String.raw`\b${N}${YEARS}\s+(?:of\s+)?(?:[A-Za-z/-]+\s+){0,3}?(?:experience|exp)\b`, "gi"),
];

function toNumber(value) {
  const n = /^\d+$/.test(value) ? Number(value) : NUMBER_WORDS[value.toLowerCase()];
  return n > 0 && n <= 40 ? n : null;
}

// Smallest number of years of experience the posting asks for, or null
export function extractYearsRequirement(jobDescription) {
  let smallest = null;
  for (const re of YEARS_PATTERNS) {
    for (const m of String(jobDescription || "").matchAll(re)) {
      const n = toNumber(m[1]);
      if (n !== null && (smallest === null || n < smallest)) smallest = n;
    }
  }
  return smallest;
}

// Crude suffix stripping so "software engineering" also matches "software engineer"
function stem(word) {
  return word
    .toLowerCase()
    .replace(/(ing|ed|er|ment|tion|sion|ness|ity|ous|ive|able|ible|ist|ent|ant|al|ful|less|ly)$/, "")
    .replace(/s$/, "");
}

// Highest degree level the resume shows (0 none, 1 bachelor's, 2 master's, 3 PhD).
// Strict posting patterns on the whole resume; bare abbreviations only in the
// education entries.
function degreeLevel(resumeText, educationText) {
  let level = 0;
  for (const degree of DEGREES) {
    const shown =
      degree.posting.some((re) => re.test(resumeText) || re.test(educationText)) ||
      degree.education.some((re) => re.test(educationText));
    if (shown) level = Math.max(level, degree.level);
  }
  return level;
}

// Whether the resume meets one keyword from extractKeywords. Skills use the same
// rules as the posting; a degree is met by that level or higher.
export function findInResume(keyword, resumeText, { educationText = "", skills } = {}) {
  const degree = DEGREE_BY_LABEL[keyword];
  if (degree) return degreeLevel(resumeText, educationText) >= degree.level;

  const resumeSkills = skills || matchSkills(resumeText, { technical: true });
  if (resumeSkills.has(keyword)) return true;
  if ((SATISFIED_BY[keyword] || []).some((skill) => resumeSkills.has(skill))) return true;
  // A skill counts only under matchSkills' rules, never as a bare substring
  if (SKILL_ALIASES[keyword]) return false;

  const compound = COMPOUND_PATTERNS.find((pattern) => pattern.label === keyword);
  if (compound?.re.test(resumeText)) return true;
  if (containsTerm(resumeText, keyword)) return true;

  const keywordWords = keyword.toLowerCase().split(/\s+/);
  if (keywordWords.length >= 2) {
    const resumeStems = resumeText.toLowerCase().split(/\s+/).map(stem);
    return keywordWords.map(stem).every((ks) => resumeStems.includes(ks));
  }

  return false;
}
