import assert from "node:assert/strict";
import { test } from "node:test";
import { createPdfFitCheck } from "@/features/resumes/pdfFitCheck";

const drain = () => new Promise(resolve => setImmediate(resolve));
function setup(t, overrides = {}) {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  const states = [], calls = [];
  const checker = createPdfFitCheck({
    flush: async () => true,
    compile: async key => { calls.push(key); return 1; },
    onChange: state => states.push(state),
    ...overrides,
  });
  return { checker, calls, states, advance: async ms => { t.mock.timers.tick(ms); await drain(); } };
}

test("automatic PDF check only starts after overflowing content settles", async t => {
  const { checker, calls, advance } = setup(t);
  checker.update("a", false);
  await advance(2000);
  assert.equal(calls.length, 0);
  checker.update("a", true);
  await advance(1000);
  assert.equal(calls.length, 0);
  checker.update("b", true);
  await advance(1000);
  assert.equal(calls.length, 0);
  await advance(600);
  assert.deepEqual(calls, ["b"]);
});

test("cached results are reused for unchanged content and undo", async t => {
  const { checker, calls, states, advance } = setup(t);
  checker.update("a", true);
  await advance(1600);
  checker.update("a", true);
  checker.update("b", false);
  checker.update("a", true);
  await advance(60_000);
  assert.deepEqual(calls, ["a"]);
  assert.equal(states.at(-1).pages, 1);
});

test("a late result cannot confirm a different edited document", async t => {
  let finish;
  const { checker, states, advance } = setup(t, { compile: () => new Promise(resolve => { finish = resolve; }) });
  checker.update("old", true);
  await advance(1600);
  checker.update("new", false);
  finish(2);
  await drain();
  assert.equal(states.at(-1).pages, null);
  assert.equal(states.at(-1).key, "new");
});

test("manual clicks and automatic scheduling cannot overlap compilation", async t => {
  let finish;
  const calls = [];
  const { checker, advance } = setup(t, { compile: key => { calls.push(key); return new Promise(resolve => { finish = resolve; }); } });
  checker.update("a", true);
  const first = checker.checkNow();
  await drain();
  const second = checker.checkNow();
  await advance(2000);
  assert.deepEqual(calls, ["a"]);
  finish(1);
  await Promise.all([first, second]);
});

test("failed checks do not automatically retry; manual retry remains available", async t => {
  let calls = 0;
  const { checker, states, advance } = setup(t, { compile: async () => { if (++calls === 1) throw new Error("Synthetic compile outage"); return 1; } });
  checker.update("a", true);
  await advance(1600);
  assert.equal(states.at(-1).status, "error");
  checker.update("a", true);
  await advance(60_000);
  assert.equal(calls, 1);
  await checker.checkNow();
  assert.equal(calls, 2);
  assert.equal(states.at(-1).pages, 1);
});

test("an unsuccessful save prevents PDF requests", async t => {
  const { checker, calls, states, advance } = setup(t, { flush: async () => false });
  checker.update("a", true);
  await advance(1600);
  assert.deepEqual(calls, []);
  assert.equal(states.at(-1).status, "error");
});

test("automatic checks respect a cooldown after earlier compilation", async t => {
  const { checker, calls, advance } = setup(t);
  checker.update("a", true);
  await advance(1600);
  checker.update("b", true);
  await advance(2000);
  assert.deepEqual(calls, ["a"]);
  await advance(30_000);
  assert.deepEqual(calls, ["a", "b"]);
});

test("unmount cancels scheduled checks and ignores in-flight completion", async t => {
  const { checker, calls, states, advance } = setup(t);
  checker.update("a", true);
  checker.dispose();
  const count = states.length;
  await advance(2000);
  assert.deepEqual(calls, []);
  assert.equal(states.length, count);
});
