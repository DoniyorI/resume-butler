import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { HttpError } from "@/server/http";
import { assessFit } from "@/server/fit/assessFit";

const TODAY = new Date(2026, 10, 12);

let signedIn = true;
let chatAnswer = {};
mock.module("@/server/auth", {
  namedExports: {
    requireUser: async () => {
      if (!signedIn) throw new HttpError(401, "Unauthorized");
      return { supabase: fakeSupabase(), user: { id: "user-1", email: "ada@example.com" } };
    },
  },
});
mock.module("@/server/openai", { namedExports: { chatJSON: async () => chatAnswer } });
// tailorPlan imports tailorResume, so it loads after the openai mock
const { planTailoring, resumeGaps } = await import("@/server/fit/tailorPlan");
const { POST } = await import("@/app/api/resume-fit/route");
const { tailorResume } = await import("@/server/resume/tailorResume");

// ---- Fixture: a fictional Master CV ----
const cv = {
  certifications: [],
  customSections: [],
  education: [
    { id: "ed1", school: "Lakeside University", major: "Computer Science", degreeType: "Bachelor", startDate: "2011-09-01", endDate: "2015-06-01" },
  ],
  experience: [
    {
      id: "x-old",
      company: "Contoso Telecom",
      position: "Support Analyst",
      startDate: "2015-07-01",
      endDate: "2018-06-01",
      currentlyWorking: false,
      bullets: ["Answered customer calls and logged tickets"],
    },
    {
      id: "x-mid",
      company: "Fabrikam Labs",
      position: "Data Engineer",
      startDate: "2018-07-01",
      endDate: "2022-03-01",
      currentlyWorking: false,
      bullets: ["Wrote Python pipelines for nightly reports", "Managed Redis caches for the dashboard"],
    },
    {
      id: "x-now",
      company: "Northwind Cloud",
      position: "Senior Engineer",
      startDate: "2022-04-01",
      endDate: "",
      currentlyWorking: true,
      bullets: [
        "Built Python services that process 2 million events a day",
        "Tuned PostgreSQL indexes and cut report time from 40 seconds to 3",
      ],
    },
  ],
  projects: [
    { id: "p-recipes", name: "Recipe Box", description: "Meal planner", startDate: "2021-01-01", endDate: "2021-04-01", currentlyWorking: false, bullets: ["Designed the cookbook layout"] },
    { id: "p-trail", name: "Trail Map", description: "Hiking planner", startDate: "2023-01-01", endDate: "2023-05-01", currentlyWorking: false, bullets: ["Containerised the API with Docker for a small VPS"] },
  ],
  skills: [
    { id: "s0", name: "Rust", category: "Languages" },
    { id: "s1", name: "Go", category: "Languages" },
    { id: "s2", name: "Python", category: "Languages" },
    { id: "s4", name: "Make", category: "Tools" },
    { id: "s3", name: "Terraform", category: "Tools" },
  ],
};

const posting = `Requirements:
- Strong Python
- Experience with PostgreSQL
- Docker
- Redis
- Terraform
- Kafka or RabbitMQ
- Bachelor's degree

Nice to have:
- Go`;

const fitFor = (resumeContent, description = posting, master = cv) =>
  assessFit({ jobDescription: description, cv: master, resumeContent, today: TODAY });

// The resume the user has: Northwind with only the Python bullet, a degree, Python in skills
const resume = {
  education: [{ school: "Lakeside University", major: "Computer Science", degreeType: "Bachelor" }],
  experience: [
    {
      companyName: "Northwind Cloud",
      position: "Senior Engineer",
      description: ["Built Python services that process 2 million events a day"],
    },
  ],
  projects: [],
  skills: [{ header: "Languages", skills: "Python" }],
};

