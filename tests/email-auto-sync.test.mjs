import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

let behavior = async () => ({ errors: 0, suggestions: 1 });
mock.module("@/server/email/sync", { namedExports: { syncEmailsForUser: (...args) => behavior(...args) } });
const { runAutoSync } = await import("@/server/email/autoSync");
test("cron exposes capacity backlog and prioritizes the omitted inbox on its next run", async t => {
  const warning = t.mock.method(console, "warn", () => {});
  const connections = Array.from({ length: 51 }, (_, i) => ({ user_id: "qa-" + i, auto_sync: true, is_active: true, last_auto_sync_at: null, last_auto_sync_attempt_at: null }));
  const db = database({ email_connections: connections });
  const visited = [];
  behavior = async (_admin, userId) => { visited.push(userId); return { errors: 0, suggestions: 0 }; };
  const result = await runAutoSync(db);
  assert.equal(result.users, 50);
  assert.equal(result.remainingAtLeast, 1);
  assert.equal(visited.includes("qa-50"), false);
  assert.equal(warning.mock.calls[0].arguments[0], "email_sync_backlog");
  assert.equal(JSON.stringify(warning.mock.calls[0].arguments).includes("qa-"), false);
  visited.length = 0;
  await runAutoSync(db);
  assert.equal(visited[0], "qa-50");
});
const previous = "2026-10-20T12:00:00Z";
const setup = () => database({ email_connections: [{ user_id: "qa-user", auto_sync: true, is_active: true, last_auto_sync_at: previous }] });

test("failed auto-sync preserves the previous successful watermark", async () => {
  const db = setup();
  behavior = async () => { throw new Error("Synthetic outage"); };
  const result = await runAutoSync(db);
  assert.equal(result.failed, 1);
  assert.equal(db.tables.email_connections[0].last_auto_sync_at, previous);
  assert.ok(db.tables.email_connections[0].last_auto_sync_error);
});

test("partial email errors count as failed auto-sync instead of success", async () => {
  const db = setup();
  behavior = async () => ({ errors: 1, suggestions: 1 });
  const result = await runAutoSync(db);
  assert.equal(result.failed, 1);
  assert.equal(result.synced, 0);
  assert.equal(db.tables.email_connections[0].last_auto_sync_at, previous);
});

test("a successful auto-sync records a new successful watermark", async () => {
  const db = setup();
  behavior = async () => ({ errors: 0, suggestions: 2 });
  const result = await runAutoSync(db);
  assert.equal(result.synced, 1);
  assert.equal(result.suggestions, 2);
  assert.notEqual(db.tables.email_connections[0].last_auto_sync_at, previous);
});

test("a capped mailbox preserves the watermark and explains manual recovery", async () => {
  const db = setup();
  behavior = async () => ({ errors: 0, deferred: 12, truncated: 12, suggestions: 1 });
  const result = await runAutoSync(db);
  assert.equal(result.failed, 1);
  assert.equal(db.tables.email_connections[0].last_auto_sync_at, previous);
  assert.match(db.tables.email_connections[0].last_auto_sync_error, /smaller date range/i);
});

test("a failing inbox cannot starve an inbox that has waited longer for an attempt", async () => {
  const db = database({ email_connections: [
    { user_id: "failing", auto_sync: true, is_active: true, last_auto_sync_at: "2025-01-01", last_auto_sync_attempt_at: "2026-10-27" },
    { user_id: "waiting", auto_sync: true, is_active: true, last_auto_sync_at: "2026-10-20", last_auto_sync_attempt_at: "2026-10-20" },
  ] });
  const visited = [];
  behavior = async (_admin, userId) => { visited.push(userId); return { errors: 0, suggestions: 0 }; };
  await runAutoSync(db);
  assert.deepEqual(visited, ["waiting", "failing"]);
});
