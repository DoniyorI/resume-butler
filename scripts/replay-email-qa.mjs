// Uses only the dedicated accounts recorded by qa-email-sync.mjs provision.
// Real auth, database and AI; the IMAP transport alone is synthetic.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { mock } from "node:test";
import assert from "node:assert/strict";
import { syntheticEmails } from "../tests/fixtures/emails.mjs";

nextEnv.loadEnvConfig(process.cwd());
const path = process.argv[2];
const session = JSON.parse(await readFile(path, "utf8"));
assert.match(session.accounts[0].email, /^sync-qa-.*@example\.test$/);
const clients = [];
for (const account of session.accounts) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  clients.push(client);
}
mock.module(new URL("../src/server/email/imapClient.js", import.meta.url).href, {
  namedExports: { fetchEmails: async () => syntheticEmails(session.run) },
});
const { syncEmailsForUser } = await import("@/server/email/sync");
const [primary, other] = clients;
const userId = session.accounts[0].id;
const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const applications = () => primary.from("applications").select("id,company,role,status,applied_date").eq("user_id", userId).order("id").then(unwrap);
const before = await applications();
const result = await syncEmailsForUser(primary, userId, { from: "2026-10-26", to: "2026-10-27" });
assert.equal(result.errors, 0);
assert.equal(result.deferred, 0);
const suggestions = unwrap(await primary.from("application_suggestions").select("id,kind,application_id,company,role,status,state").eq("user_id", userId).eq("state", "pending"));
assert.equal(suggestions.length, 7);
const find = (company, role) => suggestions.find(s => s.company === company && s.role === role);
assert.equal(find("QA Acme Research", "Backend Engineer").kind, "update");
assert.equal(find("QA Acme Research", "Backend Engineer").status, "Interviewed");
assert.equal(find("QA Acme Research", "Product Designer").status, "Rejected");
assert.equal(find("QA Acme Research", "Security Engineer").kind, "new");
assert.equal(find("QA Northstar", "Data Analyst").kind, "new");
assert.equal(find("QA Atlas", "Platform Engineer").kind, "new");
assert.equal(find("QA Orbit Labs", "Frontend Engineer").status, "Offered");
assert.equal(find("QA Meridian", "Research Engineer").kind, "new");
assert.deepEqual(await applications(), before, "scan must never mutate applications");
const repeated = await syncEmailsForUser(primary, userId, { from: "2026-10-26", to: "2026-10-27" });
assert.equal(repeated.candidates, 0);
assert.equal(repeated.suggestions, 0);
assert.equal(unwrap(await other.from("applications").select("id").eq("user_id", userId)).length, 0);
assert.equal(unwrap(await other.from("application_suggestions").select("id").eq("user_id", userId)).length, 0);
const forbidden = await other.from("applications").update({ status: "Offered" }).eq("id", before[0].id).select("id");
assert.equal(unwrap(forbidden).length, 0);
assert.deepEqual(await applications(), before);
session.replay = { result, repeated, suggestions, verifiedAt: new Date().toISOString() };
await writeFile(path, JSON.stringify(session, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ accounts: session.accounts.map(({ email }) => email), result, repeated, tenantIsolation: "passed", applicationsUnchanged: true, suggestions }, null, 2));
