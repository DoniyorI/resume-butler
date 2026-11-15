import assert from "node:assert/strict";
import { test } from "node:test";
import { median, responseTimes } from "@/features/dashboard/data";

const row = (status, changed_at) => ({ status, changed_at });

test("response time counts only applications whose history shows Applied before the first reply", () => {
  const applications = [
    { id: "normal", applied_date: "2026-10-01" },
    { id: "direct", applied_date: "2026-01-01" }, // added today straight at Interviewed with an old apply date
    { id: "unordered", applied_date: "2026-10-01" },
    { id: "recruiter", applied_date: "2026-10-01" }, // Reached Out is a first response too
    { id: "none", applied_date: "2026-10-01" },
  ];
  const history = new Map([
    ["normal", [row("Applied", "2026-10-01T10:00:00Z"), row("Interviewed", "2026-10-08T10:00:00Z")]],
    ["direct", [row("Interviewed", "2026-11-10T10:00:00Z")]],
    ["unordered", [row("Interviewed", "2026-10-11T10:00:00Z"), row("Applied", "2026-10-01T10:00:00Z"), row("Interviewed", "2026-10-20T10:00:00Z")]],
    ["recruiter", [row("Applied", "2026-10-01T10:00:00Z"), row("Reached Out", "2026-10-04T10:00:00Z"), row("Interviewed", "2026-10-15T10:00:00Z")]],
    ["none", [row("Applied", "2026-10-01T10:00:00Z"), row("Rejected", "2026-10-05T10:00:00Z")]],
  ]);
  const times = responseTimes(applications, history).sort((a, b) => a - b);
  assert.deepEqual(times, [3, 7, 10]);
  assert.equal(median(times), 7);
  assert.equal(median([...times, 12]), 8.5);
});
