import assert from "node:assert/strict";
import test from "node:test";
import { SUGGESTION_LIMIT, visibleSuggestions } from "../src/features/dashboard/visibleSuggestions.js";

const make = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));

test("four or fewer suggestions show in full with no toggle", () => {
  for (const n of [0, 1, SUGGESTION_LIMIT]) {
    const result = visibleSuggestions(make(n), false);
    assert.equal(result.items.length, n);
    assert.equal(result.hiddenCount, 0);
    assert.equal(result.canToggle, false);
  }
});

test("more than four are cut to four, with the rest counted", () => {
  const result = visibleSuggestions(make(7), false);
  assert.deepEqual(result.items.map((s) => s.id), ["s0", "s1", "s2", "s3"]);
  assert.equal(result.hiddenCount, 3);
  assert.equal(result.canToggle, true);
});

test("expanded shows everything and keeps the toggle for Show fewer", () => {
  const result = visibleSuggestions(make(7), true);
  assert.equal(result.items.length, 7);
  assert.equal(result.canToggle, true);
});
