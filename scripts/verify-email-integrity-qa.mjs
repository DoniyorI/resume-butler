// Run after migration 011. Every mutation targets dedicated synthetic QA rows.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
const session = JSON.parse(await readFile(process.argv[2], "utf8"));
const clients = [];
for (const account of session.accounts) {
  assert.match(account.email, /^sync-qa-.*@example\.test$/);
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  clients.push(client);
}
const [primary, other] = clients;
const userId = session.accounts[0].id;
const token = randomUUID();
const args = { p_user_id: userId, p_token: token };
const acquired = await primary.rpc("acquire_email_sync_lock", args);
if (acquired.error) throw new Error(`Migration 011 is required (${acquired.error.code}). No QA applications changed.`);
assert.equal(acquired.data, true);
try {
  const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await anonymous.rpc("acquire_email_sync_lock", args)).error?.code, "42501");
  assert.equal((await primary.from("email_sync_locks").select("user_id").eq("user_id", userId)).error?.code, "42501");
  assert.equal((await primary.rpc("consume_auth_rate_limit", { p_bucket: `qa-${session.run}`, p_limit: 1, p_window_seconds: 60 })).error?.code, "42501");
  assert.equal((await primary.rpc("acquire_email_sync_lock", { ...args, p_token: randomUUID() })).data, false);
  assert.equal((await other.rpc("acquire_email_sync_lock", args)).error?.code, "42501");
  await primary.rpc("release_email_sync_lock", { ...args, p_token: randomUUID() });
  assert.equal((await primary.rpc("acquire_email_sync_lock", { ...args, p_token: randomUUID() })).data, false);
} finally {
  const { error } = await primary.rpc("release_email_sync_lock", args);
  if (error) throw error;
}
const { data: suggestions, error } = await primary.from("application_suggestions").select("id,company,role,status,state")
  .eq("user_id", userId).eq("company", "QA Atlas");
if (error) throw error;
assert.equal(suggestions.length, 1);
const suggestion = suggestions[0];
const approval = { p_suggestion_id: suggestion.id, p_company: suggestion.company, p_role: suggestion.role, p_status: suggestion.status };
const denied = await other.rpc("approve_application_suggestion", approval);
assert.equal(denied.error?.code, "P0002");
const results = await Promise.all([primary.rpc("approve_application_suggestion", approval), primary.rpc("approve_application_suggestion", approval)]);
for (const result of results) assert.equal(result.error, null);
assert.equal(results[0].data, results[1].data, "concurrent approval must return one application");
const { data: applications, error: appError } = await primary.from("applications").select("id,status")
  .eq("user_id", userId).eq("company", "QA Atlas");
if (appError) throw appError;
assert.equal(applications.length, 2, "old cycle retained, exactly one new cycle created");
// Stale approval must roll back without resolving the suggestion or changing
// the newer application status. Restore the synthetic manual edit afterward.
const { data: stale, error: staleReadError } = await primary.from("application_suggestions")
  .select("id,application_id,company,role,status,state").eq("user_id", userId)
  .eq("company", "QA Acme Research").eq("role", "Product Designer").single();
if (staleReadError) throw staleReadError;
assert.equal(stale.state, "pending");
const { data: target, error: targetError } = await primary.from("applications").select("status")
  .eq("user_id", userId).eq("id", stale.application_id).single();
if (targetError) throw targetError;
assert.equal(target.status, "Applied");
try {
  const changed = await primary.from("applications").update({ status: "Offered" })
    .eq("user_id", userId).eq("id", stale.application_id).eq("status", target.status).select("id");
  if (changed.error) throw changed.error;
  assert.equal(changed.data.length, 1);
  const rejected = await primary.rpc("approve_application_suggestion", {
    p_suggestion_id: stale.id, p_company: stale.company, p_role: stale.role, p_status: stale.status,
  });
  assert.equal(rejected.error?.code, "55000");
  const current = await primary.from("applications").select("status").eq("user_id", userId).eq("id", stale.application_id).single();
  if (current.error) throw current.error;
  assert.equal(current.data.status, "Offered");
  const pending = await primary.from("application_suggestions").select("state").eq("user_id", userId).eq("id", stale.id).single();
  if (pending.error) throw pending.error;
  assert.equal(pending.data.state, "pending");
} finally {
  const restored = await primary.from("applications").update({ status: target.status })
    .eq("user_id", userId).eq("id", stale.application_id).eq("status", "Offered");
  if (restored.error) throw restored.error;
}
console.log(JSON.stringify({ leaseExclusion: true, leaseTenantIsolation: true, tokenOwnership: true, approvalTenantIsolation: true, concurrentApprovalIdempotent: true, hiringCyclesRetained: true, staleApprovalRolledBack: true }));