// ---- Evidence source and text ----
test("evidence names the CV row and the full line it was cut from", () => {
  const long = "Led a migration of the billing stack to Python " + "and kept it running smoothly ".repeat(10);
  const master = { ...cv, experience: [{ ...cv.experience[2], bullets: [long] }] };
  const result = fitFor(null, "Requirements: Python, Docker, Terraform, Redis", master);
  const byTerm = Object.fromEntries(result.requirements.map((req) => [req.term, req]));

  const python = byTerm.python.evidence[0];
  assert.deepEqual(python.source, { type: "experience", id: "x-now" });
  assert.equal(python.text, long);
  assert.ok(python.quote.length < python.text.length);

  assert.deepEqual(fitFor(null, "Requirements: Docker, Python, Go, Redis").requirements.find((r) => r.term === "docker").evidence[0].source, {
    type: "project",
    id: "p-trail",
  });
  const terraform = byTerm.terraform.evidence[0];
  assert.deepEqual(terraform.source, { type: "skill", id: "s3" });
  assert.equal(terraform.text, "Terraform");
});

// ---- planTailoring ----
test("entries are ordered by score, then recency, and each says what it backs", () => {
  const result = fitFor(resume);
  const { content, picks, note } = planTailoring({ fit: result, cv });

  assert.equal(note, null);
  // Fabrikam backs python + redis (4 points); Northwind backs python + postgresql (4 points)
  // and is more recent, so it leads. Contoso backs nothing and is left out.
  assert.deepEqual(picks.experience, [
    { title: "Senior Engineer at Northwind Cloud", reason: "Backs Python and PostgreSQL" },
    { title: "Data Engineer at Fabrikam Labs", reason: "Backs Python and Redis" },
  ]);
  assert.deepEqual(picks.projects, [{ title: "Trail Map", reason: "Backs Docker" }]);
  assert.deepEqual(content.experience.map((item) => item.companyName), ["Northwind Cloud", "Fabrikam Labs"]);
  assert.deepEqual(content.projects.map((item) => item.projectName), ["Trail Map"]);
  assert.deepEqual(content.education.map((item) => item.school), ["Lakeside University"]);
});

test("skills keep every category, with the skills a posting asks for first", () => {
  const { content } = planTailoring({ fit: fitFor(resume), cv });
  assert.deepEqual(content.skills, [
    { header: "Languages", skills: "Go, Python, Rust" },
    { header: "Tools", skills: "Terraform, Make" },
  ]);
});

test("required terms outweigh preferred ones", () => {
  const master = {
    ...cv,
    experience: [
      { ...cv.experience[1], id: "a", company: "Alpha", bullets: ["Used Redis daily"] },
      { ...cv.experience[1], id: "b", company: "Beta", bullets: ["Wrote Go services"], startDate: "2017-01-01", endDate: "2017-12-01" },
    ],
    projects: [],
  };
  const description = "Requirements:\n- Redis\n- Python\n- Docker\n\nNice to have:\n- Go";
  const { picks } = planTailoring({ fit: fitFor(null, description, master), cv: master });
  assert.deepEqual(picks.experience.map((pick) => pick.title), ["Data Engineer at Alpha", "Data Engineer at Beta"]);
  assert.equal(picks.experience[1].reason, "Backs Go");
});

test("the caps are 5 experiences and 4 projects, and more than four terms say 'and N more'", () => {
  const terms = ["Python", "Docker", "Redis", "Kafka", "Terraform", "PostgreSQL"];
  // Evidence names two entries per term, so each project gets a term of its own
  const projectTerms = ["Java", "Kotlin", "Swift", "Ruby", "Scala", "Rust"];
  const experience = Array.from({ length: 7 }, (_, i) => ({
    id: `x${i}`,
    company: `Company ${i}`,
    position: "Engineer",
    startDate: `20${10 + i}-01-01`,
    endDate: `20${10 + i}-12-01`,
    currentlyWorking: false,
    bullets: [`Worked with ${terms[i % terms.length]} on the platform`],
  }));
  experience[0].bullets = terms.map((term) => `Shipped ${term} work`);
  const projects = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    name: `Project ${i}`,
    description: "",
    startDate: `202${i}-01-01`,
    endDate: `202${i}-06-01`,
    bullets: [`Built a ${projectTerms[i]} tool`],
  }));
  const master = { ...cv, experience, projects };
  const description = `Requirements:\n${[...terms, ...projectTerms].map((term) => `- ${term}`).join("\n")}`;
  const { picks } = planTailoring({ fit: fitFor(null, description, master), cv: master });
  assert.equal(picks.experience.length, 5);
  assert.equal(picks.projects.length, 4);
  assert.equal(picks.experience[0].title, "Engineer at Company 0");
  assert.match(picks.experience[0].reason, /^Backs \S+, \S+, \S+, \S+ and 2 more$/);
});

