import assert from "node:assert/strict";
import { test } from "node:test";
const load = () => import("../src/features/resumes/documentSave.js");

test("a revision conflict stops later edits and queued saves from retrying stale writes", async () => {
  const { createDocumentSaver } = await load();
  let calls = 0;
  const saver = createDocumentSaver({ revision: 3, save: async () => { calls++; return { ok: false, status: 409, error: "Changed in another tab" }; } });
  const results = await Promise.all([saver.saveSnapshot({ header: "A" }), saver.saveSnapshot({ header: "B" })]);
  assert.equal(results[0].status, 409); assert.equal(results[1].status, 409);
  assert.equal(saver.isConflicted(), true);
  assert.equal((await saver.saveSnapshot({ header: "C" })).status, 409);
  assert.equal(calls, 1);
});

test("save queue uses the returned revision and permits transport failure retries", async () => {
  const { createDocumentSaver } = await load();
  const revisions = []; let failure = true;
  const saver = createDocumentSaver({ revision: 2, save: async content => { revisions.push(content.revision); if (failure) { failure = false; throw new Error("offline"); } return { ok: true, data: { revision: content.revision + 1 } }; } });
  const snapshot = { header: "A" };
  assert.equal((await saver.saveSnapshot(snapshot)).ok, false);
  assert.equal(saver.isConflicted(), false);
  assert.equal((await saver.saveSnapshot(snapshot)).data.revision, 3);
  await Promise.all([saver.saveSnapshot({ header: "B" }), saver.saveSnapshot({ header: "C" })]);
  assert.deepEqual(revisions, [2, 2, 3, 4]);
});
