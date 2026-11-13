import assert from "node:assert/strict";
import { test } from "node:test";
import { coverage, isStale, paginate, sortPostings } from "@/features/watchlist/order";

const fit = (band, demonstrated, listed, total) => ({ band, counts: { required: { total, demonstrated, listed } } });
const posting = (id, firstSeenAt, f) => ({ id, firstSeenAt, fit: f });

test("coverage counts a listed term as half and is 0 without required terms", () => {
  assert.equal(coverage(fit("good", 2, 2, 4)), 0.75);
  assert.equal(coverage(fit("unknown", 0, 0, 0)), 0);
  assert.equal(coverage(null), 0);
});

test("best fit orders by band, then coverage, then newest; no fit comes last", () => {
  const list = [
    posting("none", "2026-11-12", null),
    posting("low", "2026-11-12", fit("low", 0, 0, 4)),
    posting("good-old", "2026-11-01", fit("good", 3, 0, 4)),
    posting("good-new", "2026-11-10", fit("good", 3, 0, 4)),
    posting("good-better", "2026-11-02", fit("good", 4, 0, 4)),
    posting("strong", "2026-10-01", fit("strong", 4, 0, 4)),
    posting("unknown", "2026-11-12", fit("unknown", 0, 0, 0)),
    posting("stretch", "2026-11-12", fit("stretch", 1, 0, 4)),
  ];
  assert.deepEqual(sortPostings(list, "fit").map((p) => p.id), ["strong", "good-better", "good-new", "good-old", "stretch", "low", "unknown", "none"]);
  assert.deepEqual(list.map((p) => p.id)[0], "none", "input is not mutated");
});

test("newest orders by first seen", () => {
  const list = [posting("a", "2026-11-01", null), posting("b", "2026-11-09", fit("low", 0, 0, 1)), posting("c", "2026-11-05", null)];
  assert.deepEqual(sortPostings(list, "newest").map((p) => p.id), ["b", "c", "a"]);
});

test("paginate clamps the page and slices 30 at a time", () => {
  const list = Array.from({ length: 65 }, (_, i) => i);
  assert.equal(paginate(list, 1).items.length, 30);
  assert.equal(paginate(list, 3).items.length, 5);
  assert.equal(paginate(list, 9).page, 3);
  assert.equal(paginate(list, "x").page, 1);
  assert.deepEqual(paginate([], 1), { items: [], page: 1, pages: 1, total: 0 });
});

test("a company is stale when never checked or checked over 12 hours ago", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  assert.equal(isStale(null, now), true);
  assert.equal(isStale("2026-11-12T23:00:00Z", now), true);
  assert.equal(isStale("2026-11-13T02:00:00Z", now), false);
});
