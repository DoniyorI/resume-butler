import assert from "node:assert/strict";
import { test } from "node:test";
import { extractKeywords, extractYearsRequirement, findInResume } from "@/server/ats/keywords";
import { matchSkills } from "@/server/ats/skills";
import { scoreResume } from "@/server/ats/score";

const skillsOnly = { skills: [{ header: "Languages", skills: "Python, SQL" }] };
const fullResume = {
  header: { name: "Ada Lovelace", email: "ada@example.com" },
  education: [{ school: "State University", degreeType: "B.S.", major: "Computer Science" }],
  experience: [{ companyName: "Acme", position: "Engineer", description: ["Built Python services handling 2M requests a day", "Reduced SQL query time by 40% with indexes"] }],
  projects: [],
  skills: [{ header: "Languages", skills: "Python, SQL, Docker" }],
};

// 1. Empty or thin resumes get no credit
test("an empty resume is not scored", () => {
  const result = scoreResume("Python and SQL engineer", {});
  assert.equal(result.status, "empty");
  assert.equal(result.overallScore, null);
  assert.equal(result.qualityScore, null);
  for (const key of ["keywordScore", "sectionScore", "totalKeywords", "matched", "missing", "sectionChecks", "bulletFeedback", "yearsRequired"]) {
    assert.ok(key in result, key);
  }
});

test("a header-only resume counts as empty", () => {
  const result = scoreResume("Python and SQL engineer", { header: { name: "Ada", email: "ada@example.com", github: "github.com/ada" } });
  assert.equal(result.status, "empty");
  assert.equal(result.overallScore, null);
});

test("a posting with no recognised keywords has no overall or keyword score", () => {
  const result = scoreResume("We value thoughtful collaboration and curiosity every day.", skillsOnly);
  assert.equal(result.status, "no-keywords");
  assert.equal(result.totalKeywords, 0);
  assert.equal(result.keywordScore, null);
  assert.equal(result.overallScore, null);
  assert.equal(typeof result.sectionScore, "number");
});

test("overall score renormalises over the components that are rated", () => {
  const result = scoreResume("Python and Kubernetes engineer", skillsOnly);
  assert.equal(result.status, "ok");
  assert.equal(result.qualityScore, null); // no experience or projects: no quality checks
  assert.equal(result.keywordScore, 50);
  assert.equal(result.sectionScore, 25);
  assert.equal(result.overallScore, Math.round((50 * 0.5 + 25 * 0.2) / 0.7));
});

test("overall score uses all three weights when every component is rated", () => {
  const result = scoreResume("Python and SQL engineer", fullResume);
  assert.equal(result.status, "ok");
  assert.equal(typeof result.qualityScore, "number");
  const expected = Math.round(result.keywordScore * 0.5 + result.sectionScore * 0.2 + result.qualityScore * 0.3);
  assert.equal(result.overallScore, expected);
});

// 3. Terms with symbols
test("C++ and C# are extracted without matching C or other words", () => {
  const keywords = extractKeywords("C++ and C# developers");
  assert.ok(keywords.includes("c++"));
  assert.ok(keywords.includes("c#"));
  assert.ok(findInResume("c++", "Wrote C++ drivers"));
  assert.ok(!findInResume("c++", "Wrote C drivers"));
  assert.ok(findInResume("c#", "Built C# services."));
});

test("java does not match javascript and js does not come from Node.js", () => {
  assert.deepEqual(extractKeywords("JavaScript developer"), ["javascript"]);
  assert.ok(!findInResume("java", "JavaScript and TypeScript"));
  assert.ok(!extractKeywords("Experience with Node.js").includes("javascript"));
});

// 4. Years are a note, not a keyword
test("years of experience are not keywords", () => {
  const keywords = extractKeywords("Python engineer with 5+ years of experience");
  assert.deepEqual(keywords, ["python"]);
});

test("extractYearsRequirement reads the smallest stated requirement", () => {
  assert.equal(extractYearsRequirement("5+ years of experience with Python"), 5);
  assert.equal(extractYearsRequirement("3-5 years of professional experience"), 3);
  assert.equal(extractYearsRequirement("3 to 5 years experience"), 3);
  assert.equal(extractYearsRequirement("at least 2 years in backend roles"), 2);
  assert.equal(extractYearsRequirement("a minimum of 4 years building APIs"), 4);
  assert.equal(extractYearsRequirement("minimum 6 years"), 6);
  assert.equal(extractYearsRequirement("7+ years overall, 2+ years with Go"), 2);
  assert.equal(extractYearsRequirement("three years of experience"), 3);
  assert.equal(extractYearsRequirement("Founded 10 years ago, we have grown for 10 years running."), null);
  assert.equal(extractYearsRequirement("No requirement here"), null);
  assert.equal(scoreResume("Python engineer, 5+ years of experience", skillsOnly).yearsRequired, 5);
});

// 5. Ordinary English is not a requirement
const noSkill = [
  "We go above and beyond",
  "Go above and beyond for customers.",
  "what comes next",
  "the rest of the team",
  "express interest",
  "Spring 2027 internship",
  "Join our Spring 2027 internship program",
  "a swift response",
  "a node in our org chart",
  "react quickly to change",
  "Rest assured, we will be in touch. Next, we schedule a call.",
];
for (const text of noSkill) {
  test(`no skill from "${text}"`, () => {
    assert.deepEqual([...matchSkills(text)], []);
  });
}

