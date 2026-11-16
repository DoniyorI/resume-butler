import assert from "node:assert/strict";
import { test } from "node:test";
import { assessFit } from "@/server/fit/assessFit";
import { experienceYears, parseCvDate } from "@/server/fit/experienceYears";
import { SKILL_ALIASES } from "@/server/ats/skills";

const TODAY = new Date(2026, 10, 12); // November 12, 2026

const emptyCv = {
  education: [],
  experience: [],
  projects: [],
  skills: [],
  certifications: [],
  customSections: [],
};

// A CV whose experience shows `shown` and whose skills list `listed`
function cvWith({ shown = [], listed = [], experience, education = [] } = {}) {
  return {
    ...emptyCv,
    education,
    experience: experience || [
      {
        id: "e1",
        company: "Harbor Analytics",
        position: "Software Engineer",
        startDate: "2019-01-01",
        endDate: "",
        currentlyWorking: true,
        bullets: shown.map((skill) => `Built reporting tools with ${skill} for the finance team`),
      },
    ],
    skills: listed.map((name, i) => ({ id: `s${i}`, name, category: "Tools" })),
  };
}

const fourSkills = "Requirements:\n- Python\n- SQL\n- Docker\n- AWS";
const fit = (jobDescription, cv, extra = {}) => assessFit({ jobDescription, cv, today: TODAY, ...extra });
const importanceOf = (result) =>
  Object.fromEntries(result.requirements.map((req) => [req.term, req.importance]));
const terms = (result) => result.requirements.map((req) => req.term);
const strip = (quote) => quote.replace(/^…/, "").replace(/…$/, "");

// 1. Importance from headings and sentence cues
const structured = `Senior Backend Engineer

We are hiring an engineer to build our routing platform with Python.

Requirements:
- 4+ years of professional experience
- Strong SQL skills
- Experience with Docker

Nice to have:
- Kubernetes
- GraphQL

Benefits:
- Health insurance and a Kafka conference budget`;

test("a structured posting splits required and nice-to-have terms", () => {
  const result = fit(structured, cvWith({ shown: ["Python"] }));
  // "Backend Engineer" names the job, not a skill, so it is not a requirement
  assert.deepEqual(importanceOf(result), {
    python: "required",
    sql: "required",
    docker: "required",
    kubernetes: "preferred",
    graphql: "preferred",
  });
  assert.equal(result.counts.required.total, 3);
  assert.equal(result.counts.preferred.total, 2);
});

test("the same posting as one unbroken paragraph reads the same", () => {
  const blob =
    "Senior Backend Engineer. We are hiring an engineer to build our routing platform with Python. " +
    "Requirements: 4+ years of professional experience. Strong SQL skills. Experience with Docker. " +
    "Nice to have: Kubernetes and GraphQL. Benefits: health insurance and a Kafka conference budget.";
  const cv = cvWith({ shown: ["Python"] });
  assert.deepEqual(importanceOf(fit(blob, cv)), importanceOf(fit(structured, cv)));
});

test("sentence cues mark preferred terms without any headings", () => {
  const result = fit(
    "You will build services in Python and SQL on AWS. Experience with Kubernetes is a plus. Ideally you have used GraphQL. Terraform knowledge preferred.",
    emptyCv
  );
  assert.deepEqual(importanceOf(result), {
    python: "required",
    sql: "required",
    aws: "required",
    kubernetes: "preferred",
    graphql: "preferred",
    terraform: "preferred",
  });
});

test("a term asked for as both required and preferred is required", () => {
  const result = fit(
    "Requirements: Python and SQL.\nNice to have: deeper Python and Redis experience.",
    emptyCv
  );
  assert.equal(importanceOf(result).python, "required");
  assert.equal(importanceOf(result).redis, "preferred");
});

test("with no structure every term is required", () => {
  const result = fit("Backend developer using Python, Docker and Redis on AWS", emptyCv);
  assert.ok(result.requirements.every((req) => req.importance === "required"));
  assert.deepEqual(terms(result).sort(), ["aws", "docker", "python", "redis"]); // "Backend developer" is the job
});

