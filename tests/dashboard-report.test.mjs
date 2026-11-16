import assert from "node:assert/strict";
import { test } from "node:test";
import { searchReport } from "@/features/dashboard/report";

const NOW = Date.parse("2026-11-14T12:00:00");
const app = (id, applied_date, extra = {}) => ({ id, status: "Applied", applied_date, source: "manual", ...extra });
const find = (rows, label) => rows.find((r) => r.label === label);

// 6 manual + 2 extension (greenhouse), all old enough; one too recent to count
const apps = [
  ...Array.from({ length: 6 }, (_, i) => app(`m${i}`, "2026-10-01", { resume_id: "r1", workplace_type: "remote" })),
  app("e0", "2026-09-10", { source: "extension", source_site: "greenhouse", workplace_type: "hybrid", status: "Offered" }),
  app("e1", "2026-09-12", { source: "extension", source_site: "greenhouse", status: "Interviewed", resume_id: "gone" }),
  app("new", "2026-11-10", { status: "Offered" }),
  app("nodate", null),
];
const rows = [
  ["m0", ["Applied", "Reached Out"]],
  ["m1", ["Applied", "Interviewed", "Rejected"]],
  ["m2", ["Applied", "Offered"]],
  ["e0", ["Applied", "Interviewed", "Offered"]],
].flatMap(([id, statuses]) => statuses.map((status) => ({ application_id: id, status })));

test("window and totals", () => {
  const r = searchReport(apps, rows, [{ id: "r1", title: "Backend CV" }], NOW);
  assert.equal(r.windowDays, 14);
  assert.equal(r.total, 10);
  assert.equal(r.included, 8); // the recent one and the undated one are left out
});

test("by source: counts, small group marked, no percentage", () => {
  const r = searchReport(apps, rows, [], NOW);
  const manual = find(r.bySource, "Added manually");
  assert.deepEqual([manual.applications, manual.responses, manual.interviews, manual.offers], [6, 3, 2, 1]);
  assert.equal(manual.tooFew, false);
  assert.equal(manual.responseRate, 50);
  const ext = find(r.bySource, "Browser extension");
  assert.deepEqual([ext.applications, ext.responses, ext.interviews, ext.offers], [2, 2, 2, 1]);
  assert.equal(ext.tooFew, true);
  assert.equal(ext.responseRate, null);
  assert.equal(find(r.bySource, "Not recorded"), undefined);
});

test("by site lists only recognised sites", () => {
  const r = searchReport(apps, rows, [], NOW);
  assert.deepEqual(r.bySite.map((x) => [x.label, x.applications]), [["Greenhouse", 2]]);
});

test("by resume: titles, no resume linked, and a deleted resume falls into no resume", () => {
  const r = searchReport(apps, rows, [{ id: "r1", title: "Backend CV" }], NOW);
  assert.equal(find(r.byResume, "Backend CV").applications, 6);
  assert.equal(find(r.byResume, "No resume linked").applications, 2);
  assert.equal(r.byResume.at(-1).label, "No resume linked");
});

test("by month: last 6 months, oldest first, with a filter link", () => {
  const r = searchReport(apps, rows, [], NOW);
  assert.deepEqual(r.byMonth.map((x) => x.label), ["Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026"]);
  assert.equal(find(r.byMonth, "Oct 2026").applications, 6);
  assert.equal(find(r.byMonth, "Sep 2026").applications, 2);
  assert.equal(find(r.byMonth, "Nov 2026").applications, 0); // the Nov 10 application is inside the 14 days
  assert.equal(find(r.byMonth, "Oct 2026").href, "/applications?from=2026-10-01&to=2026-10-31");
  assert.equal(find(r.byMonth, "Jun 2026").tooFew, true);
});

test("by workplace: Not recorded group last", () => {
  const r = searchReport(apps, rows, [], NOW);
  assert.deepEqual(r.byWorkplace.map((x) => [x.label, x.applications]), [["Remote", 6], ["Hybrid", 1], ["Not recorded", 1]]);
});

test("a group of exactly 5 gets a percentage, 4 does not", () => {
  const five = Array.from({ length: 5 }, (_, i) => app(`a${i}`, "2026-10-01"));
  assert.equal(searchReport(five, [], [], NOW).bySource[0].responseRate, 0);
  assert.equal(searchReport(five.slice(1), [], [], NOW).bySource[0].responseRate, null);
});

test("empty input", () => {
  const r = searchReport([], [], [], NOW);
  assert.equal(r.included, 0);
  assert.deepEqual(r.bySource, []);
  assert.equal(r.byMonth.length, 6);
});

test("rows that started with a recruiter reaching out are counted apart, not as applications", () => {
  const withOutreach = [
    ...apps,
    app("o1", "2026-10-02", { source: "email", status: "Reached Out" }),
    app("o2", "2026-10-03", { source: "email", status: "Reached Out" }),
  ];
  const history = [...rows, { application_id: "o1", status: "Reached Out" }, { application_id: "o2", status: "Reached Out" }];
  const r = searchReport(withOutreach, history, [], NOW);
  assert.equal(r.total, 12);
  assert.equal(r.included, 8);
  assert.equal(r.outreach, 2);
  assert.equal(find(r.bySource, "From email"), undefined);
  assert.equal(find(r.byMonth, "Oct 2026").applications, 6);
});
