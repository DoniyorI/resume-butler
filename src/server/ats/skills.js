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

// How many hits either side of one are compared, and how far apart two listed
// skills may be. Both bound the work on a long or repetitive posting.
const NEIGHBOURS = 6;
const MAX_LIST_GAP = 12;
const CONTEXT_AFTER = 60;

function adjacent(a, b, gapPattern, text) {
  if (a.start < b.end && b.start < a.end) return true; // overlapping: "Ruby" in "Ruby on Rails"
  const [from, to] = a.end <= b.start ? [a.end, b.start] : [b.end, a.start];
  if (to - from > MAX_LIST_GAP) return false;
  const gap = text.slice(from, to);
  return gap.trim() !== "" && gapPattern.test(gap);
}

// The skills (SKILL_ALIASES keys) that `text` names, under the rules above.
// `technical: true` is for the user's own resume, which is technical writing
// throughout: there the exact spelling ("Go", "Express") is enough without a
// surrounding context, so "Built APIs with Node and Express" is not reported
// as missing Node or Express.
export function matchSkills(text, { technical = false } = {}) {
  const hits = [];
  for (const { skill, re, rule } of CANDIDATE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const hit = { skill, start: m.index, end: m.index + m[0].length, exact: true, accepted: !rule };
      if (rule) {
        hit.exact = rule.forms.includes(m[0]);
        const inContext =
          INTRO_BEFORE.test(text.slice(Math.max(0, hit.start - 40), hit.start)) ||
          TECH_AFTER.test(text.slice(hit.end, hit.end + CONTEXT_AFTER));
        hit.accepted = hit.exact && (!rule.context || inContext || technical);
      }
      hits.push(hit);
    }
  }

  // Listed skills sit next to each other in the text, so each hit is compared
  // only with its few neighbours in position order. That keeps the work linear
  // in the text length however many times a word repeats.
  hits.sort((a, b) => a.start - b.start || a.end - b.end);
  const neighbour = (i, test) => {
    const last = Math.min(hits.length - 1, i + NEIGHBOURS);
    for (let j = Math.max(0, i - NEIGHBOURS); j <= last; j++) {
      if (j !== i && hits[j].skill !== hits[i].skill && test(hits[j])) return true;
    }
    return false;
  };
  // Accept a hit listed next to an accepted skill. A forward then a backward
  // pass carries acceptance along a whole list ("Python, Go, and Rust").
  const spread = () => {
    const visit = (i) => {
      const hit = hits[i];
      if (hit.accepted) return;
      const gap = hit.exact ? LIST_GAP : STRONG_LIST_GAP;
      if (neighbour(i, (other) => other.accepted && adjacent(hit, other, gap, text))) hit.accepted = true;
    };
    for (let i = 0; i < hits.length; i++) visit(i);
    for (let i = hits.length - 1; i >= 0; i--) visit(i);
  };
  spread();

  // Two exact spellings joined as a list vouch for each other: "Node and
  // Express", "Go, Rust"
  const paired = hits.filter(
    (hit, i) =>
      !hit.accepted && hit.exact && neighbour(i, (other) => !other.accepted && other.exact && adjacent(hit, other, LIST_GAP, text))
  );
  if (paired.length) {
    for (const hit of paired) hit.accepted = true;
    spread();
  }

  // In SKILL_ALIASES order, so results are stable
  const found = new Set(hits.filter((hit) => hit.accepted).map((hit) => hit.skill));
  return new Set(Object.keys(SKILL_ALIASES).filter((skill) => found.has(skill)));
}