// 2. Boilerplate
test("skills named only in About us, Benefits or the equal opportunity statement are not requirements", () => {
  const posting = `About us:
Lumen Freight was founded by Rust and Kafka enthusiasts.

Responsibilities:
- Build Python services

Requirements:
- SQL and Docker

Benefits:
- Free GraphQL workshops

Lumen Freight is an equal opportunity employer and supports Redis users without regard to background.`;
  const result = fit(posting, emptyCv);
  assert.deepEqual(terms(result).sort(), ["docker", "python", "sql"]);
});

test("an About <Company> line on its own starts boilerplate until the next heading", () => {
  const posting =
    "About Quillfeather\nQuillfeather loves Kafka.\n\nWhat you'll need\n- Python\n- SQL\n- Docker";
  assert.deepEqual(terms(fit(posting, emptyCv)), ["python", "sql", "docker"]);
});

// 3. Strength and evidence
const evidenceCv = {
  ...emptyCv,
  experience: [
    {
      id: "e1",
      company: "Copperline Health",
      position: "Data Engineer",
      startDate: "2021-02-01",
      endDate: "",
      currentlyWorking: true,
      bullets: [
        "Moved nightly batch jobs to Python and cut runtime from 4 hours to 20 minutes",
        "Wrote SQL checks for 30 data feeds",
      ],
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Trailhead Maps",
      description: "Hiking route planner",
      bullets: ["Containerised the API with Docker and deployed it on a small VPS"],
    },
  ],
  skills: [
    { id: "s1", name: "AWS", category: "Cloud" },
    { id: "s2", name: "Python", category: "Languages" },
  ],
  certifications: [{ name: "Certified Kubernetes Administrator", issuer: "CNCF", dateEarned: "2024-05-01" }],
  customSections: [
    {
      id: "custom:00000000-0000-4000-8000-000000000001",
      title: "Volunteering",
      type: "entries",
      items: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          title: "Code Club mentor",
          description: ["Taught Redis basics to students"],
        },
      ],
    },
  ],
};

test("demonstrated, listed and missing carry exact evidence from the CV", () => {
  const result = fit("Requirements: Python, SQL, Docker, AWS, Kubernetes, Redis and Terraform.", evidenceCv);
  const byTerm = Object.fromEntries(result.requirements.map((req) => [req.term, req]));

  assert.equal(byTerm.python.strength, "demonstrated");
  assert.deepEqual(byTerm.python.evidence, [
    {
      kind: "experience",
      label: "Data Engineer, Copperline Health",
      quote: "Moved nightly batch jobs to Python and cut runtime from 4 hours to 20 minutes",
      source: { type: "experience", id: "e1" },
      text: "Moved nightly batch jobs to Python and cut runtime from 4 hours to 20 minutes",
    },
  ]);
  assert.deepEqual(byTerm.docker.evidence, [
    {
      kind: "project",
      label: "Trailhead Maps",
      quote: "Containerised the API with Docker and deployed it on a small VPS",
      source: { type: "project", id: "p1" },
      text: "Containerised the API with Docker and deployed it on a small VPS",
    },
  ]);
  assert.equal(byTerm.redis.strength, "demonstrated");
  assert.deepEqual(byTerm.redis.evidence, [
    {
      kind: "custom",
      label: "Code Club mentor",
      quote: "Taught Redis basics to students",
      source: { type: "custom", id: "00000000-0000-4000-8000-000000000002" },
      text: "Taught Redis basics to students",
    },
  ]);

  assert.equal(byTerm.aws.strength, "listed");
  assert.deepEqual(byTerm.aws.evidence, [
    {
      kind: "skills",
      label: "Skills: Cloud",
      quote: "AWS",
      source: { type: "skill", id: "s1" },
      text: "AWS",
    },
  ]);
  assert.equal(byTerm.kubernetes.strength, "listed");
  assert.deepEqual(byTerm.kubernetes.evidence, [
    {
      kind: "certification",
      label: "Certified Kubernetes Administrator",
      quote: "Certified Kubernetes Administrator",
      source: { type: "certification", id: null },
      text: "Certified Kubernetes Administrator",
    },
  ]);

  assert.equal(byTerm.terraform.strength, "missing");
  assert.deepEqual(byTerm.terraform.evidence, []);

  // Gaps first: missing, then listed, then demonstrated, each in posting order
  assert.deepEqual(terms(result), ["terraform", "aws", "kubernetes", "python", "sql", "docker", "redis"]);
});

