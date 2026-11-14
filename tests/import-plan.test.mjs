import assert from "node:assert/strict";
import { test } from "node:test";

const { planImport, parseDateCell, detectDateOrder } = await import("@/server/applications/importPlan");
const { toCsv } = await import("@/lib/csv");

const today = "2026-11-14";
const plan = (text, extra = {}) => planImport({ text, today, existing: [], options: {}, ...extra });
const csv = (...lines) => lines.join("\n");

test("headers are detected case-insensitively, ignoring punctuation, first match wins, each column once", () => {
  const p = plan(csv("Company Name,Job-Title,STAGE,Date Applied,City,URL,Salary Range,Remote,Type,Comments", "Acme,Dev,Applied,2026-01-05,Oslo,https://a.example/j,,,Full-time,hi"));
  assert.deepEqual(p.mapping, { company: 0, role: 1, status: 2, appliedDate: 3, location: 4, link: 5, pay: 6, workplace: 7, employmentType: 8, notes: 9 });
  assert.equal(p.rows[0].outcome, "ready");
  const twice = plan(csv("Company,Employer,Date,Applied", "Acme,X,2026-01-05,2026-01-06"));
  assert.equal(twice.mapping.company, 0);
  assert.equal(twice.mapping.appliedDate, 2);
});

test("an explicit mapping wins, null means not in the file", () => {
  const p = plan(csv("Company,Name,When", "Acme,Dev,2026-01-05"), { options: { mapping: { company: 1, role: null, appliedDate: 2 } } });
  assert.equal(p.rows[0].company, "Dev");
  assert.equal(p.rows[0].role, "");
  assert.equal(p.rows[0].appliedDate, "2026-01-05");
});

test("needsMapping when no company column is found", () => {
  const p = plan(csv("A,B", "1,2"));
  assert.equal(p.needsMapping, true);
  assert.deepEqual(p.headers, ["A", "B"]);
  assert.deepEqual(p.rows, []);
  assert.equal(plan(csv("A,B", "1,2"), { options: { mapping: { company: 1 } } }).needsMapping, false);
});

test("empty files and header-only files are 400s", () => {
  assert.throws(() => plan(""), { status: 400 });
  assert.throws(() => plan("Company,Role"), { status: 400 });
});

test("status families map, empty is the default, unknown is kept in the notes", () => {
  const cases = { Applied: "Applied", SUBMITTED: "Applied", "phone screen": "Reached Out", "Under Review": "Pending", Interviewing: "Interviewed", "on-site": "Interviewed", Accepted: "Offered", "Not selected": "Rejected", no: "Rejected", Closed: "Rejected", Withdrawn: "Withdrew", canceled: "Withdrew", "": "Applied" };
  const rows = Object.keys(cases).map((s) => `Acme${s},"${s}",2026-01-05`);
  const p = plan(csv("Company,Status,Date", ...rows));
  Object.values(cases).forEach((expected, i) => assert.equal(p.rows[i].status, expected));
  assert.deepEqual(p.unknownStatuses, []);

  const odd = plan(csv("Company,Status,Notes,Date", "A,Ghosted,Called,2026-01-05", "B,ghosted,,2026-01-05", "C,Hmm,,2026-01-05"));
  assert.equal(odd.rows[0].status, "Applied");
  assert.equal(odd.rows[0].notes, "Called\nImported status: Ghosted");
  assert.equal(odd.rows[1].notes, "Imported status: ghosted");
  assert.deepEqual(odd.unknownStatuses, [{ value: "Ghosted", count: 2 }, { value: "Hmm", count: 1 }]);
});

test("date formats", () => {
  const d = (v, o = "mdy") => parseDateCell(v, o, today);
  assert.equal(d("2026-01-05"), "2026-01-05");
  assert.equal(d("2026/1/5"), "2026-01-05");
  assert.equal(d("2026-01-05T10:20:00Z"), "2026-01-05");
  assert.equal(d("2026-01-05 10:20"), "2026-01-05");
  assert.equal(d("1/5/2026"), "2026-01-05");
  assert.equal(d("1/5/2026", "dmy"), "2026-05-01");
  assert.equal(d("5-1-2026", "dmy"), "2026-01-05");
  assert.equal(d("5.1.2026", "dmy"), "2026-01-05");
  assert.equal(d("1/5/26"), "2026-01-05");
  assert.equal(d("1/5/99"), "1999-01-05");
  assert.equal(d("5 Jan 2026"), "2026-01-05");
  assert.equal(d("Jan 5, 2026"), "2026-01-05");
  assert.equal(d("January 5 2026"), "2026-01-05");
  assert.equal(d("5-Jan-26"), "2026-01-05");
  assert.equal(d("Sept 3, 2025"), "2025-09-03");
});

