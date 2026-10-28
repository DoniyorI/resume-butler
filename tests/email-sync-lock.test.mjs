import assert from "node:assert/strict";
import { test } from "node:test";
import { withEmailSyncLock } from "@/server/email/syncLock";

test("the compatibility lock rejects overlapping scans for one user", async () => {
  const missing = { rpc: async () => ({ error: { code: "PGRST202" } }) };
  let release;
  let entered;
  const ready = new Promise((resolve) => { entered = resolve; });
  const first = withEmailSyncLock(missing, "one-user", async () => {
    entered();
    await new Promise((resolve) => { release = resolve; });
    return "finished";
  });
  await ready;
  await assert.rejects(withEmailSyncLock(missing, "one-user", async () => "overlapped"), /already|running/i);
  assert.equal(await withEmailSyncLock(missing, "different-user", async () => "independent"), "independent");
  release();
  assert.equal(await first, "finished");
});

test("an existing database lease prevents a second scan", async () => {
  const occupied = { rpc: async () => ({ data: false, error: null }) };
  let ran = false;
  await assert.rejects(withEmailSyncLock(occupied, "qa-user", async () => { ran = true; }), /already|running/i);
  assert.equal(ran, false);
});

test("database lock failures do not silently disable concurrency protection", async () => {
  const broken = { rpc: async () => ({ data: null, error: { code: "XX000" } }) };
  let ran = false;
  await assert.rejects(withEmailSyncLock(broken, "qa-user", async () => { ran = true; }), /unavailable|lock/i);
  assert.equal(ran, false);
});

test("a scan failure releases its own database lease", async () => {
  const calls = [];
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } };
  await assert.rejects(withEmailSyncLock(db, "qa-user", async () => { throw new Error("Synthetic scan failure"); }), /Synthetic/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, "acquire_email_sync_lock");
  assert.equal(calls[1].name, "release_email_sync_lock");
  assert.equal(calls[0].args.p_user_id, "qa-user");
  assert.equal(calls[0].args.p_token, calls[1].args.p_token);
});