test("with no match the most recent entries fill a minimum and the plan says so", () => {
  const description = "Requirements:\n- Kafka\n- Elixir\n- Scala\n- Rust";
  const { content, picks, note } = planTailoring({ fit: fitFor(null, description), cv });
  assert.equal(note, "None of your entries name what this posting asks for, so the most recent ones are shown.");
  assert.deepEqual(picks.experience, [
    { title: "Senior Engineer at Northwind Cloud", reason: "Your most recent role" },
    { title: "Data Engineer at Fabrikam Labs", reason: "Recent experience, no direct match" },
  ]);
  assert.deepEqual(picks.projects.map((p) => p.title), ["Trail Map"]);
  assert.equal(content.skills.length, 2);
});

test("a CV with experience never gets an empty experience list", () => {
  const one = { ...cv, experience: [cv.experience[0]], projects: [] };
  const { content, picks } = planTailoring({ fit: fitFor(null, "Requirements: Kafka, Rust", one), cv: one });
  assert.equal(content.experience.length, 1);
  assert.equal(picks.experience[0].reason, "Your most recent role");
  assert.deepEqual(content.projects, []);
  const empty = planTailoring({ fit: fitFor(null, posting, { ...cv, experience: [], projects: [] }), cv: { ...cv, experience: [], projects: [] } });
  assert.deepEqual(empty.content.experience, []);
  assert.equal(empty.note, null);
});

test("the current role is always picked, and three older matching roles keep their credit", () => {
  const old = (id, company, bullet, year) => ({
    id, company, position: "Engineer", startDate: `${year}-01-01`, endDate: `${year}-12-01`, currentlyWorking: false, bullets: [bullet],
  });
  const master = {
    ...cv,
    projects: [],
    experience: [
      old("a", "Alpha", "Ran Python jobs", 2016),
      old("b", "Beta", "Tuned Python code", 2017),
      old("c", "Gamma", "Reviewed Python code", 2018),
      { ...cv.experience[0], id: "now", company: "Delta", startDate: "2020-01-01", endDate: "", currentlyWorking: true, bullets: ["Greeted visitors"] },
    ],
  };
  const fit = fitFor(null, "Requirements:\n- Python\n- Docker\n- Redis", master);
  // evidence names only two entries for python
  assert.equal(fit.requirements.find((r) => r.term === "python").evidence.length, 2);
  const { picks } = planTailoring({ fit, cv: master });
  assert.deepEqual(picks.experience.map((p) => p.title), [
    "Engineer at Gamma", "Engineer at Beta", "Engineer at Alpha", "Support Analyst at Delta",
  ]);
  assert.deepEqual(picks.experience.map((p) => p.reason), ["Backs Python", "Backs Python", "Backs Python", "Your most recent role"]);
});

test("a project backing a term two experiences already back still gets credit", () => {
  const master = {
    ...cv,
    experience: [
      { ...cv.experience[2], id: "e1", bullets: ["Used Docker daily"] },
      { ...cv.experience[1], id: "e2", bullets: ["Used Docker in CI"] },
    ],
    projects: [{ id: "pp", name: "Shipyard", description: "", startDate: "2023-01-01", endDate: "2023-02-01", bullets: ["Packaged with Docker"] }],
  };
  const fit = fitFor(null, "Requirements:\n- Docker\n- Python\n- Redis", master);
  assert.ok(!fit.requirements.find((r) => r.term === "docker").evidence.some((e) => e.source.type === "project"));
  const { picks } = planTailoring({ fit, cv: master });
  assert.deepEqual(picks.projects, [{ title: "Shipyard", reason: "Backs Docker" }]);
});

