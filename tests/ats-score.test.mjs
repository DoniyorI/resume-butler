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

test("a long repetitive posting is matched in linear time", () => {
  const text = "go, ".repeat(12_000) + "Python";
  const started = performance.now();
  const found = matchSkills(text);
  assert.ok(performance.now() - started < 2000, "matchSkills took too long");
  assert.ok(found.has("python"));
  const spaced = ("Go and " + " ".repeat(40) + "Express ").repeat(500);
  assert.ok(!matchSkills(spaced).has("go"));
});

// Bulleted and one-per-line lists
test("a bulleted requirements list counts each whole-line skill", () => {
  const found = matchSkills("Requirements\n- Rust\n- Swift\n- Kotlin\n- 8+ years");
  for (const skill of ["rust", "swift", "kotlin"]) assert.ok(found.has(skill), skill);
  const bare = matchSkills("What you need\nRust\nGo\nSwift");
  for (const skill of ["rust", "go", "swift"]) assert.ok(bare.has(skill), skill);
  const numbered = matchSkills("1. Spark\n2. Airflow\n3) dbt");
  for (const skill of ["spark", "airflow", "dbt"]) assert.ok(numbered.has(skill), skill);
  // A lower-case word on its own line counts only between listed skills
  assert.ok(matchSkills("• Python\n• go\n• SQL").has("go"));
  assert.ok(!matchSkills("Python\ngo above and beyond").has("go"));
  assert.ok(!matchSkills("Our values\nWe go above and beyond\nwhat comes next").size);
});

