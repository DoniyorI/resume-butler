import "server-only";
import { SKILL_ALIASES, containsTerm, termPattern } from "@/server/ats/skills";
import { extractKeywords } from "@/server/ats/keywords";
import { clipAround } from "@/server/fit/quote";
import { isDegree } from "@/server/fit/cvEvidence";

// How a part of the posting counts:
// - "required": requirement headings, and the plain text around them (summary,
//   responsibilities, or a posting with no headings at all)
// - "preferred": nice-to-have headings, or a sentence with a preferred cue
// - "ignored": company boilerplate (about us, benefits, pay, equal opportunity)
const REQUIRED = "required";
const PREFERRED = "preferred";
const IGNORED = "ignored";

const YOULL = "you(?:['’]ll|\\s+will)";
const WERE = "we(?:['’]re|\\s+are)";

// Each heading counts when it stands alone on a line, or is followed by a
// colon and starts with a capital letter (or the line). `loose` headings are
// distinctive enough to count with a capital letter alone, which is how
// captured one-paragraph postings show them ("...ship fast What You'll Need 5+
// years...").
const HEADINGS = [
  // Requirements
  ...[
    ["requirements", true],
    ["(?:job|role|minimum|basic|key)\\s+requirements", true],
    ["required\\s+(?:qualifications|skills|experience)", true],
    ["(?:minimum|basic)\\s+qualifications", true],
    ["qualifications", true],
    ["must[-\\s]haves?", false],
    ["must\\s+have", false],
    [`what\\s+${YOULL}\\s+need`, true],
    ["what\\s+you\\s+need(?:\\s+to\\s+succeed)?", true],
    [`what\\s+(?:${YOULL}\\s+)?bring`, true],
    [`what\\s+${WERE}\\s+looking\\s+for`, true],
    ["who\\s+you\\s+are", true],
    ["about\\s+you", true],
    ["you\\s+have", false],
    [`${YOULL}\\s+have`, false],
    ["skills\\s+(?:and|&)\\s+(?:experience|qualifications)", true],
    ["your\\s+(?:skills|experience|background|qualifications)", false],
    ["(?:key|technical|core)\\s+skills", false],
    ["skills", false],
    ["experience", false],
    ["(?:the\\s+)?ideal\\s+candidate", false],
  ].map(([source, loose]) => ({ source, loose, category: REQUIRED })),
  // Preferred
  ...[
    ["preferred\\s+(?:qualifications|skills|experience|requirements)", true],
    ["preferred", false],
    ["nice[-\\s]to[-\\s]haves?", true],
    ["bonus\\s+points", true],
    ["bonus(?:\\s+if\\s+you\\s+have)?", false],
    ["pluses", false],
    ["plus", false],
    ["desired\\s+(?:qualifications|skills|experience)", true],
    ["desired", false],
    ["desirable", false],
    ["good\\s+to\\s+have", true],
    ["extra\\s+credit", false],
    ["even\\s+better\\s+if(?:\\s+you\\s+have)?", true],
  ].map(([source, loose]) => ({ source, loose, category: PREFERRED })),
  // Boilerplate
  ...[
    ["about\\s+(?:us|the\\s+company)", true],
    ["who\\s+we\\s+are", true],
    ["our\\s+(?:company|mission|story|values)", false],
    ["company\\s+overview", true],
    ["(?:perks|benefits)(?:\\s+(?:and|&)\\s+(?:perks|benefits))?", false],
    ["what\\s+we\\s+offer", true],
    ["why\\s+join\\s+us", true],
    ["compensation(?:\\s+(?:and|&)\\s+benefits)?", false],
    ["(?:salary|pay)(?:\\s+range)?", false],
    ["equal\\s+(?:employment\\s+)?opportunity(?:\\s+employer)?", true],
    ["eeo(?:\\s+statement)?", false],
    ["diversity\\s+(?:and|&)\\s+inclusion", false],
    ["(?:reasonable\\s+)?accommodations", false],
    ["privacy\\s+(?:notice|policy)", false],
    ["how\\s+to\\s+apply", false],
    // How the company interviews is not what the candidate must have
    ["(?:our\\s+)?(?:interview|hiring|recruiting|recruitment|selection)\\s+process", true],
    ["our\\s+process", true],
    ["interview\\s+(?:stages|steps|loop)", false],
  ].map(([source, loose]) => ({ source, loose, category: IGNORED })),
  // Neutral headings end a preferred or boilerplate part; their text counts as required
  ...[
    ["(?:key\\s+|your\\s+|job\\s+)?responsibilities", true],
    [`what\\s+${YOULL}\\s+(?:do|be\\s+doing)`, true],
    ["about\\s+(?:the|this)\\s+(?:role|job|position|team|opportunity)", true],
    ["(?:role|position|job)\\s+(?:overview|summary|description)", true],
    ["the\\s+(?:role|opportunity|team)", false],
    ["overview", false],
    ["summary", false],
    ["your\\s+impact", false],
    ["day[-\\s]to[-\\s]day", false],
  ].map(([source, loose]) => ({ source, loose, category: REQUIRED })),
].map((heading) => ({
  ...heading,
  re: new RegExp(`(?<![A-Za-z0-9])(?:${heading.source})(?![A-Za-z0-9'’])`, "gi"),
}));

