import assert from "node:assert/strict";
import { test } from "node:test";
import { assessFit } from "@/server/fit/assessFit";
import { degreeLine, yearsLine } from "@/features/opportunities/fitLines";
import {
  FIXED_STRINGS,
  PREP_TEXT,
  buildInterviewPrep,
  chooseSubmission,
  submissionResumeContent,
} from "@/server/interviews/prepare";

const NOW = new Date("2026-11-14T12:00:00Z");
const application = { id: "app-1", company: "Acme", role: "Platform Engineer", status: "Interviewed", jobDescription: "", resumeId: null };

const description = `About the role
Build the platform that moves 4,000 shipments a day.

What you'll need
- Strong TypeScript skills for backend services
- Production experience with PostgreSQL
- Experience with Docker and deploying to AWS

Nice to have
- Kubernetes experience is a plus
- Terraform for infrastructure as code`;

const ev = (label, text, kind = "experience", quote = text) => ({ kind, label, quote, text, source: { type: kind, id: null } });
const req = (term, importance, strength, evidence = [], extra = {}) => ({ term, label: term, importance, strength, evidence, ...extra });
const fitFixture = (overrides = {}) => ({
  band: "good",
  reason: "",
  counts: {},
  years: { status: "not-stated" },
  degree: { status: "not-stated" },
  checks: [],
  requirements: [
    req("typescript", "required", "demonstrated", [
      ev("Engineer, Acme", "Built backend services in TypeScript for 40 clients"),
      ev("Engineer, Acme", "Led the TypeScript migration of the billing API"),
      ev("Side project", "Wrote a TypeScript CLI", "project"),
    ]),
    req("postgresql", "required", "demonstrated", [ev("Engineer, Acme", "Tuned PostgreSQL queries that cut load time by half")]),
    req("docker", "required", "listed", [ev("Skills: Tools", "Docker", "skills")]),
    req("terraform", "preferred", "demonstrated", [ev("Engineer, Acme", "Provisioned AWS with Terraform modules")]),
    req("kubernetes", "preferred", "missing", [], { alternatives: ["nomad"], alternativeLabels: ["nomad"] }),
  ],
  resume: { shown: ["typescript", "docker"], notShown: ["postgresql", "terraform"] },
  ...overrides,
});
const cvFixture = {
  experience: [
    {
      company: "Acme",
      position: "Engineer",
      bullets: [
        "Built backend services in TypeScript for 40 clients",
        "Led the TypeScript migration of the billing API",
        "Tuned PostgreSQL queries that cut load time by half",
        "Provisioned AWS with Terraform modules",
      ],
    },
  ],
  projects: [{ name: "Side project", description: "", bullets: ["Wrote a TypeScript CLI"] }],
  skills: [{ name: "Docker", category: "Tools" }],
  education: [],
};
const submission = (patch = {}) => ({
  id: "sub-1",
  kind: "selected",
  submitted_on: "2026-11-01",
  created_at: "2026-11-01T10:00:00Z",
  job_description: description,
  resume_title: "Platform resume",
  resume_snapshot: { experience: [] },
  artifact: null,
  answers: [],
  supersedes_id: null,
  ...patch,
});
const build = (patch = {}) =>
  buildInterviewPrep({ application, submission: submission(), fit: fitFixture(), cv: cvFixture, activities: [], now: NOW, ...patch });
const group = (prep, key) => prep.groups.find((g) => g.key === key);
const labels = (g) => g?.items.map((item) => item.label);

