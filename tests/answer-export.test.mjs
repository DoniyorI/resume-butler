import assert from "node:assert/strict";
import { mock, test } from "node:test";
let data;
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: { rpc: async () => ({ data, error: null }) } }) } });
const { GET } = await import("@/app/api/answers/export/route");
test("answer exports retain complete Unicode text across streamed chunk boundaries", async () => {
  data = { schemaVersion: 1, answers: [{ answer: "x".repeat(32700) + "😀".repeat(50000) }], versions: Array.from({ length: 1100 }, (_, revision) => ({ revision })) };
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), data);
});
test("an invalid export envelope cannot be downloaded as a successful backup", async () => {
  data = null;
  const log = mock.method(console, "error", () => {});
  try { assert.equal((await GET()).status, 500); } finally { log.mock.restore(); }
});
