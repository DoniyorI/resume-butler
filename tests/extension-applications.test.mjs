import assert from "node:assert/strict";
import { test } from "node:test";
import { recordApplication, recordApplicationInput } from "@/server/extension/applications";

const userId = "00000000-0000-4000-8000-000000000010";
const eventId = "00000000-0000-4000-8000-000000000020";
const application = { id: "00000000-0000-4000-8000-000000000030", company: "Acme", role: "Engineer", status: "Applied", appliedDate: "2026-10-28" };
const input = () => recordApplicationInput.parse({ company: "Acme", role: "Engineer", url: "https://boards.greenhouse.io/acme/jobs/123?gh_src=feed", eventId, postingId: "123", detectedBy: "greenhouse", appliedDate: "2026-10-28" });

test("recording forwards validated posting and stable event identity to atomic ingestion", async () => {
  let received;
  const admin = { rpc: async (name, args) => { received = { name, args }; return { data: { application, created: true }, error: null }; } };
  assert.deepEqual(await recordApplication(admin, userId, input()), { application, created: true });
  assert.equal(received.name, "record_extension_application");
  assert.equal(received.args.p_user_id, userId);
  assert.equal(received.args.p_event_id, eventId);
  assert.equal(received.args.p_payload.posting_platform, "greenhouse");
  assert.equal(received.args.p_payload.posting_namespace, "acme");
  assert.equal(received.args.p_payload.posting_id, "123");
  assert.equal(received.args.p_payload.portal_link, "https://job-boards.greenhouse.io/acme/jobs/123");
});
test("missing ingestion schema fails retryably without unsafe table writes", async () => {
  await assert.rejects(recordApplication({ rpc: async () => ({ data: null, error: { code: "PGRST202" } }) }, userId, input()), error => error.status === 503);
});
test("a committed unresolved event remains identifiable to the extension", async () => {
  const result = await recordApplication({ rpc: async () => ({ data: { status: "needs_matching", eventId }, error: null }) }, userId, input());
  assert.deepEqual(result, { status: "needs_matching", eventId });
});
test("payload conflicts and deleted replays cannot fall back to creating another row", async () => {
  await assert.rejects(recordApplication({ rpc: async () => ({ data: null, error: { code: "55000" } }) }, userId, input()), error => error.status === 409);
});
test("posting metadata disagreement is rejected before any database call", async () => {
  let called = false;
  await assert.rejects(recordApplication({ rpc: async () => { called = true; } }, userId, { ...input(), postingId: "456" }), error => error.status === 400);
  assert.equal(called, false);
});
test("legacy payloads receive a UUID without inventing a posting ID", async () => {
  let received;
  await recordApplication({ rpc: async (_, args) => { received = args; return { data: { application, created: false }, error: null }; } }, userId, recordApplicationInput.parse({ company: "Acme" }));
  assert.match(received.p_event_id, /^[0-9a-f-]{36}$/);
  assert.equal(received.p_payload.posting_id, null);
});
test("invalid event UUIDs and oversized IDs fail validation", () => {
  assert.equal(recordApplicationInput.safeParse({ company: "Acme", eventId: "not-an-id" }).success, false);
  assert.equal(recordApplicationInput.safeParse({ company: "Acme", postingId: "x".repeat(201) }).success, false);
});