// "About Northwind" alone on a line: the company's own section
const ABOUT_COMPANY_LINE =
  /^about\s+(?!you\b|the\s+(?:role|job|position|team|opportunity)\b|this\b|the\s+company\b|us\b)[\w&.,'’ -]{1,40}$/i;

const PREFERRED_CUE =
  /\b(?:nice[-\s]to[-\s]have|preferred|preferably|(?:is|are|be|a|big|huge|definite|strong)\s+(?:a\s+)?(?:big\s+|huge\s+)?plus|pluses|bonus|ideally|desirable|good\s+to\s+have)\b/i;
const BOILERPLATE_CUE =
  /\bequal\s+(?:employment\s+)?opportunit(?:y|ies)\b|\bwithout\s+regard\s+to\b|\breasonable\s+accommodations?\b/i;

function lineBounds(text, index) {
  const start = index === 0 ? 0 : text.lastIndexOf("\n", index - 1) + 1;
  const end = text.indexOf("\n", index);
  return [start, end === -1 ? text.length : end];
}

const stripMarks = (line) => line.replace(/^[\s#*_>•·▪●◦■-]+/, "").replace(/[\s:：*_]+$/, "");

function headingMarkers(text) {
  const markers = [];
  for (const heading of HEADINGS) {
    heading.re.lastIndex = 0;
    for (const m of text.matchAll(heading.re)) {
      const start = m.index;
      const end = start + m[0].length;
      const [lineStart, lineEnd] = lineBounds(text, start);
      // Only short lines can be a heading line, so a 50,000-character
      // one-line posting isn't rescanned for every match
      const alone =
        lineEnd - lineStart <= m[0].length + 12 &&
        stripMarks(text.slice(lineStart, lineEnd)).toLowerCase() === m[0].toLowerCase();
      const atLineStart = start - lineStart <= 12 && stripMarks(text.slice(lineStart, start)) === "";
      const capital = /[A-Z]/.test(m[0][0]);
      const after = text.slice(end);
      const colonMatch = after.match(/^\s*[:：]/);
      const colon = Boolean(colonMatch) && (capital || atLineStart);
      const before = text[start - 1];
      const loose =
        heading.loose &&
        capital &&
        (before === undefined || /[\s.!?:;)\]]/.test(before)) &&
        /^(?:\s|$)/.test(after);
      if (!alone && !colon && !loose) continue;
      markers.push({ start, end: colon ? end + colonMatch[0].length : end, category: heading.category });
    }
  }
  // "About <Company>" on a line of its own
  let lineStart = 0;
  for (const line of text.split("\n")) {
    if (ABOUT_COMPANY_LINE.test(stripMarks(line))) {
      markers.push({
        start: lineStart + line.search(/about/i),
        end: lineStart + line.length,
        category: IGNORED,
      });
    }
    lineStart += line.length + 1;
  }
  // Earliest first, longest first at the same place; drop overlaps
  markers.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const marker of markers) {
    if (kept.length && marker.start < kept[kept.length - 1].end) continue;
    kept.push(marker);
  }
  return kept;
}

