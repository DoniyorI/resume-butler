import assert from "node:assert/strict";
import { test } from "node:test";
import { assessFit } from "@/server/fit/assessFit";

// A realistic posting and Master CV (fictional company and person). The whole
// result is pinned so changes to the engine or the shared keyword rules show
// up here as a visible diff.
const posting = `About the job
Software Engineer II, Platform — Brightwater Logistics (Denver, CO)

About Brightwater
Brightwater moves fresh produce for 4,000 independent grocers. Our engineers love Elixir and Scala meetups.

About the role
The Platform team owns the routing, scheduling and driver apps that keep trucks full and food fresh. You will join a team of six engineers and a product manager, ship to production several times a day, and help shape how we grow from one region to five over the next two years. We value small pull requests, written design notes and calm on-call rotations.

What you'll do
- Design and build backend services in TypeScript and Node.js that schedule 50,000 deliveries a day
- Own features end to end, from PostgreSQL schema design to REST APIs consumed by our React dashboard
- Improve our CI/CD pipelines and observability on AWS
- Mentor newer engineers through code review and pairing

What you'll need
- 3+ years of professional software engineering experience
- Strong TypeScript or JavaScript skills
- Production experience with PostgreSQL or MySQL
- Experience with Docker and deploying to AWS
- Bachelor's degree in Computer Science or equivalent practical experience
- Clear written communication

Nice to have
- Kubernetes or Terraform experience
- Exposure to Kafka or other event streaming
- GraphQL is a plus

Benefits
- Medical, dental and vision coverage
- $2,000 yearly learning budget (people often spend it on Rust courses)

This role is hybrid, three days a week in our Denver, CO office. We are unable to sponsor work visas for this position. Brightwater is an equal opportunity employer and considers all qualified applicants without regard to race, religion, sex, national origin or disability.`;

const cv = {
  education: [
    {
      id: "ed1",
      school: "Front Range State University",
      major: "Computer Science",
      degreeType: "Bachelor",
      startDate: "2015-08-24",
      endDate: "2019-05-10",
    },
  ],
  experience: [
    {
      id: "x1",
      company: "Pinecrest Software",
      position: "Software Engineer",
      startDate: "2022-06-01",
      endDate: "",
      currentlyWorking: true,
      bullets: [
        "Built TypeScript and Node.js services that price 12,000 shipments a day",
        "Designed PostgreSQL schemas and REST endpoints for the carrier portal",
        "Moved deploys from hand-run scripts to GitHub Actions, cutting release time from 2 hours to 15 minutes",
      ],
    },
    {
      id: "x2",
      company: "Mesa Retail Group",
      position: "Junior Developer",
      startDate: "2019-07-01",
      endDate: "2022-07-01",
      currentlyWorking: false,
      bullets: [
        "Maintained a React storefront and its Express API",
        "Wrote MySQL reports for the merchandising team",
      ],
    },
  ],
  projects: [
    {
      id: "p1",
      name: "Shelfwatch",
      description: "Grocery inventory tracker",
      startDate: "2023-01-01",
      endDate: "2023-06-01",
      bullets: ["Packaged the app with Docker and ran it on a home Kubernetes cluster"],
    },
  ],
  skills: [
    { id: "s1", name: "TypeScript", category: "Languages" },
    { id: "s2", name: "JavaScript", category: "Languages" },
    { id: "s3", name: "SQL", category: "Languages" },
    { id: "s4", name: "AWS", category: "Cloud" },
    { id: "s5", name: "GraphQL", category: "Tools" },
  ],
  certifications: [
    { name: "AWS Certified Developer – Associate", issuer: "Amazon Web Services", dateEarned: "2024-03-01" },
  ],
  customSections: [],
};

// The resume the user tailored for this job: it leaves out MySQL and Docker
const resumeContent = {
  experience: [
    {
      companyName: "Pinecrest Software",
      position: "Software Engineer",
      description: [
        "Built TypeScript and Node.js services that price 12,000 shipments a day",
        "Designed PostgreSQL schemas and REST endpoints",
      ],
    },
    {
      companyName: "Mesa Retail Group",
      position: "Junior Developer",
      description: ["Maintained a React storefront"],
    },
  ],
  education: [{ school: "Front Range State University", degreeType: "Bachelor", major: "Computer Science" }],
  skills: [
    { header: "Languages", skills: "TypeScript, JavaScript, SQL" },
    { header: "Cloud", skills: "AWS, Kubernetes" },
  ],
};

