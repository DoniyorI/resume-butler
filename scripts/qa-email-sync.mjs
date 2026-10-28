import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptSecret } from "@/server/crypto";

nextEnv.loadEnvConfig(process.cwd());
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (error) => { if (error) throw new Error(`${error.code || "QA_ERROR"}: ${error.message}`); };
const persist = (path, value) => writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 });

async function provision() {
  const directory = await mkdtemp(join(tmpdir(), "resume-butler-email-qa-"));
  await chmod(directory, 0o700);
  const path = join(directory, "session.json");
  const run = randomBytes(5).toString("hex");
  const session = { run, accounts: [], applications: {}, createdAt: new Date().toISOString() };
  for (const label of ["primary", "other"]) {
    const email = `sync-qa-${run}-${label}@example.test`;
    const password = `QA!${randomBytes(24).toString("base64url")}9a`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: "Email Sync QA", last_name: label, sync_qa_run: run },
    });
    fail(error);
    session.accounts.push({ label, email, password, id: data.user.id });
    await persist(path, session);
    const { error: profileError } = await admin.from("profiles")
      .update({ first_name: "Alex", last_name: `QA ${label}`, location: "Test City" })
      .eq("id", data.user.id);
    fail(profileError);
  }
  const primary = session.accounts[0];
  const { data, error } = await admin.from("applications").insert([
    { user_id: primary.id, company: "QA Acme Research", role: "Backend Engineer", status: "Applied", applied_date: "2026-10-20", source: "manual", comments: "Synthetic QA fixture: exact-match update" },
    { user_id: primary.id, company: "QA Acme Research", role: "Product Designer", status: "Applied", applied_date: "2026-10-19", source: "manual", comments: "Synthetic QA fixture: distinct role" },
    { user_id: primary.id, company: "QA Northstar", role: "Data Analyst", status: "Rejected", applied_date: "2026-03-01", source: "manual", comments: "Synthetic QA fixture: closed hiring cycle" },
    { user_id: primary.id, company: "QA Atlas", role: "Platform Engineer", status: "Applied", applied_date: "2026-03-01", source: "manual", comments: "Synthetic QA fixture: old hiring cycle" },
  ]).select("id,company,role,status,applied_date");
  fail(error);
  session.applications.primary = data;
  await persist(path, session);
  const { error: tenantError } = await admin.from("applications").insert({
    user_id: session.accounts[1].id, company: "QA Acme Research", role: "Backend Engineer",
    status: "Applied", applied_date: "2026-10-20", source: "manual", comments: "Synthetic QA fixture: another tenant",
  });
  fail(tenantError);
  const { error: connectionError } = await admin.from("email_connections").insert({
    user_id: primary.id, imap_host: "imap.gmail.com", imap_port: 993,
    email_address: primary.email, app_password: encryptSecret("SYNTHETIC-TRANSPORT-ONLY"),
    is_active: true, auto_sync: false,
  });
  fail(connectionError);
  console.log(JSON.stringify({ sessionPath: path, accounts: session.accounts.map(({ label, email, id }) => ({ label, email, id })), seededApplications: data.length, autoSyncEnabled: false }));
}

if (process.argv[2] === "provision") await provision();
else throw new Error("Usage: node --import ./tests/register.mjs scripts/qa-email-sync.mjs provision");