// Abbreviations a sentence does not end on: "e.g. Python", "B.S. in"
const ABBREVIATION =
  /(?:^|[\s(])(?:e\.g|i\.e|vs|incl|approx|sr|jr|inc|ltd|co|st|dr|u\.s|b\.s|b\.a|m\.s|m\.a|ph\.d|[a-z])\.$/i;
// Line breaks, bullets (" - " too, as flattened lists show them) and sentence ends
const BREAK = /\n|[•·▪●◦■]|\s[-–]\s(?=[A-Za-z])|(?<=[.!?;])\s+(?=[^a-z\s])/g;

function splitSentences(text, offset) {
  const out = [];
  let start = 0;
  const push = (end) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ text: trimmed, start: offset + start + lead });
  };
  for (const m of text.matchAll(BREAK)) {
    if (
      /^\s+$/.test(m[0]) &&
      !m[0].includes("\n") &&
      ABBREVIATION.test(text.slice(Math.max(0, m.index - 8), m.index))
    ) {
      continue;
    }
    push(m.index);
    start = m.index + m[0].length;
  }
  push(text.length);
  return out;
}

// The posting as sentences, each with how it counts
export function readSentences(description) {
  const text = String(description || "").replace(/\r\n?/g, "\n");
  const markers = headingMarkers(text);
  const sections = [];
  if (!markers.length || markers[0].start > 0) {
    sections.push({ start: 0, end: markers.length ? markers[0].start : text.length, category: REQUIRED });
  }
  markers.forEach((marker, i) => {
    sections.push({
      start: marker.start,
      end: i + 1 < markers.length ? markers[i + 1].start : text.length,
      category: marker.category,
    });
  });

  return sections.flatMap((section) =>
    splitSentences(text.slice(section.start, section.end), section.start).map((sentence) => {
      let category = section.category;
      if (BOILERPLATE_CUE.test(sentence.text)) category = IGNORED;
      else if (category === REQUIRED && PREFERRED_CUE.test(sentence.text)) category = PREFERRED;
      return { ...sentence, category };
    })
  );
}

function spellings(term) {
  return SKILL_ALIASES[term] || [term];
}

// Where the term first stands in a sentence as a whole word: [start, end], or null
const patterns = new Map();
function wordPattern(spelling) {
  if (!patterns.has(spelling)) patterns.set(spelling, termPattern(spelling, "i"));
  return patterns.get(spelling);
}

function spanIn(sentence, term) {
  let best = null;
  for (const spelling of spellings(term)) {
    const m = wordPattern(spelling).exec(sentence);
    if (m && (!best || m.index < best[0])) best = [m.index, m.index + m[0].length];
  }
  return best;
}

// Offset of the term inside a sentence, for ordering by first appearance
const offsetIn = (sentence, term) => spanIn(sentence, term)?.[0] ?? 0;

// Text between two terms that makes them alternatives: "or", optionally after
// a comma. A comma alone continues a run until its "or" ("Python, Go, or Rust").
const OR_GAP = /^\s*,?\s*or\s+(?:an?\s+)?$/i;
const COMMA_GAP = /^\s*,\s*$/;

// Runs of terms joined by "or" in one sentence or list item: "TypeScript or
// JavaScript", "Python, Go, or Rust". Not "/" and not "and". Degrees have their
// own rule. Returns [groups, terms named outside any group].
function alternativesIn(sentence, terms) {
  const hits = terms
    .filter((term) => !isDegree(term))
    .map((term) => ({ term, span: spanIn(sentence, term) }))
    .filter((hit) => hit.span)
    .sort((a, b) => a.span[0] - b.span[0]);
  const groups = [];
  let run = [];
  let hasOr = false;
  const close = () => {
    if (hasOr && run.length > 1) groups.push(run.map((hit) => hit.term));
    run = [];
    hasOr = false;
  };
  hits.forEach((hit, i) => {
    const previous = hits[i - 1];
    const gap = previous ? sentence.slice(previous.span[1], hit.span[0]) : null;
    // A comma after the "or" starts a new list: "TypeScript or JavaScript, Python"
    const joins =
      gap !== null &&
      previous.span[1] <= hit.span[0] &&
      (OR_GAP.test(gap) || (!hasOr && COMMA_GAP.test(gap)));
    if (joins) {
      if (OR_GAP.test(gap)) hasOr = true;
      run.push(hit);
    } else {
      close();
      run = [hit];
    }
  });
  close();
  const grouped = new Set(groups.flat());
  return [groups, terms.filter((term) => !grouped.has(term))];
}