// Each ambiguous alias: a sentence where it must not count and one where it must
const AMBIGUOUS = [
  ["r", "Our R&D team ships monthly. Grade R students.", "Experience in Python, R and SQL"],
  ["r", "Plan R is our backup.", "Strong R programming skills"],
  ["c", "C-suite reporting. Series C startup.", "C, C++ and Rust"],
  ["dart", "We play dart games on Fridays. Dart over to the office.", "Mobile apps in Flutter and Dart"],
  ["julia", "Julia leads the hiring panel.", "Experience with Julia or Python"],
  ["elixir", "Coffee is our elixir.", "Backend services written in Elixir"],
  ["solidity", "The solidity of our finances. Solidity matters here.", "Smart contracts in Solidity developer role: Solidity, Rust"],
  ["groovy", "A groovy office. Groovy vibes.", "Jenkins pipelines using Groovy"],
  ["bash", "Our summer bash is legendary. Bash on the roof.", "Scripting in Bash, Python"],
  ["shell scripting", "Shell out for snacks. We came out of our shell.", "Linux, Shell, Python"],
  ["flutter", "Hearts flutter at launch. Flutter of activity.", "Experience with Flutter"],
  ["core data", "Our core data platform. Core Data is a team name here.", "Using Core Data and UIKit"],
  ["remix", "Remix the playlist. remix your ideas.", "Frameworks: Remix, Next.js"],
  ["bootstrap", "We bootstrap new hires. Bootstrap the startup.", "Responsive pages with Bootstrap, Sass"],
  ["storybook", "A storybook ending. Storybook moment.", "Component docs using Storybook"],
  ["hibernate", "Bears hibernate in winter. Hibernate mode.", "Java, Spring and Hibernate"],
  ["d3", "Vitamin D3 included. Take D3 daily.", "Charts in D3 and React"],
  ["oracle", "Oracle is one of our clients. Ask the oracle.", "Databases: Oracle, PostgreSQL"],
  ["cassandra", "Cassandra runs recruiting.", "Experience with Cassandra or DynamoDB"],
  ["snowflake", "Every snowflake is unique. Snowflake season.", "Warehousing in Snowflake, BigQuery"],
  ["spark", "Spark joy in our customers. Be the spark.", "Using Spark and Kafka"],
  ["hive", "A hive of activity. Hive mind.", "Hadoop, Hive and Spark"],
  ["airflow", "Airflow in the server room matters. Good airflow.", "Orchestration using Airflow"],
  ["pandas", "We sponsor pandas at the zoo.", "Analysis with pandas, NumPy"],
  ["rag", "A RAG status report. Use a rag to wipe.", "Experience with RAG, LLMs"],
  ["looker", "She is a looker. Looker of the year.", "Dashboards using Looker"],
  ["excel", "We excel at service. Excel at what you do.", "Proficient in Excel"],
  ["chef", "Our chef makes lunch. Chef's kiss.", "Configuration using Chef, Ansible"],
  ["puppet", "Not a puppet of management. Puppet show.", "Ansible, Puppet"],
  ["helm", "Take the helm of the team. Helm of the project.", "Deploys with Helm, Kubernetes"],
  ["vagrant", "No vagrant thoughts. Vagrant Story fans.", "Local boxes using Vagrant"],
  ["packer", "Warehouse packer wanted. Packer shifts.", "Images built with Packer, Terraform"],
  ["consul", "Consul general visit. The Consul attends.", "Service discovery using Consul"],
  ["envoy", "Our envoy to Europe. Envoy program.", "Proxies: Envoy, Nginx"],
  ["sentry", "The sentry at the gate. Sentry duty.", "Error tracking with Sentry, Datadog"],
  ["cypress", "A cypress tree. Cypress, CA office.", "E2E tests using Cypress"],
  ["playwright", "A famous playwright visited. Playwright in residence.", "Testing with Playwright, Jest"],
  ["mocha", "Mocha in the kitchen. Free mocha.", "Unit tests with Mocha and Jest"],
  ["jasmine", "Jasmine tea served. Jasmine joins us.", "Tests written in Jasmine, Karma and Jest"],
  ["cucumber", "Cucumber sandwiches. Cool as a cucumber.", "BDD using Cucumber"],
  ["espresso", "Espresso machine on site. Espresso bar.", "Android UI tests with Espresso"],
  ["postman", "The postman comes at noon. Postman Pat.", "API testing using Postman"],
  ["unity", "Unity is a value. unity across teams.", "Games built with Unity, C#"],
  ["confluence", "A confluence of rivers. Confluence of ideas.", "Docs in Confluence, Jira"],
  ["salesforce", "Salesforce is a customer of ours.", "Experience with Salesforce"],
];
for (const [skill, negative, positive] of AMBIGUOUS) {
  test(`${skill}: not in "${negative}", found in "${positive}"`, () => {
    assert.ok(!matchSkills(negative).has(skill), `false positive in ${negative}`);
    assert.ok(matchSkills(positive).has(skill), `missed in ${positive}`);
  });
}

const POSTINGS = {
  ios: `Senior iOS Engineer
What you'll do
- Build features in Swift and SwiftUI, with UIKit where needed
- Persist data with Core Data and sync over REST and GraphQL
- Write XCTest unit and UI tests and ship through TestFlight
Requirements
- 5+ years building iOS apps with Xcode
- Objective-C experience a plus
- Familiarity with CI/CD and Git`,
  data: `Data Engineer
You will build batch and streaming pipelines.
Requirements
- Python and SQL
- Spark, Airflow and dbt
- Snowflake or BigQuery
- Kafka
- Data modeling and ETL
- Experience with AWS (S3, Redshift)`,
  security: `Application Security Engineer
- Run penetration testing and threat modeling for web services
- Know the OWASP Top 10
- Experience with SAML, OpenID Connect and JWT based SSO
- Support SOC 2 and ISO 27001 audits
- Tools: Burp Suite, Wireshark, Splunk`,
};
for (const [name, posting] of Object.entries(POSTINGS)) {
  test(`a realistic ${name} posting yields at least six requirements`, () => {
    const keywords = extractKeywords(posting);
    assert.ok(keywords.length >= 6, keywords.join(", "));
  });
}

test("a requirement is met by a skill that plainly shows it", () => {
  assert.ok(findInResume("nosql", "Built services on MongoDB"));
  assert.ok(findInResume("swift", "Shipped screens in SwiftUI"));
  assert.ok(!findInResume("swiftui", "Wrote Swift code"));
});