test("every quote is the user's own words and within its cap", () => {
  const longBullet =
    "Led a cross-team effort across billing, onboarding and support to replace a decade-old reporting stack, " +
    "rewriting the ingestion layer in Python with careful backfills, so finance could close the month two days " +
    "sooner without any manual spreadsheet reconciliation";
  const cv = { ...evidenceCv, experience: [{ ...evidenceCv.experience[0], bullets: [longBullet] }] };
  const result = fit("Requirements: Python, SQL, Docker, AWS, Kubernetes, Redis.", cv);
  const python = result.requirements.find((req) => req.term === "python");
  assert.ok(longBullet.length > 160);
  assert.ok(python.evidence[0].quote.length <= 160);
  assert.ok(python.evidence[0].quote.includes("Python"));
  assert.ok(python.evidence[0].quote.startsWith("…") || python.evidence[0].quote.endsWith("…"));

  const cvText = JSON.stringify(cv);
  for (const req of result.requirements) {
    assert.ok(req.evidence.length <= 2);
    for (const item of req.evidence) {
      assert.ok(item.quote.length <= 160, item.quote);
      assert.ok(cvText.includes(strip(item.quote)), item.quote);
    }
  }
});

test("evidence names at most two entries, one quote each", () => {
  const cv = {
    ...emptyCv,
    experience: ["Ashgrove", "Birchway", "Cedarline"].map((company, i) => ({
      id: `e${i}`,
      company,
      position: "Engineer",
      startDate: `201${i}-01-01`,
      endDate: `201${i + 1}-01-01`,
      bullets: ["Shipped Python jobs", "More Python work"],
    })),
  };
  const python = fit("Python, SQL and Docker", cv).requirements.find((req) => req.term === "python");
  assert.deepEqual(
    python.evidence.map((item) => item.label),
    ["Engineer, Ashgrove", "Engineer, Birchway"]
  );
});

// 4. Years
test("overlapping periods are counted once and a current role runs to today", () => {
  const experience = [
    { company: "A", startDate: "2020-01-01", endDate: "2022-01-01" },
    { company: "B", startDate: "2021-01-01", endDate: "2023-01-01" }, // overlaps A by a year
    { company: "C", startDate: "2025-01-01", endDate: "", currentlyWorking: true },
  ];
  // 2020-01 to 2023-01 (3 years) + 2025-01-01 to 2026-11-12 (1.86 years)
  assert.equal(experienceYears(experience, TODAY), 4.8);
});

test("a missing end date counts only on the most recent entry", () => {
  const experience = [
    { company: "A", startDate: "2018-01-01", endDate: "" }, // older and open-ended: can't be measured
    { company: "B", startDate: "2024-11-12", endDate: "" },
  ];
  assert.equal(experienceYears(experience, TODAY), 2);
});

test("stored and imported date formats are read; undated experience is unknown", () => {
  assert.equal(parseCvDate("2023-04-01"), Date.UTC(2023, 3, 1));
  assert.equal(parseCvDate("2023-04"), Date.UTC(2023, 3, 1));
  assert.equal(parseCvDate("2023"), Date.UTC(2023, 0, 1));
  assert.equal(parseCvDate("04/2023"), Date.UTC(2023, 3, 1));
  assert.equal(parseCvDate("Apr 2023"), Date.UTC(2023, 3, 1));
  assert.equal(parseCvDate("September 2023"), Date.UTC(2023, 8, 1));
  assert.equal(parseCvDate("Summer 2023"), Date.UTC(2023, 5, 1));
  assert.equal(parseCvDate("2023-04-01T00:00:00Z"), Date.UTC(2023, 3, 1));
  assert.equal(parseCvDate("Present"), "present");
  for (const bad of ["", null, undefined, "2023-13-01", "2023-02-30", "someday"])
    assert.equal(parseCvDate(bad), null, String(bad));

  assert.equal(experienceYears([{ startDate: "", endDate: "" }], TODAY), null);
  const result = fit(
    `${fourSkills}\n- 3+ years of experience`,
    cvWith({
      shown: ["Python"],
      experience: [
        { company: "Nowhere", position: "Engineer", startDate: "", endDate: "", bullets: ["Python"] },
      ],
    })
  );
  assert.deepEqual(result.years, { required: 3, have: null, status: "unknown" });
  assert.equal(fit(fourSkills, cvWith({ shown: ["Python"] })).years.status, "not-stated");
});

