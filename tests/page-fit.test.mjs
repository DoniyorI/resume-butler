import assert from "node:assert/strict";
import { test } from "node:test";
import { pageFit } from "@/features/resumes/pageFit";

const measure = percent => ({ usedPx: 960 * percent / 100, limitPx: 960 });

test("confirmed one-page PDF overrides an overflowing browser estimate", () => {
  assert.equal(pageFit(measure(102), 1).over, false);
});

test("confirmed multi-page PDF overrides a fitting browser estimate", () => {
  assert.equal(pageFit(measure(99), 2).over, true);
});

test("99 and 100 percent are green target usage", () => {
  for (const percent of [90, 95, 99, 100]) {
    const result = pageFit(measure(percent));
    assert.equal(result.tone, "green");
    assert.equal(result.percent, percent);
    assert.equal(result.over, false);
  }
});

test("low fill is amber rather than rewarding unused space", () => {
  for (const percent of [10, 50, 80, 89]) assert.equal(pageFit(measure(percent)).tone, "amber");
  assert.equal(pageFit(measure(50), 1).tone, "amber");
});

test("a confirmed one-page PDF retains the honest estimate instead of clamping it", () => {
  const result = pageFit(measure(102), 1);
  assert.equal(result.percent, 102);
  assert.equal(result.tone, "green");
  assert.equal(result.over, false);
});

test("unconfirmed overflow needs verification, not a claim that PDF has two pages", () => {
  const result = pageFit(measure(102));
  assert.equal(result.state, "over");
  assert.equal(result.percent, 102);
  assert.equal(result.tone, "amber");
});

test("only confirmed multiple PDF pages are red", () => {
  const result = pageFit(measure(70), 2);
  assert.equal(result.tone, "red");
  assert.equal(result.over, true);
});

test("rounding cannot disguise overflow or move underfill into the target band", () => {
  assert.equal(pageFit(measure(100.2)).state, "over");
  assert.equal(pageFit(measure(89.8)).tone, "amber");
});

test("missing and invalid layout measurements remain unmeasured", () => {
  for (const fit of [{ usedPx: 0, limitPx: 0 }, { usedPx: NaN, limitPx: 960 }, { usedPx: -2, limitPx: 960 }]) {
    const result = pageFit(fit);
    assert.equal(result.state, "unmeasured");
    assert.equal(result.over, false);
    assert.equal(Number.isFinite(result.percent), true);
  }
});