test("chooseSubmission: the latest record that nothing supersedes", () => {
  const records = [
    { id: "a", submitted_on: "2026-10-01", created_at: "2026-10-01T09:00:00Z", supersedes_id: null },
    { id: "b", submitted_on: "2026-11-01", created_at: "2026-11-01T09:00:00Z", supersedes_id: null },
    { id: "c", submitted_on: "2026-11-01", created_at: "2026-11-02T09:00:00Z", supersedes_id: "b" },
  ];
  assert.equal(chooseSubmission(records).id, "c", "same day: later created wins, and it supersedes b");
  assert.equal(chooseSubmission(records.slice(0, 2)).id, "b");
  // The newest is superseded by an older-dated correction: the correction is what stands
  const corrected = [
    { id: "x", submitted_on: "2026-11-05", created_at: "2026-11-05T00:00:00Z", supersedes_id: null },
    { id: "y", submitted_on: "2026-11-02", created_at: "2026-11-06T00:00:00Z", supersedes_id: "x" },
  ];
  assert.equal(chooseSubmission(corrected).id, "y");
  assert.equal(chooseSubmission([]), null);
});

test("the submitted description wins; an empty one falls back to the application's", () => {
  const withSaved = { ...application, jobDescription: "short" };
  assert.equal(build({ application: withSaved }).posting.hasDescription, true);
  const fallback = build({ application: { ...application, jobDescription: description }, submission: submission({ job_description: "" }) });
  assert.equal(fallback.posting.hasDescription, true);
  assert.equal(fallback.source.kind, "submitted");
});

test("no submission: uses the current description and says so", () => {
  const prep = build({ submission: null, application: { ...application, jobDescription: description, resumeId: "r1" } });
  assert.equal(prep.source.kind, "current");
  assert.deepEqual(prep.source.notes, [PREP_TEXT.noSubmission]);
  assert.equal(prep.source.resumeKnown, true);
  const noResume = build({ submission: null, fit: fitFixture({ resume: null }), application: { ...application, jobDescription: description } });
  assert.equal(noResume.source.resumeKnown, false);
  assert.deepEqual(noResume.source.notes, [PREP_TEXT.noSubmission, PREP_TEXT.noResume]);
  assert.ok(group(noResume, "shown") && !group(noResume, "goDeeper"));
});

test("resume side by kind", () => {
  assert.deepEqual(submissionResumeContent(submission({ kind: "export", artifact: { content: { a: 1 } }, resume_snapshot: null })), { a: 1 });
  assert.deepEqual(submissionResumeContent(submission({ kind: "selected" })), { experience: [] });
  assert.equal(submissionResumeContent(submission({ kind: "upload", resume_snapshot: null })), null);
  assert.equal(submissionResumeContent(submission({ kind: "unknown", resume_snapshot: null })), null);
  assert.equal(build().source.resumeKnown, true);

  const upload = build({ submission: submission({ kind: "upload", resume_snapshot: null }), fit: fitFixture({ resume: null }) });
  assert.equal(upload.source.resumeKnown, false);
  assert.deepEqual(upload.source.notes, [PREP_TEXT.upload]);
  assert.equal(group(upload, "goDeeper"), undefined);
  assert.equal(group(upload, "bringUp"), undefined);
  assert.equal(group(upload, "shown").title, "Shown in your Master CV — expect questions");
  assert.deepEqual(labels(group(upload, "shown")), ["typescript", "postgresql", "terraform"]);
  assert.ok(group(upload, "shown").items.every((item) => item.onResume === null));

  const unknown = build({ submission: submission({ kind: "unknown", resume_snapshot: null }), fit: fitFixture({ resume: null }) });
  assert.deepEqual(unknown.source.notes, [PREP_TEXT.unknown]);
});

test("group membership, order and onResume", () => {
  const prep = build();
  assert.deepEqual(labels(group(prep, "goDeeper")), ["typescript"]);
  assert.equal(group(prep, "goDeeper").title, "On the resume they read — expect follow-up questions");
  assert.deepEqual(labels(group(prep, "bringUp")), ["postgresql", "terraform"]);
  assert.equal(group(prep, "bringUp").title, "In your Master CV but not on what you sent — you can bring it up");
  assert.deepEqual(labels(group(prep, "needExample")), ["docker"]);
  assert.equal(group(prep, "needExample").title, "Listed but without an example — think of one");
  assert.deepEqual(labels(group(prep, "gaps")), ["kubernetes"]);
  assert.equal(group(prep, "gaps").title, "Not in your Master CV — prepare an honest answer");
  assert.deepEqual(group(prep, "gaps").items[0].alternativeLabels, ["nomad"]);
  assert.equal(group(prep, "goDeeper").items[0].onResume, true);
  assert.equal(group(prep, "bringUp").items[0].onResume, false);
  assert.equal(group(prep, "shown"), undefined);
});