// 5. Degrees
test("a higher degree meets a lower one, and alternatives are not separate requirements", () => {
  const posting = `${fourSkills}\n- Bachelor's or Master's degree`;
  const master = [{ school: "Westbrook University", major: "Mathematics", degreeType: "Master" }];
  const result = fit(posting, cvWith({ shown: ["Python"], education: master }));
  assert.deepEqual(result.degree, { required: "bachelor's degree", status: "meets" });
  assert.ok(!terms(result).includes("master's degree"));
  const degree = result.requirements.find((req) => req.term === "bachelor's degree");
  assert.equal(degree.strength, "demonstrated");
  assert.deepEqual(degree.evidence, [
    {
      kind: "education",
      label: "Westbrook University",
      quote: "Master",
      source: { type: "education", id: null },
      text: "Master",
    },
  ]);

  const phd = fit(
    posting,
    cvWith({ education: [{ school: "Westbrook University", degreeType: "Ph.D. in Physics" }] })
  );
  assert.equal(phd.degree.status, "meets");
  const associate = fit(
    posting,
    cvWith({ education: [{ school: "Valley College", degreeType: "Associate" }] })
  );
  assert.equal(associate.degree.status, "short");
  assert.equal(fit(posting, cvWith()).degree.status, "unknown");
});

// 6. Bands
const bandOf = (shown, listed = []) => fit(fourSkills, cvWith({ shown, listed })).band;

test("coverage maps to every band", () => {
  assert.equal(bandOf(["Python", "SQL", "Docker"]), "strong"); // 0.75
  assert.equal(bandOf(["Python", "SQL"]), "good"); // 0.5
  assert.equal(bandOf(["Python"], ["SQL", "Docker"]), "good"); // (1 + 1) / 4
  assert.equal(bandOf(["Python"]), "stretch"); // 0.25
  assert.equal(bandOf([], ["Python"]), "low"); // 0.125
  assert.equal(bandOf([]), "low");
});

test("the reason states the counts", () => {
  const result = fit(fourSkills, cvWith({ shown: ["Python", "SQL"], listed: ["Docker"] }));
  assert.equal(
    result.reason,
    "2 of 4 required skills and qualifications are backed by your experience or projects and 1 more is listed without an example."
  );
});

test("short years step the band down one and say so", () => {
  const posting = `${fourSkills}\n- 5+ years of professional experience`;
  const cv = cvWith({ shown: ["Python", "SQL", "Docker"], experience: undefined });
  cv.experience[0].startDate = "2023-11-12"; // three years to TODAY
  const result = fit(posting, cv);
  assert.deepEqual(result.years, { required: 5, have: 3, status: "short" });
  assert.equal(result.band, "good");
  assert.match(
    result.reason,
    /The posting asks for 5\+ years; your dated experience covers about 3 years, so this is rated one band lower\./
  );
  cv.experience[0].startDate = "2018-01-01";
  assert.equal(fit(posting, cv).band, "strong");
});

test("a short required degree is never strong", () => {
  const posting = `${fourSkills}\n- Master's degree required`;
  const result = fit(
    posting,
    cvWith({
      shown: ["Python", "SQL", "Docker", "AWS"],
      education: [{ school: "Valley College", degreeType: "Bachelor", major: "History" }],
    })
  );
  assert.deepEqual(result.degree, { required: "master's degree", status: "short" });
  assert.equal(result.counts.required.total, 5);
  assert.equal(result.band, "good");
  assert.match(result.reason, /asks for a master's degree that your education doesn't show/);
});