test("sourcesFor lists every backing line, however many the evidence names", async () => {
  const { indexCv, sourcesFor } = await import("@/server/fit/cvEvidence");
  const sources = sourcesFor("python", indexCv(cv, TODAY));
  assert.deepEqual([...new Set(sources.map((s) => s.id))].sort((a, b) => String(a).localeCompare(String(b))), [null, "x-mid", "x-now"]);
  assert.deepEqual(sourcesFor("bachelor's degree", indexCv(cv, TODAY)), []);
});

// ---- resumeGaps ----
test("gaps: an absent entry, a missing bullet, a skill, a degree, a missing term and shown terms", () => {
  const fit = fitFor(resume);
  const gaps = resumeGaps({ fit, cv, resumeContent: resume });
  const byTerm = Object.fromEntries(gaps.addable.map((item) => [item.term, item]));

  // python and the degree are on the resume: in neither list
  assert.equal(byTerm.python, undefined);
  assert.equal(byTerm["bachelor's degree"], undefined);
  assert.ok(![...gaps.missing].some((item) => item.term === "python"));

  // PostgreSQL: Northwind is on the page without that bullet
  assert.equal(byTerm.postgresql.kind, "bullet");
  assert.equal(byTerm.postgresql.sectionId, "experience");
  assert.equal(byTerm.postgresql.title, "Senior Engineer, Northwind Cloud");
  assert.deepEqual(byTerm.postgresql.match, { companyName: "Northwind Cloud", position: "Senior Engineer", startDate: "2022-04-01" });
  assert.equal(byTerm.postgresql.bullet, "Tuned PostgreSQL indexes and cut report time from 40 seconds to 3");
  assert.equal(byTerm.postgresql.importance, "required");

  // Redis: Fabrikam is not on the page, so the whole entry is addable
  assert.equal(byTerm.redis.kind, "entry");
  assert.equal(byTerm.redis.item.companyName, "Fabrikam Labs");
  assert.deepEqual(byTerm.redis.item.description, cv.experience[1].bullets);
  assert.equal(byTerm.redis.quote, "Managed Redis caches for the dashboard");

  // Docker: a project that is not on the page
  assert.equal(byTerm.docker.kind, "entry");
  assert.equal(byTerm.docker.sectionId, "projects");
  assert.equal(byTerm.docker.item.projectName, "Trail Map");

  // Terraform is only a listed skill
  assert.equal(byTerm.terraform.kind, "skill");
  assert.equal(byTerm.terraform.skill, "Terraform");
  assert.equal(byTerm.terraform.sectionId, "skills");
  assert.equal(byTerm.terraform.title, "Skills");

  // Go (preferred) is a listed skill and comes after every required term
  assert.equal(byTerm.go.importance, "preferred");
  assert.equal(gaps.addable.at(-1).term, "go");

  // Kafka or RabbitMQ is absent from the CV
  assert.deepEqual(gaps.missing, [
    { term: "kafka", label: "Kafka", importance: "required", alternatives: ["rabbitmq"], alternativeLabels: ["RabbitMQ"] },
  ]);
  assert.equal(byTerm.terraform.label, "Terraform");

  assert.equal(gaps.backed, fit.requirements.filter((req) => req.strength !== "missing").length);
  assert.equal(gaps.shown, fit.resume.shown.length);
  assert.deepEqual(fit.resume.shown.sort(), ["bachelor's degree", "python"]);
  assert.equal(gaps.backed, 7);
  assert.equal(gaps.shown, 2);
});

