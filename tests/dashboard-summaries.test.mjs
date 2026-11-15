import assert from "node:assert/strict";
import test from "node:test";
import { activitySummary, countRecent, timingSummary } from "../src/features/dashboard/summaries.js";

const series = [
  { date: "2026-10-15", count: 9 }, // 30 days before: outside
  { date: "2026-10-16", count: 2 }, // first day of the window
  { date: "2026-11-14", count: 3 },
  { date: "2026-11-15", count: 4 }, // after today: outside
];

test("counts the 30 days ending today, inclusive", () => {
  assert.equal(countRecent(series, "2026-11-14"), 5);
});

test("summaries read as plain sentences", () => {
  assert.equal(activitySummary(series, "2026-11-14"), "5 applications in the last 30 days");
  assert.equal(activitySummary([{ date: "2026-11-14", count: 1 }], "2026-11-14"), "1 application in the last 30 days");
});

test("the timing summary names the median or says there are no replies", () => {
  assert.equal(timingSummary(7), "Median 7 days to first reply");
  assert.equal(timingSummary(1), "Median 1 day to first reply");
  assert.equal(timingSummary(0), "Median 0 days to first reply");
  assert.equal(timingSummary(null), "No replies yet");
});