test("too few requirements, or an empty Master CV, give unknown", () => {
  const few = fit("We are hiring a Python developer to join us.", cvWith({ shown: ["Python"] }));
  assert.equal(few.band, "unknown");
  assert.equal(few.reason, "This posting names too few specific requirements to compare.");
  assert.equal(few.counts.required.total, 1);

  const empty = fit(fourSkills, emptyCv);
  assert.equal(empty.band, "unknown");
  assert.equal(empty.reason, "Your Master CV has no experience, projects or skills yet.");
  assert.equal(empty.counts.required.missing, 4);
  assert.equal(fit(fourSkills, {}).band, "unknown");
});

test("an empty or very short description is unknown, not an error", () => {
  for (const jobDescription of ["", null, undefined, "Great team, great culture, apply today!!"]) {
    const result = fit(jobDescription, cvWith({ shown: ["Python"] }));
    assert.equal(result.band, "unknown");
    assert.deepEqual(result.requirements, []);
    assert.deepEqual(result.checks, []);
    assert.deepEqual(result.years, { required: null, have: 7.8, status: "not-stated" });
    assert.deepEqual(result.degree, { required: null, status: "not-stated" });
  }
});

// 7. Checks
test("sponsorship, clearance and on-site sentences are quoted, not scored", () => {
  const posting =
    "Requirements: Python, SQL and Docker. Candidates must be authorized to work in the United States; we cannot offer visa sponsorship. " +
    "An active Secret security clearance is required. This role is on-site five days a week at our Tulsa, OK office. " +
    "Willingness to relocate is a plus. Travel up to 25% to customer sites.";
  const result = fit(posting, cvWith({ shown: ["Python", "SQL", "Docker"] }));
  assert.deepEqual(result.checks, [
    {
      kind: "work-authorization",
      quote: "Candidates must be authorized to work in the United States; we cannot offer visa sponsorship.",
    },
    { kind: "clearance", quote: "An active Secret security clearance is required." },
    { kind: "onsite", quote: "This role is on-site five days a week at our Tulsa, OK office." },
    { kind: "relocation", quote: "Willingness to relocate is a plus." },
    { kind: "travel", quote: "Travel up to 25% to customer sites." },
  ]);
  assert.equal(result.band, "strong");
});

test("hybrid without a named place, and travel without a share, are not checks", () => {
  const result = fit(
    "We offer a hybrid work model. Some travel may be needed. Python, SQL, Docker.",
    emptyCv
  );
  assert.deepEqual(result.checks, []);
});

test("a long check sentence is trimmed to 200 characters", () => {
  const filler = "working closely with product, design, data, finance, legal and operations partners ".repeat(
    4
  );
  const sentence = `Because of ${filler}we are unable to provide visa sponsorship for this role now or in the future for any candidate.`;
  const [check] = fit(sentence, emptyCv).checks;
  assert.equal(check.kind, "work-authorization");
  assert.ok(check.quote.length <= 200);
  assert.ok(check.quote.includes("sponsorship"));
  assert.ok(sentence.includes(strip(check.quote)));
});

// 8. Resume comparison
test("the resume comparison lists backed terms the resume shows and leaves out", () => {
  const cv = cvWith({ shown: ["Python", "SQL"], listed: ["Docker"] });
  const resumeContent = {
    experience: [
      {
        companyName: "Harbor Analytics",
        position: "Software Engineer",
        description: ["Built reporting tools with Python"],
      },
    ],
    skills: [],
  };
  const result = fit(fourSkills, cv, { resumeContent });
  assert.deepEqual(result.resume, { shown: ["python"], notShown: ["docker", "sql"] });
  assert.ok(!result.resume.shown.includes("aws") && !result.resume.notShown.includes("aws")); // missing from the CV
  assert.equal(fit(fourSkills, cv).resume, null);
});

// 9. Shape and determinism
test("the same input gives a deep-equal, JSON-safe result", () => {
  const input = {
    jobDescription: structured,
    cv: evidenceCv,
    today: TODAY,
    resumeContent: { skills: [{ header: "Languages", skills: "Python" }] },
  };
  const first = assessFit(input);
  const second = assessFit(structuredClone(input));
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.deepEqual(Object.keys(first), [
    "method",
    "band",
    "reason",
    "requirements",
    "counts",
    "years",
    "degree",
    "language",
    "checks",
    "resume",
  ]);
  assert.equal(first.method, "fit-evidence-v1");
});