// Words that name the kind of job, not something a candidate can show or lack.
// "Backend services" in a posting is not a gap for someone whose CV says
// "built Python services", and a job title is not evidence of a skill, so
// these are never requirements. The degree requirement covers "computer science".
const ROLE_PHRASES = new Set([
  "software engineering",
  "full stack",
  "frontend",
  "backend",
  "cloud engineering",
  "data engineering",
  "computer science",
  "project management",
  "product management",
]);

/**
 * The requirements a posting states, as { term, importance, position } in
 * order of first appearance. Terms only in boilerplate are left out; a term
 * stated as both required and preferred is required.
 *
 * Also returns `alternatives`, the runs of terms joined by "or", and
 * `standalone`, the terms also asked for on their own somewhere.
 */
export function readRequirements(sentences, description) {
  const alternatives = [];
  const standalone = new Set();
  const seen = new Set();
  // Repetitive postings repeat sentences; read each distinct one once
  const keywordCache = new Map();
  const keywordsOf = (text) => {
    if (!keywordCache.has(text)) keywordCache.set(text, extractKeywords(text));
    return keywordCache.get(text);
  };
  const found = new Map();
  const note = (term, category, position) => {
    const entry = found.get(term) || { term, required: false, preferred: false, position };
    if (category === REQUIRED) entry.required = true;
    if (category === PREFERRED) entry.preferred = true;
    entry.position = Math.min(entry.position, position);
    found.set(term, entry);
  };

  for (const sentence of sentences) {
    if (sentence.category === IGNORED) continue;
    const terms = keywordsOf(sentence.text);
    for (const term of terms) {
      note(term, sentence.category, sentence.start + offsetIn(sentence.text, term));
    }
    const [groups, alone] = alternativesIn(sentence.text, terms);
    alone.forEach((term) => standalone.add(term));
    for (const group of groups) {
      const key = group.join("|");
      if (!seen.has(key)) alternatives.push(group);
      seen.add(key);
    }
  }

  // Terms that need the whole posting for context ("Languages:\n- Python\n- Go")
  for (const term of extractKeywords(String(description || ""))) {
    if (found.has(term)) continue;
    const holders = sentences.filter((s) =>
      spellings(term).some((spelling) => containsTerm(s.text, spelling))
    );
    const counted = holders.filter((s) => s.category !== IGNORED);
    if (holders.length && !counted.length) continue; // boilerplate only
    standalone.add(term);
    if (!counted.length) {
      note(term, REQUIRED, String(description).length);
      continue;
    }
    for (const sentence of counted)
      note(term, sentence.category, sentence.start + offsetIn(sentence.text, term));
  }

  const requirements = [...found.values()]
    .filter((entry) => !ROLE_PHRASES.has(entry.term))
    .sort((a, b) => a.position - b.position)
    .map(({ term, required, position }) => ({ term, importance: required ? REQUIRED : PREFERRED, position }));
  return { requirements, alternatives, standalone };
}

// The posting without its boilerplate, for the years requirement
export function countedText(sentences) {
  return sentences
    .filter((s) => s.category !== IGNORED)
    .map((s) => s.text)
    .join("\n");
}

// Spoken languages a posting can ask for. English is left out: a posting
// written in English that asks for English is not a line worth flagging.
const LANGUAGES = [
  "Arabic",
  "Bengali",
  "Cantonese",
  "Chinese",
  "Czech",
  "Danish",
  "Dutch",
  "Farsi",
  "Finnish",
  "French",
  "German",
  "Greek",
  "Hebrew",
  "Hindi",
  "Hungarian",
  "Indonesian",
  "Italian",
  "Japanese",
  "Korean",
  "Malay",
  "Mandarin",
  "Norwegian",
  "Persian",
  "Polish",
  "Portuguese",
  "Punjabi",
  "Romanian",
  "Russian",
  "Spanish",
  "Swahili",
  "Swedish",
  "Tagalog",
  "Tamil",
  "Telugu",
  "Thai",
  "Turkish",
  "Ukrainian",
  "Urdu",
  "Vietnamese",
];
// Capitalised only: "Polish" the language, not "polish the product"
const LANGUAGE_NAME = new RegExp(`\\b(?:${LANGUAGES.join("|")})\\b`, "g");
// Words that make a named language something the candidate must speak
const LANGUAGE_CUE =
  /\b(?:fluen(?:t|cy)|proficien(?:t|cy)|bilingual|native(?:[-\s]level)?|speak(?:s|ers?|ing)?|spoken|conversational|business[-\s]level|language\s+skills?)\b/i;