test("invalid dates are null", () => {
  const d = (v) => parseDateCell(v, "mdy", today);
  for (const v of ["", "2026-02-30", "13/13/2026", "2/30/2026", "1/5/1985", "1/5/2028", "45000", "soon", "5 Foo 2026", "2026-13-01"]) assert.equal(d(v), null, v);
  assert.equal(d("1/5/2027"), "2027-01-05");
});

test("date order detection and override", () => {
  assert.deepEqual(detectDateOrder(["13/1/2026", "2/3/2026"]), { order: "dmy", ambiguous: false });
  assert.deepEqual(detectDateOrder(["1/13/2026"]), { order: "mdy", ambiguous: false });
  assert.deepEqual(detectDateOrder(["1/2/2026"]), { order: "mdy", ambiguous: true });
  assert.deepEqual(detectDateOrder(["2026-01-02", ""]), { order: "mdy", ambiguous: false });
  const text = csv("Company,Date", "A,1/2/2026");
  assert.equal(plan(text).rows[0].appliedDate, "2026-01-02");
  assert.equal(plan(text).dateOrderAmbiguous, true);
  assert.equal(plan(text, { options: { dateOrder: "dmy" } }).rows[0].appliedDate, "2026-02-01");
  assert.equal(plan(csv("Company,Date", "A,25/1/2026")).dateOrder, "dmy");
});

test("rows without a readable date are skipped, or dated today on request; never silently dated", () => {
  const text = csv("Company,Date", "A,", "B,soon", "C,2026-01-05");
  const skip = plan(text);
  assert.deepEqual(skip.rows.map((r) => r.outcome), ["undated", "undated", "ready"]);
  assert.equal(skip.rows[1].reason, 'Could not read the date "soon"');
  assert.equal(skip.rows[0].appliedDate, null);
  assert.equal(skip.totals.undated, 2);
  const now = plan(text, { options: { undated: "today" } });
  assert.deepEqual(now.rows.map((r) => r.outcome), ["ready", "ready", "ready"]);
  assert.equal(now.rows[0].appliedDate, today);
  assert.equal(now.rows[0].usedToday, true);
  assert.equal(now.rows[2].usedToday, undefined);
  const noColumn = plan(csv("Company", "A"));
  assert.equal(noColumn.rows[0].outcome, "undated");
});

test("duplicates against existing rows, earlier rows and links", () => {
  const existing = [
    { company: "Acme Inc.", role: "Software Engineer", appliedDate: "2026-01-05", link: "" },
    { company: "Other", role: "Dev", appliedDate: "2025-05-05", link: "https://jobs.example/p/1/" },
    { company: "Zed", role: "Ops", appliedDate: "2025-05-06", link: "https://jobs.example/p/1/" },
  ];
  const text = csv(
    "Company,Role,Date,Link",
    "ACME,software engineer,2026-01-05,",
    "Acme,Software Engineer,2026-01-06,",
    "Acme,Software Engineer,2026-01-06,",
    "Zed,QA,2026-02-01,https://jobs.example/p/1#top",
    "Yan,QA,2026-02-02,https://x.example/a",
    "Yan,QA2,2026-02-03,HTTPS://X.example/a/"
  );
  const p = plan(text, { existing });
  assert.deepEqual(p.rows.map((r) => r.outcome), ["duplicate", "ready", "duplicate", "duplicate", "ready", "duplicate"]);
  assert.equal(p.totals.duplicates, 4);
  const all = plan(text, { existing, options: { includeDuplicates: true } });
  assert.deepEqual(all.rows.map((r) => r.outcome), Array(6).fill("ready"));
});

test("an undated skipped row does not make a later row a duplicate", () => {
  const p = plan(csv("Company,Role,Date,Link", "A,B,,https://x.example/a", "A,B,2026-01-05,https://x.example/a"));
  assert.deepEqual(p.rows.map((r) => r.outcome), ["undated", "ready"]);
});

test("at most 500 rows are planned", () => {
  const lines = ["Company,Date"];
  for (let i = 0; i < 520; i++) lines.push(`Co${i},2026-01-05`);
  const p = plan(lines.join("\n"));
  assert.equal(p.rows.length, 500);
  assert.equal(p.totals.truncated, true);
  assert.equal(p.rows.at(-1).line, 501);
  const exact = ["Company,Date"];
  for (let i = 0; i < 500; i++) exact.push(`Co${i},2026-01-05`);
  assert.equal(plan(exact.join("\n")).totals.truncated, false);
});

