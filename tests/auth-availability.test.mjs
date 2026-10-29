import assert from "node:assert/strict";
import { mock, test } from "node:test";
mock.module("next/navigation", { namedExports: { redirect: () => { throw new Error("Unexpected redirect"); } } });
mock.module("react", { namedExports: { cache: fn => fn } });
let response;
const client = { auth: { getUser: async () => response } };
mock.module("@/lib/supabase/server", { namedExports: { createClient: () => client } });
const { getCurrentUser, requireUser } = await import(process.env.AUTH_MODULE || "@/server/auth");
test("temporary auth provider failures are unavailable, not a sign-out redirect or unauthorized response", async () => {
  for (const status of [0, 429, 500, 503]) {
    response = { data: { user: null }, error: { status, name: "AuthRetryableFetchError" } };
    await assert.rejects(getCurrentUser(), error => error.status === 503);
    await assert.rejects(requireUser(), error => error.status === 503);
  }
});
test("verified users pass; definitive missing/invalid sessions remain signed out", async () => {
  response = { data: { user: { id: "verified-user" } }, error: null };
  assert.equal((await requireUser()).user.id, "verified-user");
  for (const status of [400, 401, 403]) {
    response = { data: { user: null }, error: { status } };
    assert.equal((await getCurrentUser()).user, null);
    await assert.rejects(requireUser(), error => error.status === 401);
  }
});
