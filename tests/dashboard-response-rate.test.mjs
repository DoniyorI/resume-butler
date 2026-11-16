import assert from "node:assert/strict";
import { test } from "node:test";
import { median, responseSummary, startedAsOutreach, RESPONSE_WINDOW_DAYS } from "@/features/dashboard/data";

const NOW = Date.parse("2026-11-14T12:00:00");
const daysAgo = (n) => {
  const d = new Date(NOW - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const app = (id, status, ago = 30) => ({ id, status, applied_date: daysAgo(ago) });
const history = (entries) => new Map(Object.entries(entries).map(([id, statuses]) => [id, statuses.map((status) => ({ application_id: id, status }))]));

test("window is 14 days", () => assert.equal(RESPONSE_WINDOW_DAYS, 14));

test("a response is any reply in the current status or the history", () => {
  const applications = [
    app("a", "Applied"), // never heard back
    app("b", "Reached Out"), // applied, then a recruiter replied
    app("c", "Interviewed"),
    app("d", "Offered"),
    app("e", "Rejected"), // interviewed, then rejected: still heard back
    app("f", "Rejected"), // rejected straight from Applied: no reply counted
    app("h", "Pending"),
  ];
  const byApp = history({ b: ["Applied", "Reached Out"], e: ["Applied", "Interviewed", "Rejected"], f: ["Applied", "Rejected"], h: ["Applied", "Pending"] });
  assert.deepEqual(responseSummary(applications, byApp, NOW), {
    eligible: 7,
    responses: 4,
    responseRate: Math.round((4 / 7) * 100),
    offers: 1,
    offerRate: Math.round((1 / 7) * 100),
    outreach: 0,
  });
});

test("a row that started with a recruiter reaching out was never applied to, so it is not in the rate", () => {
  const applications = [
    app("a", "Applied"),
    app("j", "Reached Out"), // applied first: a reply
    app("b", "Reached Out"), // a job alert or recruiter email, logged as it arrived
    app("g", "Withdrew"), // recruiter reached out, then withdrew
    app("i", "Interviewed"), // recruiter reached out, then an interview
    app("k", "Reached Out"), // no history at all: the current status is where it started
    app("recent", "Reached Out", 3),
  ];
  const byApp = history({ j: ["Applied", "Reached Out"], b: ["Reached Out"], g: ["Reached Out", "Withdrew"], i: ["Reached Out", "Interviewed"], recent: ["Reached Out"] });
  assert.deepEqual(responseSummary(applications, byApp, NOW), {
    eligible: 2,
    responses: 1,
    responseRate: 50,
    offers: 0,
    offerRate: 0,
    outreach: 4, // b, g, i, k; the recent one is outside the window either way
  });
  assert.equal(startedAsOutreach(applications[2], byApp), true);
  assert.equal(startedAsOutreach(applications[1], byApp), false);
});

test("the earliest history row decides where a row started, whatever order rows arrive in", () => {
  const byApp = new Map([
    ["x", [
      { application_id: "x", status: "Reached Out", changed_at: "2026-10-02T10:00:00Z" },
      { application_id: "x", status: "Applied", changed_at: "2026-10-01T10:00:00Z" },
    ]],
  ]);
  assert.equal(startedAsOutreach(app("x", "Reached Out"), byApp), false);
});

test("the 14 day boundary: applied exactly 14 days ago counts, 13 does not", () => {
  const applications = [app("old", "Applied", 14), app("recent", "Reached Out", 13), app("today", "Offered", 0), { id: "nodate", status: "Offered", applied_date: null }];
  const s = responseSummary(applications, new Map(), NOW);
  assert.equal(s.eligible, 1);
  assert.equal(s.responses, 0);
  assert.equal(s.responseRate, 0);
});

test("no applications old enough gives null rates, never 0%", () => {
  for (const s of [responseSummary([], new Map(), NOW), responseSummary([app("a", "Offered", 3)], new Map(), NOW)]) {
    assert.deepEqual(s, { eligible: 0, responses: 0, responseRate: null, offers: 0, offerRate: null, outreach: 0 });
  }
});

test("a response or offer that exists only in the history still counts", () => {
  const applications = [app("a", "Rejected"), app("b", "Withdrew"), app("c", "Rejected")];
  const s = responseSummary(applications, history({ a: ["Applied", "Offered", "Rejected"], b: ["Applied", "Reached Out", "Withdrew"], c: ["Applied", "Rejected"] }), NOW);
  assert.equal(s.responses, 2);
  assert.equal(s.offers, 1);
  assert.equal(s.offerRate, 33);
});

test("median handles empty, odd and even lists", () => {
  assert.equal(median([]), null);
  assert.equal(median([9]), 9);
  assert.equal(median([10, 2, 4]), 4);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});
