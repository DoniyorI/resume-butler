import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
let args, result;
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: { rpc: async (name, input) => { args = { name, ...input }; return result; } }, user: { id: randomUUID() } }) } });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });
const { resolveExtensionEvent } = await import("@/features/applications/ingestionActions");
test("extension review resolves the original event without trusting a supplied account", async () => {
  const eventId = randomUUID(), applicationId = randomUUID();
  result = { data: { application: { id: applicationId }, created: false }, error: null };
  assert.equal((await resolveExtensionEvent(eventId, { applicationId, createNew: false, userId: randomUUID() })).ok, true);
  assert.deepEqual(args, { name: "resolve_extension_application_event", p_event_id: eventId, p_target_application_id: applicationId, p_create_new: false });
});
for (const code of ["P0002", "42501", "55000", "PGRST202"]) {
  test(`extension review error ${code} keeps the resolution unsuccessful`, async () => {
    result = { data: null, error: { code } };
    assert.equal((await resolveExtensionEvent(randomUUID(), { applicationId: null, createNew: true })).ok, false);
  });
}
test("a contradictory resolution never reaches storage", async () => {
  args = null;
  assert.equal((await resolveExtensionEvent(randomUUID(), { applicationId: randomUUID(), createNew: true })).ok, false);
  assert.equal(args, null);
});