test("required requirements come before preferred, even if the fit lists them otherwise", () => {
  const fit = fitFixture();
  fit.requirements = [fit.requirements[3], ...fit.requirements.filter((r) => r.term !== "terraform")];
  assert.deepEqual(labels(group(build({ fit }), "bringUp")), ["postgresql", "terraform"]);
});

test("quotes are capped at two, verbatim, and name where they come from", () => {
  const item = group(build(), "goDeeper").items[0];
  assert.equal(item.quotes.length, 2);
  assert.deepEqual(item.quotes[0], { text: "Built backend services in TypeScript for 40 clients", from: "Engineer, Acme" });
  assert.deepEqual(group(build(), "needExample").items[0].quotes, [{ text: "Docker", from: "Skills: Tools" }]);
});

test("postingQuote: the posting's sentence, word-bounded, trimmed to 200 characters", () => {
  const prep = build();
  assert.equal(group(prep, "goDeeper").items[0].postingQuote, "Strong TypeScript skills for backend services");
  assert.equal(group(prep, "bringUp").items[0].postingQuote, "Production experience with PostgreSQL");
  const absent = fitFixture();
  absent.requirements.push(req("rust", "preferred", "missing"));
  assert.equal(group(build({ fit: absent }), "gaps").items.find((i) => i.term === "rust").postingQuote, null);
  // "Go" must not match inside "going"
  const wordy = fitFixture();
  wordy.requirements = [req("go", "required", "missing"), req("typescript", "required", "missing"), req("sql", "required", "missing")];
  const text = `${"Prefix words ".repeat(5)}We are going places. ${"filler ".repeat(40)}TypeScript is used everywhere ${"and more words ".repeat(20)}end.`;
  const prep2 = build({ fit: wordy, submission: submission({ job_description: text }) });
  const items = group(prep2, "gaps").items;
  assert.equal(items.find((i) => i.term === "go").postingQuote, null);
  const long = items.find((i) => i.term === "typescript").postingQuote;
  assert.ok(long.length <= 200 && long.includes("TypeScript"), `${long.length}`);
  assert.ok(text.includes(long.replace(/^…|…$/g, "")));
});

test("stories: bullets only, ranked by required then preferred coverage, capped at 6", () => {
  const fit = fitFixture();
  const shared = "Built backend services in TypeScript for 40 clients";
  fit.requirements[1].evidence.push(ev("Engineer, Acme", shared));
  fit.requirements[3].evidence.push(ev("Engineer, Acme", shared));
  fit.requirements[0].evidence.push(ev("Engineer, Acme", "Engineer"));
  const { stories } = build({ fit });
  assert.deepEqual(stories[0], { text: shared, from: "Engineer, Acme", covers: ["typescript", "postgresql", "terraform"] });
  assert.ok(!stories.some((s) => s.text === "Engineer"), "a position line is not a story");
  assert.ok(!stories.some((s) => s.text === "Docker"), "a skill line is not a story");
  assert.ok(stories.some((s) => s.from === "Side project"));

  const many = fitFixture();
  const bullets = Array.from({ length: 9 }, (_, i) => `Bullet number ${i} about shipping`);
  many.requirements = bullets.map((text, i) => req(`skill${i}`, "required", "demonstrated", [ev("Engineer, Acme", text)]));
  const cv = { ...cvFixture, experience: [{ company: "Acme", position: "Engineer", bullets }] };
  const capped = build({ fit: many, cv }).stories;
  assert.equal(capped.length, 6);
  assert.deepEqual(capped.map((s) => s.text), bullets.slice(0, 6), "ties keep first appearance");
});

