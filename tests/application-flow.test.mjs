import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFlow } from "@/features/dashboard/data";

const apps = (statuses) => statuses.map((status, i) => ({ id: `fixture-${i}`, status }));
function conserved(flow, total) {
  assert.equal(
    flow.links.reduce((sum, link) => sum + link.value, 0),
    total
  );
  assert.equal(flow.total, total);
  if (total) {
    assert.deepEqual([...new Set(flow.links.map((link) => link.source))], [0]);
    assert.equal(flow.nodes[0].name, "All applications");
    assert.ok(flow.links.every((link) => link.target !== 0 && link.value > 0));
  }
}

test("all34 applications remain visible when only3 status transitions were recorded", () => {
  const applications = apps([...Array(30).fill("Applied"), "Pending", "Rejected", "Rejected", "Offered"]);
  const history = new Map([
    [
      "fixture-31",
      [
        { status: "Applied", changed_at: "2026-10-01" },
        { status: "Rejected", changed_at: "2026-10-02" },
      ],
    ],
    [
      "fixture-32",
      [
        { status: "Pending", changed_at: "2026-10-01" },
        { status: "Rejected", changed_at: "2026-10-02" },
      ],
    ],
    [
      "fixture-33",
      [
        { status: "Applied", changed_at: "2026-10-01" },
        { status: "Offered", changed_at: "2026-10-02" },
      ],
    ],
  ]);
  const flow = buildFlow(applications, history);
  conserved(flow, 34);
  assert.deepEqual(Object.fromEntries(flow.links.map((link) => [flow.nodes[link.target].name, link.value])), {
    Applied: 30,
    Pending: 1,
    Offered: 1,
    Rejected: 2,
  });
});

test("unchanged applications have a visible destination instead of an empty flow", () => {
  const flow = buildFlow(apps(Array(30).fill("Applied")), new Map());
  conserved(flow, 30);
  assert.equal(flow.nodes[flow.links[0].target].name, "Applied");
  assert.equal(flow.links[0].value, 30);
});

test("repeated and backward changes do not inflate the current-state flow", () => {
  const applications = apps(["Applied", "Interviewed"]);
  const history = new Map([
    [
      "fixture-0",
      ["Applied", "Interviewed", "Pending", "Applied", "Applied"].map((status, i) => ({
        status,
        changed_at: `2026-10-0${i + 1}`,
      })),
    ],
  ]);
  conserved(buildFlow(applications, history), 2);
  assert.deepEqual(buildFlow(applications, history), buildFlow(applications, new Map()));
});

test("unknown or missing statuses are accounted for explicitly", () => {
  const flow = buildFlow(apps(["Applied", "Unrecognized", null]), new Map());
  conserved(flow, 3);
  assert.equal(flow.links.find((link) => flow.nodes[link.target].name === "Unknown status").value, 2);
});

test("an empty account has no artificial application or link", () => {
  assert.deepEqual(buildFlow([], new Map()), { total: 0, nodes: [], links: [] });
});
