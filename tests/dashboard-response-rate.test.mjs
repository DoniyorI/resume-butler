import assert from "node:assert/strict";
import { test } from "node:test";
import { median, responseSummary, RESPONSE_WINDOW_DAYS } from "@/features/dashboard/data";

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
    app("b", "Reached Out"), // a recruiter reached out
    app("c", "Interviewed"),
    app("d", "Offered"),
    app("e", "Rejected"), // interviewed, then rejected: still heard back
    app("f", "Rejected"), // rejected straight from Applied: no reply counted
    app("g", "Withdrew"), // recruiter reached out, then withdrew
    app("h", "Pending"),
  ];
  const byApp = history({ e: ["Applied", "Interviewed", "Rejected"], f: ["Applied", "Rejected"], g: ["Reached Out", "Withdrew"], h: ["Applied", "Pending"] });
  assert.deepEqual(responseSummary(applications, byApp, NOW), {
    eligible: 8,
    responses: 5,
    responseRate: Math.round((5 / 8) * 100),
    offers: 1,
    offerRate: Math.round((1 / 8) * 100),
  });
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
    assert.deepEqual(s, { eligible: 0, responses: 0, responseRate: null, offers: 0, offerRate: null });
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
