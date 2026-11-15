import assert from "node:assert/strict";
import { test } from "node:test";
import { responseTimes } from "@/features/dashboard/data";

const row = (status, changed_at) => ({ status, changed_at });

test("response time counts only applications whose history shows Applied before Interviewed", () => {
  const applications = [
    { id: "normal", applied_date: "2026-10-01" },
    { id: "direct", applied_date: "2026-01-01" }, // added today straight at Interviewed with an old apply date
    { id: "unordered", applied_date: "2026-10-01" },
  ];
  const history = new Map([
    ["normal", [row("Applied", "2026-10-01T10:00:00Z"), row("Interviewed", "2026-10-08T10:00:00Z")]],
    ["direct", [row("Interviewed", "2026-11-10T10:00:00Z")]],
    ["unordered", [row("Interviewed", "2026-10-11T10:00:00Z"), row("Applied", "2026-10-01T10:00:00Z"), row("Interviewed", "2026-10-20T10:00:00Z")]],
  ]);
  assert.deepEqual(responseTimes(applications, history).sort((a, b) => a - b), [7, 10]);
});