// 10. Alternatives joined by "or"
test("an alternative the CV backs drops the unbacked ones from requirements and counts", () => {
  const posting =
    "Requirements: TypeScript or JavaScript, Python, Docker. Nice to have: Kubernetes, Terraform, or Redis.";
  const result = fit(posting, cvWith({ shown: ["JavaScript", "Python"], listed: ["Terraform"] }));
  assert.ok(!terms(result).includes("typescript"));
  assert.ok(terms(result).includes("javascript"));
  assert.ok(!terms(result).includes("kubernetes")); // Terraform is listed, so Kubernetes is not a gap
  assert.deepEqual(result.counts.required, { total: 3, demonstrated: 2, listed: 0, missing: 1 });
  assert.deepEqual(result.counts.preferred, { total: 1, demonstrated: 0, listed: 1, missing: 0 });
  assert.ok(result.requirements.every((req) => !("alternatives" in req)));
});

test("when no alternative is backed only the first is missing, naming the others", () => {
  const result = fit(
    "Requirements: Python, Docker, SQL. Experience with Go, Rust, or Kotlin.",
    cvWith({ shown: ["Python"] })
  );
  const go = result.requirements.find((req) => req.term === "go");
  assert.deepEqual(go, {
    term: "go",
    label: "Go",
    importance: "required",
    strength: "missing",
    evidence: [],
    alternatives: ["rust", "kotlin"],
    alternativeLabels: ["Rust", "Kotlin"],
  });
  assert.ok(!terms(result).includes("rust") && !terms(result).includes("kotlin"));
  assert.equal(result.counts.required.total, 4);
});

test("slash, and, and a term also asked for on its own are not alternatives", () => {
  const cv = cvWith({ shown: ["Python"] });
  assert.ok(terms(fit("Requirements: Python and Go, Docker/Kubernetes, SQL.", cv)).includes("go"));
  assert.ok(terms(fit("Requirements: Python/Go, Docker, SQL.", cv)).includes("go"));
  const both = fit("Requirements: Python or Go. Strong Go skills. Docker and SQL.", cv);
  assert.equal(both.requirements.find((req) => req.term === "go").strength, "missing");
});

// 11. Degree in progress
test("a degree that ends after today is in progress, not met", () => {
  const posting = `${fourSkills}\n- Bachelor's degree in a technical field`;
  const studying = [
    {
      school: "Westbrook University",
      major: "Computer Science",
      degreeType: "Bachelor",
      endDate: "2027-05-15",
    },
  ];
  const result = fit(posting, cvWith({ shown: ["Python", "SQL", "Docker", "AWS"], education: studying }));
  assert.deepEqual(result.degree, { required: "bachelor's degree", status: "short", inProgress: true });
  const degree = result.requirements.find((req) => req.term === "bachelor's degree");
  assert.equal(degree.strength, "missing");
  assert.equal(result.band, "good"); // 4 of 5 would be strong; a short degree caps it

  const done = fit(posting, cvWith({ education: [{ ...studying[0], endDate: "2026-05-15" }] }));
  assert.deepEqual(done.degree, { required: "bachelor's degree", status: "meets" });
  const both = fit(
    posting,
    cvWith({
      education: [...studying, { school: "Valley College", degreeType: "Bachelor", endDate: "2020-05-01" }],
    })
  );
  assert.deepEqual(both.degree, { required: "bachelor's degree", status: "meets" });
});

// 12. Cost on hostile input
test("a 50,000-character posting against a large CV stays fast and capped", () => {
  const experience = Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    company: `Company ${i}`,
    position: "Software Engineer",
    startDate: `${1980 + i}-01-01`,
    endDate: `${1981 + i}-01-01`,
    bullets: Array.from(
      { length: 10 },
      (_, j) =>
        `Built Python and Go services for team ${j} with Docker, Kafka and PostgreSQL on AWS, reviewed carefully`
    ),
  }));
  const cv = { ...emptyCv, experience, skills: [{ id: "s", name: "Terraform", category: "Tools" }] };
  const words = Object.keys(SKILL_ALIASES).join(" or ");
  const postings = [
    "Requirements: Python, Go, ".repeat(2000).slice(0, 50000),
    "python go docker kafka aws sql experience with redis or terraform and more ".repeat(700).slice(0, 50000),
    `Requirements: ${words}. `.repeat(100).slice(0, 50000),
    "a".repeat(50000),
  ];
  for (const jobDescription of postings) {
    assert.equal(jobDescription.length, 50000);
    const started = performance.now();
    const result = fit(jobDescription, cv);
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 1500, `${Math.round(elapsed)} ms`);
    assert.ok(result.requirements.length <= 60);
  }
});