test("a degree the resume leaves out is not addable, and a bullet already present is skipped", () => {
  const bare = { ...resume, education: [] };
  const fit = fitFor(bare);
  assert.ok(fit.resume.notShown.includes("bachelor's degree"));
  const gaps = resumeGaps({ fit, cv, resumeContent: bare });
  assert.ok(!gaps.addable.some((item) => item.term === "bachelor's degree"));
  assert.ok(!gaps.missing.some((item) => item.term === "bachelor's degree"));

  // Force the bullet case: the fit says postgresql is not shown, but the bullet is on the page
  const withBullet = {
    ...resume,
    experience: [{ ...resume.experience[0], description: [...resume.experience[0].description, cv.experience[2].bullets[1].toUpperCase()] }],
  };
  const staleFit = { ...fit, resume: { ...fit.resume, notShown: ["postgresql"] } };
  const skipped = resumeGaps({ fit: staleFit, cv, resumeContent: withBullet });
  assert.deepEqual(skipped.addable, []);
});

test("gaps: two roles with the same company and title are told apart by start date", () => {
  const twin = {
    ...cv,
    experience: [
      { id: "t1", company: "Harbor Ledger", position: "Engineer", startDate: "2019-01-01", endDate: "2020-12-01", currentlyWorking: false, bullets: ["Built Python importers"] },
      { id: "t2", company: "Harbor Ledger", position: "Engineer", startDate: "2022-01-01", endDate: "", currentlyWorking: true, bullets: ["Tuned PostgreSQL queries for reports"] },
    ],
    projects: [],
    skills: [],
  };
  const description = "Requirements:\n- Python\n- PostgreSQL";
  // Only the first role is on the page: the second is offered as a whole entry, not as a bullet on the first
  const onPage = { experience: [{ companyName: "Harbor Ledger", position: "Engineer", startDate: "2019-01-01", description: ["Built Python importers"] }] };
  const gaps = resumeGaps({ fit: fitFor(onPage, description, twin), cv: twin, resumeContent: onPage });
  const row = gaps.addable.find((item) => item.term === "postgresql");
  assert.equal(row.kind, "entry");
  assert.equal(row.item.startDate, "2022-01-01");
  // Only the second role is on the page, without its bullet: the bullet goes to that role
  const second = { experience: [{ companyName: "Harbor Ledger", position: "Engineer", startDate: "2022-01-01", description: ["Led the reporting team"] }] };
  const bullet = resumeGaps({ fit: fitFor(second, description, twin), cv: twin, resumeContent: second }).addable.find((item) => item.term === "postgresql");
  assert.equal(bullet.kind, "bullet");
  assert.equal(bullet.match.startDate, "2022-01-01");
});

test("gaps: a skill row adds exactly the one skill its id points at, never a whole line", () => {
  const fit = {
    requirements: [
      {
        term: "terraform",
        importance: "required",
        strength: "listed",
        evidence: [{ source: { type: "skill", id: "s3" }, quote: "Make, Terraform", text: "Make, Terraform" }],
      },
      {
        term: "kafka",
        importance: "required",
        strength: "listed",
        evidence: [{ source: { type: "skill", id: "gone" }, quote: "Kafka", text: "Kafka" }],
      },
    ],
    resume: { shown: [], notShown: ["terraform", "kafka"] },
  };
  const gaps = resumeGaps({ fit, cv, resumeContent: {} });
  assert.deepEqual(gaps.addable.map((item) => [item.term, item.kind, item.skill]), [["terraform", "skill", "Terraform"]]);
});