test("rows that break the shared field rules are errors naming the field", () => {
  const long = "x".repeat(201);
  const p = plan(csv("Company,Role,Link,Notes,Date", ",Dev,,,2026-01-05", `Acme,${long},,,2026-01-05`, "Acme,Dev,javascript:alert(1),,2026-01-05", `Acme,Dev,,${"n".repeat(5001)},2026-01-05`, "Acme,Dev,jobs.example/x,,2026-01-05"));
  assert.deepEqual(p.rows.map((r) => r.outcome), ["error", "error", "error", "error", "ready"]);
  assert.match(p.rows[0].reason, /Company/);
  assert.match(p.rows[1].reason, /Role/);
  assert.match(p.rows[2].reason, /link/i);
  assert.match(p.rows[3].reason, /Comments/);
  assert.equal(p.rows[4].link, "https://jobs.example/x");
  assert.equal(p.totals.errors, 4);
});

test("an unreadable date is undated, not an error", () => {
  assert.equal(plan(csv("Company,Date", "A,nope")).rows[0].outcome, "undated");
});

test("formula-guarded cells read back clean", () => {
  const text = toCsv([["Company", "Role", "Date"], ["=Acme", "-Dev", "2026-01-05"]]);
  const p = plan(text);
  assert.equal(p.rows[0].company, "=Acme");
  assert.equal(p.rows[0].role, "-Dev");
});

test("pay, workplace and employment type", () => {
  const p = plan(csv("Company,Pay,Workplace,Type,Date", "A,$120k - $150k,Hybrid,Full-time,2026-01-05", "B,negotiable,maybe,,2026-01-05"));
  assert.equal(p.rows[0].pay, "$120k - $150k");
  assert.equal(p.rows[0].workplace, "hybrid");
  assert.equal(p.rows[1].pay, "");
  assert.equal(p.rows[1].notes, "Imported pay: negotiable\nImported workplace: maybe");
});

test("a shared link is a duplicate only for the same company", () => {
  const existing = [{ company: "Other", role: "Dev", appliedDate: "2025-05-05", link: "https://careers.example/jobs" }];
  const p = plan(
    csv(
      "Company,Role,Date,Link",
      "Other,QA,2026-02-01,https://careers.example/jobs/",
      "Different,QA,2026-02-01,https://careers.example/jobs",
      "First,QA,2026-02-02,https://careers.example/all",
      "Second,QA,2026-02-02,https://careers.example/all",
      "First,Ops,2026-02-03,https://careers.example/all"
    ),
    { existing }
  );
  assert.deepEqual(p.rows.map((r) => r.outcome), ["duplicate", "ready", "ready", "ready", "duplicate"]);
});

test("a column mixing day-first and month-first dates is flagged", () => {
  assert.deepEqual(detectDateOrder(["13/1/2026", "1/13/2026"]), { order: "dmy", ambiguous: true, mixed: true });
  const p = plan(csv("Company,Date", "A,13/1/2026", "B,1/13/2026", "C,2/3/2026"));
  assert.equal(p.dateOrderMixed, true);
  assert.equal(p.dateOrderAmbiguous, true);
  assert.equal(plan(csv("Company,Date", "A,13/1/2026", "B,2/3/2026")).dateOrderMixed, false);
});

test("columns beyond 40 are reported", () => {
  const wide = (n) => csv(["Company", ...Array.from({ length: n - 1 }, (_, i) => `c${i}`)].join(","), "Acme");
  assert.equal(plan(wide(45)).columnsTruncated, true);
  assert.equal(plan(wide(40)).columnsTruncated, false);
});

test("a State column is not the status, and declined is an unknown status", () => {
  const p = plan(csv("Company,State,Date", "A,CA,2026-01-05"));
  assert.equal(p.mapping.status, null);
  const d = plan(csv("Company,Status,Date", "A,Declined,2026-01-05"));
  assert.equal(d.rows[0].status, "Applied");
  assert.deepEqual(d.unknownStatuses, [{ value: "Declined", count: 1 }]);
});

test("blank statuses are counted, errors are not", () => {
  const p = plan(csv("Company,Status,Date", "A,,2026-01-05", "B,Applied,2026-01-05", ",,2026-01-05", "C, ,2026-01-05"));
  assert.equal(p.blankStatuses, 2);
  assert.equal(plan(csv("Company,Date", "A,2026-01-05", "B,2026-01-05")).blankStatuses, 2);
});
