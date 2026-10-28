import assert from "node:assert/strict";
import { test } from "node:test";
import { createTitleSave } from "@/features/resumes/titleSave";

test("title edits report Saving then Saved through one inline state", async () => {
  const states = [], saved = [];
  const controller = createTitleSave({ initial: "Original", save: async title => { saved.push(title); return { ok: true }; }, onState: state => states.push(state) });
  controller.update("New title");
  assert.equal(states.at(-1).status, "saving");
  await controller.flush();
  assert.deepEqual(saved, ["New title"]);
  assert.equal(states.at(-1).status, "saved");
});

test("rapid A B A title changes serialize without letting B overwrite the last A", async () => {
  const saved = [], states = [];
  const controller = createTitleSave({ initial: "Original", save: async title => { saved.push(title); return { ok: true }; }, onState: state => states.push(state) });
  controller.update("A"); const a = controller.flush();
  controller.update("B"); const b = controller.flush();
  controller.update("A"); const last = controller.flush();
  await Promise.all([a, b, last]);
  assert.deepEqual(saved, ["A", "B", "A"]);
  assert.equal(states.at(-1).status, "saved");
});

test("a failed rename stays Not saved and can be retried", async () => {
  const states = [];
  let calls = 0;
  const controller = createTitleSave({ initial: "Original", save: async () => ++calls === 1 ? { ok: false, error: "Network unavailable" } : { ok: true }, onState: state => states.push(state) });
  controller.update("New");
  await controller.flush();
  assert.equal(states.at(-1).status, "error");
  assert.equal(states.at(-1).error, "Network unavailable");
  await controller.flush();
  assert.equal(states.at(-1).status, "saved");
});

test("unchanged titles and overlapping flushes do not create duplicate writes", async () => {
  let calls = 0;
  const controller = createTitleSave({ initial: "Original", save: async () => { calls++; return { ok: true }; }, onState: () => {} });
  await controller.flush();
  assert.equal(calls, 0);
  controller.update("New");
  await Promise.all([controller.flush(), controller.flush()]);
  assert.equal(calls, 1);
});

test("an empty title reverts to the last saved name", async () => {
  let reverted;
  const controller = createTitleSave({ initial: "Original", save: async () => { throw new Error("Must not save blank"); }, onState: () => {}, onRevert: value => { reverted = value; } });
  controller.update(" ");
  await controller.flush();
  assert.equal(reverted, "Original");
});

test("the unsaved guard covers name edits and clears only after persistence", async () => {
  const controller = createTitleSave({ initial: "Original", save: async () => ({ ok: true }), onState: () => {} });
  assert.equal(controller.hasUnsaved(), false);
  controller.update("New");
  assert.equal(controller.hasUnsaved(), true);
  await controller.flush();
  assert.equal(controller.hasUnsaved(), false);
});
