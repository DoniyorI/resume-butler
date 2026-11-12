import "server-only";

// Known skills and the spellings that count as the same skill. Every alias is
// the same thing under another name; broader or neighbouring concepts
// ("api", "authentication", "real-time", "containers", "version control",
// "serverless", "unix", "infrastructure as code") are not aliases. Some of
// those are skills of their own below. Kept as plain lowercase strings because
// src/server/resume/guardrails.js reads them too.
export const SKILL_ALIASES = {
  javascript: ["js", "javascript", "ecmascript"],
  typescript: ["ts", "typescript"],
  python: ["python", "py"],
  react: ["react", "reactjs", "react.js"],
  "react native": ["react native"],
  "next.js": ["next", "nextjs", "next.js"],
  "node.js": ["node", "nodejs", "node.js"],
  express: ["express", "expressjs", "express.js"],
  mongodb: ["mongodb", "mongo"],
  postgresql: ["postgresql", "postgres", "psql"],
  mysql: ["mysql"],
  aws: ["aws", "amazon web services"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  azure: ["azure", "microsoft azure"],
  docker: ["docker"],
  containerization: ["containerization"],
  kubernetes: ["kubernetes", "k8s"],
  "ci/cd": ["ci/cd", "cicd", "continuous integration", "continuous deployment", "continuous delivery"],
  git: ["git"],
  "version control": ["version control"],
  github: ["github"],
  "rest api": ["rest", "restful", "rest api", "rest apis"],
  graphql: ["graphql"],
  sql: ["sql"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  tailwind: ["tailwind", "tailwindcss"],
  redux: ["redux"],
  vue: ["vue", "vuejs", "vue.js"],
  angular: ["angular", "angularjs"],
  java: ["java"],
  "c++": ["c++", "cpp"],
  "c#": ["c#", "csharp", "c sharp"],
  go: ["go", "golang"],
  rust: ["rust"],
  swift: ["swift", "swiftui"],
  kotlin: ["kotlin"],
  ruby: ["ruby"],
  rails: ["rails", "ruby on rails"],
  django: ["django"],
  flask: ["flask"],
  spring: ["spring", "spring boot", "springboot", "spring framework"],
  terraform: ["terraform"],
  "infrastructure as code": ["infrastructure as code", "iac"],
  linux: ["linux"],
  unix: ["unix"],
  agile: ["agile"],
  scrum: ["scrum"],
  kanban: ["kanban"],
  "machine learning": ["machine learning", "ml"],
  "deep learning": ["deep learning", "dl"],
  ai: ["ai", "artificial intelligence"],
  "data structures": ["data structures"],
  algorithms: ["algorithms"],
  microservices: ["microservices", "micro-services"],
  redis: ["redis"],
  elasticsearch: ["elasticsearch", "elastic search"],
  kafka: ["kafka"],
  rabbitmq: ["rabbitmq"],
  webpack: ["webpack"],
  vite: ["vite"],
  jest: ["jest"],
  testing: ["testing", "unit testing", "integration testing", "e2e testing"],
  selenium: ["selenium"],
  firebase: ["firebase"],
  supabase: ["supabase"],
  figma: ["figma"],
  jira: ["jira"],
  oauth: ["oauth", "oauth2"],
  websocket: ["websocket", "websockets"],
  s3: ["s3"],
  ec2: ["ec2"],
  lambda: ["lambda"],
  serverless: ["serverless"],
};

// A requirement for the key is also met by any of these skills on the resume
// (Docker on a resume shows containerization; not the other way round)
export const SATISFIED_BY = {
  containerization: ["docker", "kubernetes"],
  "version control": ["git", "github"],
  "infrastructure as code": ["terraform"],
  serverless: ["lambda"],
};

// Aliases that are also ordinary English or ordinary letters. The rule:
// - `forms` are the exact spellings (case-sensitive) that may count: "AI" but
//   never "ai", "Go" but never "go".
// - `context: true` aliases are everyday words ("go", "next", "rest of",
//   "express interest", "Spring 2027"), so even the exact spelling counts only
//   in a technical context: right after an introducing phrase ("experience
//   with", "proficient in", "using", "such as", "Languages:"), right before a
//   technical noun ("developer", "framework", "services", "skills"), or listed
//   next to another recognised skill ("Python, Go, and Rust", "Swift/Kotlin").
// - Any spelling (even lower case) counts when it sits in a comma or slash list
//   right next to another recognised skill ("python, go, rust").
// Sentence-initial "Go is our main language" is missed on purpose: a missed
// "go" is safer than reporting a requirement the posting never stated.
export const ALIAS_RULES = {
  js: { forms: ["JS"] },
  ts: { forms: ["TS"] },
  py: { forms: ["PY"] },
  ai: { forms: ["AI"] },
  ml: { forms: ["ML"] },
  dl: { forms: ["DL"] },
  rest: { forms: ["REST"] },
  react: { forms: ["React"] },
  angular: { forms: ["Angular"] },
  jest: { forms: ["Jest"] },
  flask: { forms: ["Flask"] },
  tailwind: { forms: ["Tailwind"] },
  go: { forms: ["Go"], context: true },
  next: { forms: ["Next"], context: true },
  node: { forms: ["Node"], context: true },
  express: { forms: ["Express"], context: true },
  spring: { forms: ["Spring"], context: true },
  swift: { forms: ["Swift"], context: true },
  rust: { forms: ["Rust"], context: true },
  ruby: { forms: ["Ruby"], context: true },
  rails: { forms: ["Rails"], context: true },
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A term surrounded by anything that can't continue it. \b fails after "+" or
// "#", so this spells the edges out: no letter or digit on either side, no
// "+" or "#" after ("c" is not in "c++"), and no dotted continuation ("js" is
// not in "Node.js", "java" is not in "java.util").
export function termPattern(term, flags = "gi") {
  return new RegExp(
    `(?<![A-Za-z0-9_])(?<![A-Za-z0-9]\\.)${escapeRegExp(term)}(?![A-Za-z0-9_+#])(?!\\.[A-Za-z0-9])`,
    flags
  );
}

export function containsTerm(text, term) {
  return termPattern(term, "i").test(text);
}

const INTRO_BEFORE =
  /(?:\b(?:experience|experienced|proficien(?:t|cy)|fluen(?:t|cy)|expertise|knowledge|familiar(?:ity)?|skilled|background|comfortable|written|built|developed|develop|develops|build|building|programming|coding)\s+(?:in|with|using|of)(?:\s+the)?|\b(?:using|such as|e\.g\.,?|languages?\s*:|frameworks?\s*:|skills\s*:|stack\s*:|technologies\s*:))\s*$/i;
const TECH_AFTER =
  /^\s*(?:developers?|engineers?|engineering|programming|programmers?|language|frameworks?|code(?:base)?s?|services?|microservices|backends?|apis?|sdks?|modules?|runtime|ecosystem|experience|skills|development|servers?)\b/i;
// Text between two listed skills: separators, optionally "and"/"or"
const LIST_GAP = /^[\s,/|&;()+]*(?:(?:and|or)\b[\s(]*)?$/i;
const STRONG_LIST_GAP = /^\s*[,/|]\s*$/;

const CANDIDATE_PATTERNS = Object.entries(SKILL_ALIASES).flatMap(([skill, aliases]) =>
  aliases.map((alias) => ({ skill, re: termPattern(alias), rule: ALIAS_RULES[alias] }))
);

function adjacent(a, b, gapPattern, text) {
  if (a.start < b.end && b.start < a.end) return true; // overlapping: "Ruby" in "Ruby on Rails"
  const gap = a.end <= b.start ? text.slice(a.end, b.start) : text.slice(b.end, a.start);
  return gap.trim() !== "" && gapPattern.test(gap);
}

// The skills (SKILL_ALIASES keys) that `text` names, under the rules above.
// `technical: true` is for the user's own resume, which is technical writing
// throughout: there the exact spelling ("Go", "Express") is enough without a
// surrounding context, so "Built APIs with Node and Express" is not reported
// as missing Node or Express.
export function matchSkills(text, { technical = false } = {}) {
  const accepted = [];
  const pending = [];
  for (const { skill, re, rule } of CANDIDATE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const hit = { skill, start: m.index, end: m.index + m[0].length };
      if (!rule) {
        accepted.push(hit);
        continue;
      }
      hit.exact = rule.forms.includes(m[0]);
      const inContext =
        INTRO_BEFORE.test(text.slice(Math.max(0, hit.start - 40), hit.start)) || TECH_AFTER.test(text.slice(hit.end));
      if (hit.exact && (!rule.context || inContext || technical)) accepted.push(hit);
      else pending.push(hit);
    }
  }

  // Listed next to an accepted skill; repeat so "Python, Go, and Rust" chains
  let changed = true;
  while (changed && pending.length) {
    changed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const hit = pending[i];
      const gap = hit.exact ? LIST_GAP : STRONG_LIST_GAP;
      if (accepted.some((other) => other.skill !== hit.skill && adjacent(hit, other, gap, text))) {
        accepted.push(hit);
        pending.splice(i, 1);
        changed = true;
      }
    }
  }

  // Two exact spellings joined as a list vouch for each other: "Node and
  // Express", "Go, Rust"
  const paired = pending.filter(
    (hit) =>
      hit.exact &&
      pending.some((other) => other.exact && other.skill !== hit.skill && adjacent(hit, other, LIST_GAP, text))
  );
  accepted.push(...paired);

  // In SKILL_ALIASES order, so results are stable
  const found = new Set(accepted.map((hit) => hit.skill));
  return new Set(Object.keys(SKILL_ALIASES).filter((skill) => found.has(skill)));
}
