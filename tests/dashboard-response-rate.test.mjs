import assert from "node:assert/strict";
import { test } from "node:test";
import { responseSummary } from "@/features/dashboard/data";

const app = (id, status) => ({ id, status });
const history = (entries) => new Map(Object.entries(entries).map(([id, statuses]) => [id, statuses.map((status) => ({ application_id: id, status }))]));

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
  assert.deepEqual(responseSummary(applications, byApp), { responses: 5, responseRate: Math.round((5 / 8) * 100) });
});

test("rate and count use the same set and handle no applications", () => {
  assert.deepEqual(responseSummary([]), { responses: 0, responseRate: 0 });
  assert.deepEqual(responseSummary([app("a", "Reached Out")]), { responses: 1, responseRate: 100 });
});
