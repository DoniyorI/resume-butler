import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeResumeContent } from "../src/features/resumes/resumeDocument.js";
import { database } from "./helpers/database.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const load = () => import("../src/server/resume/saveDocument.js");

test("revisioned resume save rejects old/future formats and malformed custom sections before storage", async () => {
  const { saveResumeDocument } = await load();
  const db = database();
  for (const content of [{}, { ...normalizeResumeContent({}), schemaVersion: 99 }, { ...normalizeResumeContent({}), customSections: [{ id: "experience", type: "text", title: "bad", items: [] }] }]) {
    await assert.rejects(saveResumeDocument(db, id, content), error => error.status === 400);
  }
});

test("revisioned save retains input on setup or stale-tab conflicts and returns the new revision", async () => {
  const { saveResumeDocument } = await load();
  const db = database();
  const content = normalizeResumeContent({});
  await assert.rejects(saveResumeDocument(db, id, content), error => error.status === 503);
  db.rpc = async () => ({ error: { code: "55000" } });
  await assert.rejects(saveResumeDocument(db, id, content), error => error.status === 409);
  let args;
  db.rpc = async (name, input) => { args = input; return { data: { revision: 1 }, error: null }; };
  assert.deepEqual(await saveResumeDocument(db, id, content), { revision: 1 });
  assert.equal(args.p_expected_revision, 0);
  assert.equal(args.p_content.schemaVersion, 2);
});
