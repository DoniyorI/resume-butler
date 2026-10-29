import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";
const load = () => import("../src/server/answers/service.js");
const id = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const content = { label: "Backend project", question: "Tell us about a project", answer: "I built a fictional QA API.", category: "project", tags: ["backend"], sourceNote: "My project notes", sourceUrl: "https://example.test/project" };

test("answer approval is explicit and archive commands cannot overwrite content", async () => {
  const { answerCommandInput } = await load();
  const base = { id, eventId, expectedRevision: 0 };
  assert.equal(answerCommandInput.safeParse({ ...base, content }).success, false);
  assert.equal(answerCommandInput.safeParse({ ...base, action: "draft", content: { ...content, answer: " " } }).success, false);
  assert.equal(answerCommandInput.safeParse({ ...base, action: "approve", content }).success, true);
  assert.equal(answerCommandInput.safeParse({ ...base, action: "archive", content }).success, false);
  assert.equal(answerCommandInput.safeParse({ ...base, action: "restore" }).success, true);
  assert.equal(answerCommandInput.safeParse({ ...base, action: "approve", content: { ...content, sourceUrl: "javascript:alert(1)" } }).success, false);
});

test("save commands use the session RPC and keep conflict/setup failures actionable", async () => {
  const { answerCommandInput, saveAnswer } = await load();
  const input = answerCommandInput.parse({ id, eventId, expectedRevision: 0, action: "approve", content });
  let sent;
  const database = { rpc: async (name, args) => { sent = { name, args }; return { data: { id, revision: 1 }, error: null }; } };
  await saveAnswer(database, input);
  assert.equal(sent.name, "save_reusable_answer");
  assert.equal(sent.args.p_action, "approve");
  assert.equal(sent.args.p_expected_revision, 0);
  assert.deepEqual(sent.args.p_content, content);
  assert.equal("p_user_id" in sent.args, false);
  for (const [code, status] of [["55000", 409], ["P0002", 404], ["PGRST202", 503]]) {
    await assert.rejects(saveAnswer({ rpc: async () => ({ error: { code } }) }, input), error => error.status === status);
  }
});

test("reuse rejects drafts, archived answers and stale approved revisions", async () => {
  const { getApprovedAnswer } = await load();
  const db = database({ reusable_answers: [{ id, user_id: "owned-user", revision: 2, approved_at: "2026-10-29T10:00:00Z", archived_at: null, ...content }] });
  assert.equal((await getApprovedAnswer(db, "owned-user", id, 2)).answer, content.answer);
  await assert.rejects(getApprovedAnswer(db, "foreign-user", id, 2), error => error.status === 404);
  await assert.rejects(getApprovedAnswer(db, "owned-user", id, 1), error => error.status === 409);
  db.tables.reusable_answers[0].approved_at = null;
  await assert.rejects(getApprovedAnswer(db, "owned-user", id, 2), error => error.status === 409);
  Object.assign(db.tables.reusable_answers[0], { approved_at: "2026-10-29T10:00:00Z", archived_at: "2026-10-29T11:00:00Z" });
  await assert.rejects(getApprovedAnswer(db, "owned-user", id, 2), error => error.status === 409);
  db.tables.reusable_answers = [];
  await assert.rejects(getApprovedAnswer(db, "owned-user", id, 2), error => error.status === 404);
});