const languagesIn = (text) => (LANGUAGE_CUE.test(text) ? [...new Set(text.match(LANGUAGE_NAME) || [])] : []);

/**
 * The spoken languages the posting requires, in order of appearance. Only
 * required sentences count: a language in a nice-to-have list or in the
 * company's own description is not a requirement.
 */
export function readLanguages(sentences) {
  const found = [];
  for (const sentence of sentences) {
    if (sentence.category !== REQUIRED) continue;
    for (const name of languagesIn(sentence.text)) if (!found.includes(name)) found.push(name);
  }
  return found;
}

// Sentences only the user can judge. Quoted, never scored.
const CHECKS = [
  {
    kind: "work-authorization",
    re: /\b(?:visa\s+)?sponsor(?:ship|ed|ing)?\b|\bwork(?:ing)?\s+(?:authori[sz]ation|permit|visa)\b|\bauthori[sz]ed\s+to\s+work\b|\bH-?1B\b|\bright\s+to\s+work\b|\bwork\s+authori[sz]ed\b/i,
  },
  { kind: "clearance", re: /\b(?:security\s+)?clearance\b|\bTS\/SCI\b|\btop\s+secret\b|\bpublic\s+trust\b/i },
  { kind: "citizenship", re: /\bcitizen(?:ship|s)?\b/i },
  {
    kind: "onsite",
    re: /\b(?:on[-\s]?site|in[-\s](?:the[-\s])?office|in[-\s]person|hybrid|days?\s+(?:a|per)\s+week\s+(?:in|at|from))\b/i,
    // ...in a named place: "in our Denver office", "at the Austin, TX campus"
    also: /\b(?:in|at|from|near|out\s+of)\s+(?:our\s+|the\s+)?(?!(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Our|The)\b)[A-Z][A-Za-z.]+/,
  },
  { kind: "relocation", re: /\breloca(?:te|tion|ting)\b/i },
  { kind: "travel", re: /\btravel/i, also: /\d{1,3}\s?(?:%|percent)/i },
  // Where the candidate must be: "must be based in Chicago", "you're located
  // or willing to work from Seoul". Not where the company says it is.
  {
    kind: "location",
    re: /\b(?:must|needs?\s+to|should|required\s+to|able\s+to|willing\s+to|you(?:['’]re|\s+are)|candidates?|applicants?)\b[^.;\n]{0,40}?\b(?:located|based|resid(?:e|es|ing|ent)|live|living|work(?:ing)?\s+from)\b/i,
    also: /\b(?:located|based|resid(?:e|es|ing|ent)|live|living|from)\s+(?:(?:in|within|near|around)\s+)?(?:the\s+)?[A-Z][A-Za-z.]+/,
  },
  // A spoken language other than English, outside the company's boilerplate
  {
    kind: "language",
    re: LANGUAGE_CUE,
    test: (sentence) => sentence.category !== IGNORED && languagesIn(sentence.text).length > 0,
  },
];
const CHECK_CAP = 200;

export function findChecks(sentences) {
  const checks = [];
  for (const check of CHECKS) {
    for (const sentence of sentences) {
      // A list item is quoted without its dash
      const text = sentence.text.replace(/^[-–*]\s+/, "");
      const m = text.match(check.re);
      if (!m || (check.also && !check.also.test(text))) continue;
      if (check.test && !check.test(sentence)) continue;
      checks.push({
        kind: check.kind,
        quote: clipAround(text, m.index, m.index + m[0].length, CHECK_CAP),
      });
      break;
    }
  }
  return checks;
}