test("a realistic software posting against a realistic CV", () => {
  const result = assessFit({ jobDescription: posting, cv, resumeContent, today: new Date(2026, 10, 12) });

  assert.equal(result.method, "fit-evidence-v1");
  assert.equal(result.band, "strong"); // (10 + 0.5 * 1) / 11 = 0.95
  assert.equal(
    result.reason,
    "10 of 11 required skills and qualifications are backed by your experience or projects and 1 more is listed without an example."
  );
  assert.deepEqual(result.counts, {
    required: { total: 11, demonstrated: 10, listed: 1, missing: 0 },
    preferred: { total: 3, demonstrated: 1, listed: 1, missing: 1 },
  });
  assert.deepEqual(result.years, { required: 3, have: 7.3, status: "meets" });
  assert.deepEqual(result.degree, { required: "bachelor's degree", status: "meets" });
  assert.deepEqual(result.checks, [
    { kind: "work-authorization", quote: "We are unable to sponsor work visas for this position." },
    { kind: "onsite", quote: "This role is hybrid, three days a week in our Denver, CO office." },
  ]);

  // Elixir and Scala (About Brightwater) and Rust (Benefits) are boilerplate.
  // "a product manager" on the team, the "Software Engineer" title, "backend
  // services" and "Computer Science" name the kind of job, not requirements. "Kubernetes or
  // Terraform": Kubernetes is demonstrated, so the unbacked Terraform is
  // dropped. "TypeScript or JavaScript" and "PostgreSQL or MySQL" keep both,
  // since every alternative is backed.
  assert.deepEqual(
    result.requirements.map((req) => [
      req.term,
      req.importance,
      req.strength,
      req.evidence.map((item) => item.label),
    ]),
    [
      ["aws", "required", "listed", ["Skills: Cloud", "AWS Certified Developer – Associate"]],
      ["typescript", "required", "demonstrated", ["Software Engineer, Pinecrest Software"]],
      ["node.js", "required", "demonstrated", ["Software Engineer, Pinecrest Software"]],
      ["postgresql", "required", "demonstrated", ["Software Engineer, Pinecrest Software"]],
      ["rest api", "required", "demonstrated", ["Software Engineer, Pinecrest Software"]],
      ["react", "required", "demonstrated", ["Junior Developer, Mesa Retail Group"]],
      ["ci/cd", "required", "demonstrated", ["Software Engineer, Pinecrest Software"]],
      ["javascript", "required", "demonstrated", ["Software Engineer, Pinecrest Software"]],
      ["mysql", "required", "demonstrated", ["Junior Developer, Mesa Retail Group"]],
      ["docker", "required", "demonstrated", ["Shelfwatch"]],
      ["bachelor's degree", "required", "demonstrated", ["Front Range State University"]],
      ["kafka", "preferred", "missing", []],
      ["graphql", "preferred", "listed", ["Skills: Tools"]],
      ["kubernetes", "preferred", "demonstrated", ["Shelfwatch"]],
    ]
  );
  // The only addition: a readable name beside each canonical term
  assert.deepEqual(
    result.requirements.map((req) => req.label),
    ["AWS", "TypeScript", "Node.js", "PostgreSQL", "REST API", "React", "CI/CD", "JavaScript", "MySQL", "Docker", "Bachelor's degree", "Kafka", "GraphQL", "Kubernetes"]
  );
  // CI/CD is backed by the GitHub Actions bullet, JavaScript by TypeScript
  assert.equal(
    result.requirements.find((req) => req.term === "ci/cd").evidence[0].quote,
    "Moved deploys from hand-run scripts to GitHub Actions, cutting release time from 2 hours to 15 minutes"
  );
  const docker = result.requirements.find((req) => req.term === "docker");
  assert.deepEqual(docker.evidence, [
    {
      kind: "project",
      label: "Shelfwatch",
      quote: "Packaged the app with Docker and ran it on a home Kubernetes cluster",
      source: { type: "project", id: "p1" },
      text: "Packaged the app with Docker and ran it on a home Kubernetes cluster",
    },
  ]);

  assert.deepEqual(result.resume, {
    shown: [
      "aws",
      "typescript",
      "node.js",
      "postgresql",
      "rest api",
      "react",
      "javascript",
      "bachelor's degree",
      "kubernetes",
    ],
    notShown: ["ci/cd", "mysql", "docker", "graphql"],
  });

  const cvText = JSON.stringify(cv);
  for (const req of result.requirements) {
    for (const item of req.evidence) {
      assert.ok(item.quote.length <= 160);
      assert.ok(cvText.includes(item.quote.replace(/^…/, "").replace(/…$/, "")), item.quote);
    }
  }
  for (const check of result.checks) {
    assert.ok(check.quote.length <= 200);
    assert.ok(posting.includes(check.quote.replace(/^…/, "").replace(/…$/, "")), check.quote);
  }
  assert.ok(result.requirements.every((req) => !("alternatives" in req)));
  assert.ok(JSON.stringify(result).length < 8000);
});