// 13. Role phrases and skills that imply others
test("role phrases like backend services or product managers are not requirements", () => {
  const result = fit(
    "Requirements: Build backend services in Python. Work with product managers and project management partners. Docker and SQL.",
    emptyCv
  );
  assert.deepEqual(terms(result).sort(), ["docker", "python", "sql"]);
});

test("a more specific skill in a bullet demonstrates the general requirement, quoting that bullet", () => {
  const cv = cvWith({
    experience: [
      {
        id: "e1",
        company: "Harbor Analytics",
        position: "Software Engineer",
        startDate: "2020-01-01",
        currentlyWorking: true,
        bullets: [
          "Tuned PostgreSQL indexes for the billing ledger",
          "Rewrote the admin panel in TypeScript",
          "Set up GitHub Actions for every pull request",
        ],
      },
    ],
  });
  const byTerm = Object.fromEntries(
    fit("Requirements: SQL, JavaScript and CI/CD.", cv).requirements.map((req) => [req.term, req])
  );
  const label = "Software Engineer, Harbor Analytics";
  assert.deepEqual(byTerm.sql, {
    term: "sql",
    label: "SQL",
    importance: "required",
    strength: "demonstrated",
    evidence: [
      {
        kind: "experience",
        label,
        quote: "Tuned PostgreSQL indexes for the billing ledger",
        source: { type: "experience", id: "e1" },
        text: "Tuned PostgreSQL indexes for the billing ledger",
      },
    ],
  });
  assert.deepEqual(byTerm.javascript.evidence, [
    {
      kind: "experience",
      label,
      quote: "Rewrote the admin panel in TypeScript",
      source: { type: "experience", id: "e1" },
      text: "Rewrote the admin panel in TypeScript",
    },
  ]);
  assert.deepEqual(byTerm["ci/cd"].evidence, [
    {
      kind: "experience",
      label,
      quote: "Set up GitHub Actions for every pull request",
      source: { type: "experience", id: "e1" },
      text: "Set up GitHub Actions for every pull request",
    },
  ]);
  assert.ok(Object.values(byTerm).every((req) => req.strength === "demonstrated"));
});

test("a role phrase inside an or-group leaves the skill alternatives intact", () => {
  const posting = "Requirements: Frontend or backend experience with React or Vue. Python, Docker.";
  const backed = fit(posting, cvWith({ shown: ["Vue", "Python"] }));
  assert.deepEqual(terms(backed).sort(), ["docker", "python", "vue"]); // React dropped: Vue is backed
  const none = fit(posting, cvWith({ shown: ["Python"] }));
  const react = none.requirements.find((req) => req.term === "react");
  assert.deepEqual(react.alternatives, ["vue"]);
  assert.ok(!terms(none).some((term) => ["frontend", "backend", "vue"].includes(term)));
});

// 13. Knockouts: sections that are not requirements, languages, location, years alone
const threeSkills = "Requirements:\n- Python\n- SQL\n- Docker";
const backsThree = () => cvWith({ shown: ["Python", "SQL", "Docker"] });
const shortCv = () =>
  cvWith({
    experience: [
      {
        id: "e1",
        company: "Harbor Analytics",
        position: "Software Engineer",
        startDate: "2025-01-01",
        endDate: "",
        currentlyWorking: true,
        bullets: ["Answered partner questions and wrote onboarding guides"],
      },
    ],
  });

test("an interview-process section is not read as requirements", () => {
  const posting = `${threeSkills}

Our Process
Virtual onsite: two technical sessions with a coding and system design exercise, then a Kubernetes review.`;
  const result = fit(posting, backsThree());
  assert.deepEqual(terms(result).sort(), ["docker", "python", "sql"]);

  const inline = `${threeSkills}\n\nInterview process: a system design round and a GraphQL take-home.`;
  assert.deepEqual(terms(fit(inline, backsThree())).sort(), ["docker", "python", "sql"]);
});