test("a short description gives no groups or stories and asks for the description", () => {
  const prep = build({ submission: null, application: { ...application, jobDescription: "Too short." } });
  assert.equal(prep.posting.hasDescription, false);
  assert.deepEqual(prep.groups, []);
  assert.deepEqual(prep.stories, []);
  assert.deepEqual(prep.checks, []);
  const noFit = build({ fit: null });
  assert.equal(noFit.posting.fitAvailable, false);
  assert.deepEqual(noFit.groups, []);
});

test("checks add the years and degree lines", () => {
  const fit = fitFixture({
    checks: [{ kind: "onsite", quote: "Hybrid, three days a week in Denver" }],
    years: { status: "short", required: 5, have: 3 },
    degree: { status: "short", required: "bachelor's degree" },
  });
  const { checks } = build({ fit });
  assert.deepEqual(
    checks.map((c) => c.text),
    ["Hybrid, three days a week in Denver", yearsLine(fit.years), degreeLine(fit.degree)]
  );
  assert.equal(checks[0].label, "On-site");
});

test("upcoming: the next open timed step; done, cancelled and past are ignored", () => {
  const step = (id, patch) => ({
    id, title: id, kind: "interview", status: "open", startsAt: null, timeZone: null, dueOn: null,
    contactName: "", contactChannel: "", link: "", notes: "", ...patch,
  });
  const activities = [
    step("past", { startsAt: "2026-11-13T15:00:00Z", dueOn: "2026-11-13", timeZone: "UTC" }),
    step("done", { status: "done", startsAt: "2026-11-15T15:00:00Z", dueOn: "2026-11-15", timeZone: "UTC" }),
    step("cancelled", { status: "cancelled", startsAt: "2026-11-15T16:00:00Z", dueOn: "2026-11-15", timeZone: "UTC" }),
    step("task", { kind: "follow_up", dueOn: "2026-11-15" }),
    step("later", { kind: "recruiter_screen", startsAt: "2026-11-20T15:00:00Z", dueOn: "2026-11-20", timeZone: "UTC", contactName: "Sam", contactChannel: "video", link: "https://example.test/x", notes: "Bring questions" }),
    step("soon", { startsAt: "2026-11-16T15:00:00Z", dueOn: "2026-11-16", timeZone: "America/New_York" }),
  ];
  const prep = build({ activities });
  assert.equal(prep.upcoming.id, "soon");
  assert.equal(prep.upcoming.timeZone, "America/New_York");
  assert.equal(prep.past, 1);
  assert.equal(build({ activities: activities.filter((a) => a.id !== "soon") }).upcoming.contactName, "Sam");
  assert.equal(build({ activities: activities.slice(0, 4) }).upcoming, null);
  assert.equal(build({ activities: null }).upcoming, null);
  // An untimed step today still counts; yesterday's does not
  assert.equal(build({ activities: [step("today", { dueOn: "2026-11-14" })] }).upcoming.id, "today");
  assert.equal(build({ activities: [step("yday", { dueOn: "2026-11-13" })] }).upcoming, null);
});

test("answers are kept as stored and capped at 20", () => {
  const answers = Array.from({ length: 25 }, (_, i) => ({ question: `Question ${i}?`, answer: `Answer ${i}`, sourceAnswerId: "x" }));
  const prep = build({ submission: submission({ answers: [...answers, { question: 5, answer: "bad" }] }) });
  assert.equal(prep.answers.length, 20);
  assert.deepEqual(prep.answers[0], { question: "Question 0?", answer: "Answer 0" });
  assert.deepEqual(build().answers, []);
});