// ---- tailorResume fallback ----
test("tailorResume falls back to the newest entries when the model picks none", async () => {
  const db = fakeSupabase(rowsFromCv(cv));
  chatAnswer = { experience: [], projects: [{ id: "p-recipes", reason: "Fits" }], education: [], skills: [] };
  const result = await tailorResume(db, "user-1", { jobDescription: "Anything" });
  assert.deepEqual(result.fallback, ["experience"]);
  assert.deepEqual(result.content.experience.map((item) => item.companyName), ["Northwind Cloud", "Fabrikam Labs", "Contoso Telecom"]);
  assert.deepEqual(result.content.projects.map((item) => item.projectName), ["Recipe Box"]);
  assert.equal(result.content.education.length, 1);

  chatAnswer = { experience: [{ id: "x-mid", reason: "Fits" }], projects: [], education: [] };
  const second = await tailorResume(db, "user-1", { jobDescription: "Anything" });
  assert.deepEqual(second.fallback, ["projects"]);
  assert.deepEqual(second.content.projects.map((item) => item.projectName), ["Trail Map", "Recipe Box"]);

  chatAnswer = { experience: [{ id: "x-mid" }], projects: [{ id: "p-trail" }] };
  assert.deepEqual((await tailorResume(db, "user-1", { jobDescription: "Anything" })).fallback, []);
});

// ---- Route ----
// The fixture CV as the snake_case rows loadMasterCv reads
function rowsFromCv(master) {
  const dates = (row) => ({ start_date: row.startDate, end_date: row.endDate || null, currently_working: row.currentlyWorking });
  const bullets = (list) => list.map((content, sort_order) => ({ sort_order, content }));
  return {
    cv_education: master.education.map((e) => ({ id: e.id, school: e.school, major: e.major, degree_type: e.degreeType, ...dates(e) })),
    cv_experience: master.experience.map((e) => ({ id: e.id, company: e.company, position: e.position, ...dates(e), cv_experience_bullets: bullets(e.bullets) })),
    cv_projects: master.projects.map((p) => ({ id: p.id, name: p.name, description: p.description, ...dates(p), cv_project_bullets: bullets(p.bullets) })),
    cv_skills: master.skills,
    cv_certifications: [],
  };
}

function fakeSupabase(override) {
  const tables = override || {
    cv_education: [{ id: "ed1", school: "Lakeside University", major: "Computer Science", degree_type: "Bachelor", start_date: "2011-09-01", end_date: "2015-06-01", user_id: "user-1" }],
    cv_experience: [
      {
        id: "x1",
        user_id: "user-1",
        company: "Northwind Cloud",
        position: "Senior Engineer",
        start_date: "2022-04-01",
        currently_working: true,
        cv_experience_bullets: [{ sort_order: 0, content: "Built Python services for 2 million events a day" }],
      },
    ],
    cv_projects: [],
    cv_skills: [{ id: "s1", name: "Docker", category: "Tools", user_id: "user-1" }],
    cv_certifications: [],
  };
  const query = (rows) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: async () => ({ data: { cv_sections: { revision: 0, titles: {}, customSections: [] } }, error: null }),
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return chain;
  };
  return { from: (table) => query(tables[table] || []) };
}

const post = (body) =>
  new Request("http://localhost/api/resume-fit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("the route answers 401 without a user and 400 on a bad body", async () => {
  signedIn = false;
  assert.equal((await POST(post({ jobDescription: "x", resumeContent: {} }))).status, 401);
  signedIn = true;
  assert.equal((await POST(post({ jobDescription: "", resumeContent: {} }))).status, 400);
  assert.equal((await POST(post({ jobDescription: "x" }))).status, 400);
  assert.equal((await POST(post("not json"))).status, 400);
});

test("the route returns fit, plan and gaps and never the raw CV", async () => {
  const response = await POST(post({ jobDescription: "Requirements:\n- Python\n- Docker\n- Redis", resumeContent: { experience: [], skills: [] } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const text = await response.text();
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body), ["fit", "plan", "gaps"]);
  assert.ok(body.fit.requirements.length >= 3);
  assert.equal(body.plan.picks.experience[0].title, "Senior Engineer at Northwind Cloud");
  assert.ok(Array.isArray(body.gaps.addable));
  for (const leak of ["cv_experience", "cv_experience_bullets", "user_id", "ada@example.com", "user-1", "sort_order"]) {
    assert.ok(!text.includes(leak), leak);
  }
});