test("a required language the Master CV does not mention is quoted and rates the job low", () => {
  const posting = `${threeSkills}\n- Must be fluent in English and Korean`;
  const result = fit(posting, backsThree());
  assert.deepEqual(result.language, { required: ["Korean"], missing: ["Korean"], status: "short" });
  assert.deepEqual(
    result.checks.find((check) => check.kind === "language"),
    { kind: "language", quote: "Must be fluent in English and Korean" }
  );
  assert.equal(result.band, "low");
  assert.match(result.reason, /asks for Korean, which your Master CV doesn't mention/);
});

test("a required language the Master CV mentions is met and leaves the band alone", () => {
  const posting = `${threeSkills}\n- Professional proficiency in Japanese and Korean`;
  const cv = cvWith({ shown: ["Python", "SQL", "Docker"], listed: ["Korean", "Japanese (fluent)"] });
  const result = fit(posting, cv);
  assert.deepEqual(result.language, { required: ["Japanese", "Korean"], missing: [], status: "meets" });
  assert.equal(result.band, "strong");
});

test("English, programming languages and nice-to-have languages are not language requirements", () => {
  const none = { required: [], missing: [], status: "not-stated" };
  for (const line of [
    "Fluent in English, written and spoken",
    "Proficient in Python and native mobile development with Swift",
    "Polish the product with our designers",
  ]) {
    const result = fit(`${threeSkills}\n- ${line}`, backsThree());
    assert.deepEqual(result.language, none, line);
    assert.equal(result.checks.some((check) => check.kind === "language"), false, line);
    assert.equal(result.band, "strong", line);
  }

  const preferred = fit(`${threeSkills}\n\nNice to have:\n- Fluent in Spanish`, backsThree());
  assert.deepEqual(preferred.language, none);
  assert.equal(preferred.band, "strong");
  assert.deepEqual(
    preferred.checks.find((check) => check.kind === "language"),
    { kind: "language", quote: "Fluent in Spanish" }
  );
});

test("a place the candidate must be in is quoted as a location check", () => {
  const sentence = "You’re located or willing to work from Seoul, South Korea.";
  const result = fit(`${threeSkills}\n${sentence}`, backsThree());
  assert.deepEqual(
    result.checks.find((check) => check.kind === "location"),
    { kind: "location", quote: sentence }
  );
  assert.equal(result.band, "strong"); // quoted for the user to judge, never scored

  const based = fit(`${threeSkills}\nCandidates must be based in the Chicago area.`, backsThree());
  assert.equal(based.checks.find((check) => check.kind === "location")?.quote, "Candidates must be based in the Chicago area.");

  const company = fit(`${threeSkills}\nWe are based in Denver and love Python.`, backsThree());
  assert.equal(company.checks.some((check) => check.kind === "location"), false);
});

test("a posting naming few skills is still rated a stretch when its years exceed the dated experience", () => {
  const posting = "You have 5+ years of experience in partner engineering or a similar customer-facing role.";
  const result = fit(posting, shortCv());
  assert.equal(result.years.status, "short");
  assert.equal(result.band, "stretch");
  assert.equal(
    result.reason,
    `This posting names too few specific requirements to compare. It asks for 5+ years; your dated experience covers about ${result.years.have} years.`
  );
});

test("a posting naming few skills whose years are met stays unknown and says so", () => {
  const posting = "2+ years of software engineering experience. Strong programming fundamentals.";
  const result = fit(posting, backsThree());
  assert.equal(result.band, "unknown");
  assert.equal(
    result.reason,
    "This posting names too few specific requirements to compare. Your dated experience (about 7.8 years) covers the 2+ years it asks for."
  );
});

test("a missing required language rates a posting low even when it names few skills", () => {
  const posting = "You have 5+ years of experience in partner engineering.\nMust be fluent in English and Korean";
  const result = fit(posting, shortCv());
  assert.equal(result.band, "low");
  assert.match(result.reason, /asks for Korean, which your Master CV doesn't mention/);
});
