import assert from "node:assert/strict";
import test from "node:test";
import { activitySummary, countRecent, timingLine, timingSummary, MIN_TIMING_SAMPLES } from "../src/features/dashboard/summaries.js";

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
  assert.equal(MIN_TIMING_SAMPLES, 5);
  assert.equal(timingSummary(7, 5), "Median 7 days to first reply");
  assert.equal(timingSummary(1, 12), "Median 1 day to first reply");
  assert.equal(timingSummary(0, 5), "Median 0 days to first reply");
  assert.equal(timingSummary(null, 0), "No replies yet");
});

test("a median resting on fewer than five replies is not shown", () => {
  assert.equal(timingSummary(116, 2), "Too few replies for a typical wait");
  assert.equal(timingSummary(9, 1), "Too few replies for a typical wait");
  assert.equal(timingSummary(9, undefined), "Too few replies for a typical wait");
  assert.equal(
    timingLine(116, 2),
    "2 replies with a recorded date so far: too few to give a typical time from Applied to first reply."
  );
  assert.equal(
    timingLine(9, 1),
    "1 reply with a recorded date so far: too few to give a typical time from Applied to first reply."
  );
  assert.equal(timingLine(7, 6), "Median 7 days from Applied to first reply, from 6 replies.");
  assert.equal(timingLine(null, 0), "No replies with a recorded date yet, so no median time to first reply.");
});

