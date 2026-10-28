// Exercise real cron orchestration with an admin client constrained to one QA
// user. It never enables auto_sync and never reads a real mailbox.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { syntheticEmails } from "../tests/fixtures/emails.mjs";
nextEnv.loadEnvConfig(process.cwd());
const session = JSON.parse(await readFile(process.argv[2], "utf8"));
const account = session.accounts[0];
assert.match(account.email, /^sync-qa-.*@example\.test$/);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const allowedTables = new Set(["email_connections", "applications", "application_suggestions", "processed_emails"]);
const scoped = {
  from(table) {
    assert.ok(allowedTables.has(table));
    const builder = admin.from(table);
    // Filter each entry operation, including updates, before any await.
    for (const operation of ["select", "update", "insert", "upsert"]) {
      if (!["select", "update"].includes(operation)) continue;
      const original = builder[operation].bind(builder);
      builder[operation] = (...args) => {
        const query = original(...args).eq("user_id", account.id);
        if (table === "email_connections" && operation === "select") {
          const eq = query.eq.bind(query);
          query.eq = (column, value) => eq(column, column === "auto_sync" ? false : value);
        }
        return query;
      };
    }
    // Real service inserts already include the explicit QA user ID.
    for (const operation of ["insert", "upsert"]) {
      const original = builder[operation].bind(builder);
      builder[operation] = (value, ...args) => {
        for (const row of Array.isArray(value) ? value : [value]) assert.equal(row.user_id, account.id);
        return original(value, ...args);
      };
    }
    return builder;
  },
  rpc(name, args) {
    assert.ok(["acquire_email_sync_lock", "release_email_sync_lock"].includes(name));
    assert.equal(args.p_user_id, account.id);
    return admin.rpc(name, args);
  },
};
const email = { ...syntheticEmails(session.run)[0], messageId: `<${session.run}-cron-recovery-${randomUUID()}@example.test>` };
mock.module("@/server/email/imapClient", { namedExports: { fetchEmails: async () => [email] } });
const { runAutoSync } = await import("@/server/email/autoSync");
const connection = async () => {
  const { data, error } = await admin.from("email_connections").select("auto_sync,last_auto_sync_at,last_auto_sync_error").eq("user_id", account.id).single();
  if (error) throw error;
  return data;
};
const before = await connection();
const realFetch = globalThis.fetch;
globalThis.fetch = (url, ...args) => String(url).startsWith("https://api.openai.com/")
  ? Promise.resolve(new Response("Synthetic provider outage", { status: 503 })) : realFetch(url, ...args);
let partial;
try { partial = await runAutoSync(scoped); } finally { globalThis.fetch = realFetch; }
assert.equal(partial.users, 1);
assert.equal(partial.failed, 1);
assert.equal((await connection()).last_auto_sync_at, before.last_auto_sync_at);
assert.ok((await connection()).last_auto_sync_error);
const recovered = await runAutoSync(scoped);
assert.equal(recovered.users, 1);
assert.equal(recovered.synced, 1);
const after = await connection();
assert.ok(after.last_auto_sync_at);
assert.equal(after.last_auto_sync_error, null);
assert.equal(after.auto_sync, false);
console.log(JSON.stringify({ partial, recovered, watermarkPreservedDuringFailure: true, errorClearedOnRecovery: true, liveAutoSyncEnabled: false }));