// Property: every string a person reads on the page is a quote found in the
// inputs, a requirement or evidence label, a fixed string, or a fit line.
const NON_PROSE = new Set(["key", "kind", "importance", "strength", "term", "id", "submissionId", "submittedOn", "startsAt", "timeZone", "dueOn", "contactChannel"]);
const strings = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
};
const leaves = (value, out = [], key = "") => {
  if (typeof value === "string") {
    if (!NON_PROSE.has(key)) out.push(value);
  } else if (Array.isArray(value)) value.forEach((item) => leaves(item, out, key));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, item]) => leaves(item, out, k));
  return out;
};

function assertOnlyQuotesAndFixed(prep, inputs, fit) {
  const haystack = strings(inputs);
  const allowed = new Set([
    ...FIXED_STRINGS,
    ...fit.requirements.flatMap((r) => [r.label, r.term, ...(r.alternativeLabels || []), ...r.evidence.map((e) => e.label)]),
    ...[yearsLine(fit.years), degreeLine(fit.degree)].filter(Boolean),
    "Experience", "Education", "Check", ...Object.values(CHECK_LABELS),
  ]);
  for (const leaf of leaves(prep)) {
    const bare = leaf.replace(/^…|…$/g, "").trim();
    const ok = allowed.has(leaf) || haystack.some((source) => source.includes(bare));
    assert.ok(ok, `not a quote, label or fixed string: ${JSON.stringify(leaf)}`);
  }
}
const CHECK_LABELS = { "work-authorization": "Work authorisation", clearance: "Clearance", citizenship: "Citizenship", onsite: "On-site", relocation: "Relocation", travel: "Travel" };

test("property: nothing on the page is written by the app", () => {
  const sub = submission({
    answers: [{ question: "Why us?", answer: "I like logistics." }],
    resume_snapshot: { experience: [{ companyName: "Acme", position: "Engineer", description: ["Built backend services in TypeScript for 40 clients"] }], skills: [{ header: "Tools", skills: "Docker" }] },
  });
  const activities = [{ id: "s", title: "Panel interview", kind: "interview", status: "open", startsAt: "2026-11-16T15:00:00Z", timeZone: "UTC", dueOn: "2026-11-16", contactName: "Sam Lee", contactChannel: "video", link: "https://example.test/room", notes: "Bring questions" }];
  // The hand fixture
  const fit = fitFixture({ checks: [{ kind: "onsite", quote: "Hybrid in Denver" }], years: { status: "short", required: 5, have: 3 } });
  const withCheck = { ...sub, job_description: `${description}\nHybrid in Denver` };
  const prep = buildInterviewPrep({ application, submission: withCheck, fit, cv: cvFixture, activities, now: NOW });
  assertOnlyQuotesAndFixed(prep, { description: withCheck.job_description, cv: cvFixture, answers: sub.answers, activities, application, sub: { resume_title: sub.resume_title } }, fit);
  assert.ok(prep.groups.length && prep.stories.length && prep.checks.length && prep.answers.length && prep.upcoming);

  // The real engine over a real Master CV
  const cv = {
    ...cvFixture,
    experience: [{ id: "e1", company: "Acme", position: "Engineer", startDate: "2020-01-01", endDate: "2024-01-01", bullets: cvFixture.experience[0].bullets }],
    education: [],
  };
  const real = assessFit({ jobDescription: description, cv, resumeContent: sub.resume_snapshot, today: NOW });
  const realPrep = buildInterviewPrep({ application, submission: sub, fit: real, cv, activities: [], now: NOW });
  assert.ok(realPrep.groups.length, "the real engine produced groups");
  assertOnlyQuotesAndFixed(realPrep, { description, cv, answers: sub.answers, application, sub: { resume_title: sub.resume_title } }, real);
});

test("property check catches an invented sentence", () => {
  const fit = fitFixture();
  const prep = build();
  prep.groups[0].items[0].quotes.push({ text: "Expert in distributed systems", from: "Engineer, Acme" });
  assert.throws(() => assertOnlyQuotesAndFixed(prep, { description, cv: cvFixture }, fit), /not a quote/);
});
