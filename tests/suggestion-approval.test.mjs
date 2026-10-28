import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const userId = "00000000-0000-4000-8000-000000000010";
let db;
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: db, user: { id: userId } }) } });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });
const { approveSuggestion } = await import("@/features/suggestions/actions");
const fields = { company: "Acme", role: "Backend Engineer", status: "Applied" };

function setup(application = {}, suggestion = {}) {
  const row = {
    id: randomUUID(), user_id: userId, state: "pending", kind: "new", application_id: null,
    category: "application_received", email_date: new Date().toISOString(), summary: "Synthetic confirmation", ...fields, ...suggestion,
  };
  db = database({
    applications: [{ id: randomUUID(), user_id: userId, ...fields, applied_date: "2026-10-20", ...application }],
    application_suggestions: [row],
  });
  return row;
}

test("approving a reapplication preserves the rejected application and creates a new cycle", async () => {
  const suggestion = setup({ status: "Rejected" });
  const result = await approveSuggestion(suggestion.id, fields);
  assert.equal(result.ok, true);
  assert.equal(db.tables.applications.length, 2);
  assert.equal(db.tables.applications[0].status, "Rejected");
  assert.notEqual(result.data.applicationId, db.tables.applications[0].id);
});

test("approving a reapplication preserves an old open hiring cycle", async () => {
  const suggestion = setup({ applied_date: "2025-01-01" });
  const result = await approveSuggestion(suggestion.id, fields);
  assert.equal(result.ok, true);
  assert.equal(db.tables.applications.length, 2);
});

test("stale email approval cannot overwrite a newer offer", async () => {
  const suggestion = setup({ status: "Offered" });
  Object.assign(db.tables.application_suggestions[0], { kind: "update", application_id: db.tables.applications[0].id });
  const result = await approveSuggestion(suggestion.id, { ...fields, status: "Rejected" });
  assert.equal(result.ok, false);
  assert.equal(db.tables.applications[0].status, "Offered");
  assert.equal(db.tables.application_suggestions[0].state, "pending");
});

test("a deleted update target is reported rather than recreated", async () => {
  const suggestion = setup({}, { kind: "update", application_id: randomUUID() });
  db.tables.applications = [];
  const result = await approveSuggestion(suggestion.id, { ...fields, status: "Interviewed" });
  assert.equal(result.ok, false);
  assert.equal(db.tables.applications.length, 0);
});

test("an existing recent application is reused and may advance", async () => {
  const suggestion = setup();
  const existingId = db.tables.applications[0].id;
  const result = await approveSuggestion(suggestion.id, { ...fields, status: "Interviewed" });
  assert.equal(result.ok, true);
  assert.equal(result.data.applicationId, existingId);
  assert.equal(db.tables.applications.length, 1);
  assert.equal(db.tables.applications[0].status, "Interviewed");
});

test("another user's suggestion cannot be approved", async () => {
  const suggestion = setup({}, { user_id: "another-user" });
  const result = await approveSuggestion(suggestion.id, fields);
  assert.equal(result.ok, false);
  assert.equal(db.tables.application_suggestions[0].state, "pending");
});

test("an installed atomic approval RPC supplies the application result", async () => {
  const suggestion = setup();
  const committed = randomUUID();
  db.rpc = async (name, args) => {
    assert.equal(name, "approve_application_suggestion");
    assert.equal(args.p_suggestion_id, suggestion.id);
    return { data: committed, error: null };
  };
  const result = await approveSuggestion(suggestion.id, fields);
  assert.equal(result.ok, true);
  assert.equal(result.data.applicationId, committed);
  assert.equal(db.tables.application_suggestions[0].state, "pending", "the RPC owns resolution; no second client-side write");
});

test("an atomic approval conflict cannot fall back to non-transactional writes", async () => {
  const suggestion = setup();
  db.rpc = async () => ({ data: null, error: { code: "55000" } });
  const result = await approveSuggestion(suggestion.id, { ...fields, status: "Interviewed" });
  assert.equal(result.ok, false);
  assert.equal(db.tables.applications[0].status, "Applied");
});

test("approval of a new edited title deduplicates exact roles only", async () => {
  const suggestion = setup();
  const result = await approveSuggestion(suggestion.id, { ...fields, role: "Engineer" });
  assert.equal(result.ok, true);
  assert.equal(db.tables.applications.length, 2);
});
