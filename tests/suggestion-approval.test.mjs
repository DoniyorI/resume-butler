import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
let response, args;
const supabase = {
  rpc: async (name, input) => { args = { name, ...input }; return response; },
  from: () => { throw new Error("Approval must not use non-transactional writes"); },
};
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase, user: { id: randomUUID() } }) } });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });
const { approveSuggestion, resolveSuggestion } = await import("@/features/suggestions/actions");
const fields = { company: "Acme", role: "Backend Engineer", status: "Interviewed" };
test("approval delegates validated fields to the identity-safe atomic RPC", async () => {
  const id = randomUUID(), applicationId = randomUUID();
  response = { data: applicationId, error: null };
  assert.deepEqual(await approveSuggestion(id, fields), { ok: true, data: { applicationId } });
  assert.deepEqual(args, { name: "approve_application_suggestion", p_suggestion_id: id, p_company: "Acme", p_role: "Backend Engineer", p_status: "Interviewed", p_identity_version: 1 });
});
for (const code of ["PGRST202", "42883", "55000", "P0002", "42501"]) {
  test(`approval error ${code} never falls back to unsafe direct writes`, async () => {
    response = { data: null, error: { code } };
    assert.equal((await approveSuggestion(randomUUID(), fields)).ok, false);
  });
}
test("invalid suggestion fields are rejected before reaching storage", async () => {
  args = null;
  assert.equal((await approveSuggestion("not-a-uuid", fields)).ok, false);
  assert.equal(args, null);
});
test("an invalid RPC result cannot report approval", async () => {
  response = { data: "not-a-uuid", error: null };
  assert.equal((await approveSuggestion(randomUUID(), fields)).ok, false);
});
test("durable matching transition refreshes review without reporting approval", async () => {
  response = { data: null, error: null };
  const result = await approveSuggestion(randomUUID(), fields);
  assert.equal(result.ok, false);
  assert.match(result.error, /matching/i);
});
// Real SQL status/cycle/ambiguity tests: scripts/qa-application-identity-sql.mjs.

test("explicit email matching supplies one owned target choice to the atomic resolver", async () => {
  const id = randomUUID(), applicationId = randomUUID();
  response = { data: applicationId, error: null };
  assert.equal((await resolveSuggestion(id, { ...fields, applicationId, createNew: false })).ok, true);
  assert.equal(args.name, "resolve_application_suggestion");
  assert.equal(args.p_target_application_id, applicationId);
  assert.equal(args.p_create_new, false);
});
test("matching rejects contradictory target/create-new choices", async () => {
  args = null;
  const result = await resolveSuggestion(randomUUID(), { ...fields, applicationId: randomUUID(), createNew: true });
  assert.equal(result.ok, false);
  assert.equal(args, null);
});