const withSkill = [
  ["Python, Go, and Rust", ["python", "go", "rust"]],
  ["experience with Go", ["go"]],
  ["Golang", ["go"]],
  ["Next.js", ["next.js"]],
  ["Express.js", ["express"]],
  ["REST APIs", ["rest api"]],
  ["Spring Boot", ["spring"]],
  ["Swift/Kotlin", ["swift", "kotlin"]],
  ["C++ and C#", ["c++", "c#"]],
  ["C/C++", ["c++"]],
  ["Strong React skills", ["react"]],
  ["AI and ML", ["ai", "machine learning"]],
];
for (const [text, skills] of withSkill) {
  test(`skills found in "${text}"`, () => {
    const found = matchSkills(text);
    for (const skill of skills) assert.ok(found.has(skill), `${skill} in ${[...found]}`);
  });
}

test("short acronyms only count in upper case", () => {
  assert.ok(!matchSkills("ai ml dl js ts py").size);
  assert.ok(matchSkills("JS and TS").has("javascript"));
});

test("aliases for a different concept are gone", () => {
  assert.ok(!matchSkills("Design an API for authentication with real-time updates").has("rest api"));
  assert.ok(!matchSkills("authentication").has("oauth"));
  assert.ok(!matchSkills("real-time dashboards").has("websocket"));
  assert.ok(!extractKeywords("Data engineer").includes("data science"));
});

test("degree patterns ignore Scrum master, master branch, mastery and master data", () => {
  for (const text of ["Scrum master certification", "merge to the master branch", "mastery of SQL", "master data management", "masters of their craft"]) {
    const keywords = extractKeywords(text);
    assert.ok(!keywords.some((k) => /degree|PhD/.test(k)), `${text}: ${keywords}`);
  }
});

test("degree patterns fire on real degree mentions", () => {
  const cases = [
    ["Master's degree required", "master's degree"],
    ["Masters in Computer Science", "master's degree"],
    ["MS in Computer Science", "master's degree"],
    ["Master of Science", "master's degree"],
    ["Bachelor's degree in CS", "bachelor's degree"],
    ["BS in Computer Science", "bachelor's degree"],
    ["B.S. in Computer Science", "bachelor's degree"],
    ["BA or equivalent", "bachelor's degree"],
    ["BSc in Mathematics", "bachelor's degree"],
    ["Bachelor of Engineering", "bachelor's degree"],
    ["PhD preferred", "PhD"],
    ["Ph.D. in Physics", "PhD"],
    ["a doctorate in statistics", "PhD"],
  ];
  for (const [text, label] of cases) assert.ok(extractKeywords(text).includes(label), `${text}: ${extractKeywords(text)}`);
});

test("degree keywords are matched by level", () => {
  const edu = (degreeType, major = "Computer Science") => ({ education: [{ school: "State University", degreeType, major }], skills: ["Python"] });
  const score = (jd, resume) => scoreResume(jd, resume);
  assert.deepEqual(score("Bachelor's degree required", edu("B.S.")).matched, ["bachelor's degree"]);
  assert.deepEqual(score("Bachelor's degree required", edu("Bachelor of Science")).matched, ["bachelor's degree"]);
  assert.deepEqual(score("Bachelor's degree required", edu("BS")).matched, ["bachelor's degree"]);
  assert.deepEqual(score("Bachelor's degree required", edu("MS")).matched, ["bachelor's degree"]);
  assert.deepEqual(score("Master's degree required", edu("PhD")).matched, ["master's degree"]);
  assert.deepEqual(score("Master's degree required", edu("B.S.")).missing, ["master's degree"]);
  assert.deepEqual(score("PhD required", edu("Master of Science")).missing, ["PhD"]);
  // "MS" outside education (e.g. MS Office) is not a degree
  assert.ok(!findInResume("master's degree", "Expert in MS Office"));
});

test("the example posting gives honest keywords", () => {
  const jd = "We need a Python and SQL engineer with 5+ years of experience. C++ and C# developers who go above and beyond. Scrum master certification a plus.";
  const keywords = extractKeywords(jd);
  for (const k of ["python", "sql", "c++", "c#", "scrum"]) assert.ok(keywords.includes(k), k);
  for (const k of ["go", "master's degree"]) assert.ok(!keywords.includes(k), k);
  assert.ok(!keywords.some((k) => /year/.test(k)));
  const result = scoreResume(jd, {});
  assert.equal(result.status, "empty");
  assert.equal(result.overallScore, null);
  assert.equal(result.yearsRequired, 5);
});

test("exact spellings joined as a list vouch for each other in a posting", () => {
  const found = matchSkills("You will build React apps with Node and Express.");
  assert.ok(found.has("node.js") && found.has("express") && found.has("react"));
  assert.ok(!matchSkills("Go and see what comes Next").has("go"));
});

test("a resume counts exact spellings without needing a context", () => {
  const text = "Built billing APIs with Node and Express. Rewrote the parser in Go.";
  const found = matchSkills(text, { technical: true });
  assert.ok(found.has("node.js") && found.has("express") && found.has("go"));
  assert.ok(!matchSkills("we go above and beyond", { technical: true }).has("go"));
});

test("a posting that says Scrum is reported as scrum, not as a word it never used", () => {
  const keywords = extractKeywords("Scrum master certification is a plus.");
  assert.ok(keywords.includes("scrum"));
  assert.ok(!keywords.includes("agile"));
});
