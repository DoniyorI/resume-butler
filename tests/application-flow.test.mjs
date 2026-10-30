import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFlow } from "@/features/dashboard/data";
const apps = (statuses) => statuses.map((status, i) => ({ id: `fixture-${i}`, status }));
const events = (statuses) =>
  statuses.map((status, i) => ({
    status,
    changed_at: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
  }));
const edge = (f, a, b) =>
  f.links.find((l) => f.nodes[l.source].id === a && f.nodes[l.target].id === b)?.value || 0;
function conserved(f, total) {
  assert.equal(f.total, total);
  let entries = 0,
    outcomes = 0;
  for (let i = 0; i < f.nodes.length; i++) {
    const n = f.nodes[i],
      incoming = f.links.filter((l) => l.target === i).reduce((s, l) => s + l.value, 0),
      outgoing = f.links.filter((l) => l.source === i).reduce((s, l) => s + l.value, 0);
    if (n.kind === "entry") {
      entries += outgoing;
      assert.equal(incoming, 0);
    } else if (n.kind === "outcome") {
      outcomes += incoming;
      assert.equal(outgoing, 0);
    } else {
      assert.equal(n.kind, "milestone");
      assert.equal(incoming, outgoing);
    }
  }
  assert.equal(entries, total);
  assert.equal(outcomes, total);
  assert.ok(f.links.every((l) => l.source < l.target && l.value > 0));
}
test("34 applications: two entry streams and one shared rejection pool", () => {
  const f = buildFlow(
    apps([...Array(30).fill("Applied"), "Rejected", "Rejected", "Interviewed", "Offered"]),
    new Map([
      ["fixture-30", events(["Applied", "Rejected"])],
      ["fixture-31", events(["Reached Out", "Interviewed", "Rejected"])],
      ["fixture-32", events(["Applied", "Interviewed"])],
      ["fixture-33", events(["Reached Out", "Interviewed", "Offered"])],
    ])
  );
  conserved(f, 34);
  for (const [a, b, v] of [
    ["entry:Applied", "outcome:Applied", 30],
    ["entry:Applied", "outcome:Rejected", 1],
    ["entry:Reached Out", "milestone:Interviewed", 2],
    ["entry:Applied", "milestone:Interviewed", 1],
    ["milestone:Interviewed", "outcome:Rejected", 1],
    ["milestone:Interviewed", "outcome:Interviewed", 1],
    ["milestone:Interviewed", "outcome:Offered", 1],
  ])
    assert.equal(edge(f, a, b), v, `${a} -> ${b}`);
  assert.equal(f.nodes.filter((n) => n.id === "outcome:Rejected").length, 1);
  assert.equal(f.unknownStarts, 0);
});
test("unchanged applications from both streams stay visible as waiting", () => {
  const f = buildFlow(apps([...Array(30).fill("Applied"), "Reached Out"]), new Map());
  conserved(f, 31);
  assert.equal(edge(f, "entry:Applied", "outcome:Applied"), 30);
  assert.equal(edge(f, "entry:Reached Out", "outcome:Applied"), 1);
  assert.equal(f.nodes.find((n) => n.id === "outcome:Applied").name, "Awaiting response");
});
test("missing entry history does not invent an origin or interview", () => {
  const f = buildFlow(apps(["Offered", "Rejected", "Interviewed"]), new Map());
  conserved(f, 3);
  assert.equal(f.unknownStarts, 3);
  assert.equal(edge(f, "entry:unknown", "outcome:Offered"), 1);
  assert.equal(edge(f, "entry:unknown", "outcome:Rejected"), 1);
  assert.equal(edge(f, "entry:unknown", "milestone:Interviewed"), 1);
});
test("repeated/backward changes visit interview once and cannot create cycles", () => {
  const f = buildFlow(
    apps(["Applied"]),
    new Map([["fixture-0", events(["Applied", "Interviewed", "Pending", "Interviewed", "Applied"])]])
  );
  conserved(f, 1);
  assert.equal(edge(f, "entry:Applied", "milestone:Interviewed"), 1);
  assert.equal(edge(f, "milestone:Interviewed", "outcome:Applied"), 1);
});
test("history is ordered without mutation; current application status wins", () => {
  const rows = events(["Reached Out", "Interviewed"]).reverse(),
    before = structuredClone(rows);
  const f = buildFlow(apps(["Rejected"]), new Map([["fixture-0", rows]]));
  conserved(f, 1);
  assert.equal(edge(f, "entry:Reached Out", "milestone:Interviewed"), 1);
  assert.equal(edge(f, "milestone:Interviewed", "outcome:Rejected"), 1);
  assert.deepEqual(rows, before);
});
test("Pending, Withdrew and unknown statuses remain counted", () => {
  const a = apps(["Pending", "Withdrew", null, "Unrecognized"]);
  const f = buildFlow(a, new Map(a.map((app) => [app.id, events(["Applied"])])));
  conserved(f, 4);
  assert.equal(edge(f, "entry:Applied", "outcome:Pending"), 1);
  assert.equal(edge(f, "entry:Applied", "outcome:Withdrew"), 1);
  assert.equal(edge(f, "entry:Applied", "outcome:unknown"), 2);
});
test("invalid and unrelated history cannot create milestones or totals", () => {
  const f = buildFlow(
    apps(["Rejected"]),
    new Map([
      ["fixture-0", [{ status: "Interviewed", changed_at: "invalid" }]],
      ["unrelated", events(["Applied", "Interviewed"])],
    ])
  );
  conserved(f, 1);
  assert.equal(f.unknownStarts, 1);
  assert.equal(
    f.nodes.some((n) => n.kind === "milestone"),
    false
  );
});
test("empty accounts have no artificial links", () => {
  assert.deepEqual(buildFlow([], new Map()), { total: 0, unknownStarts: 0, nodes: [], links: [] });
});
