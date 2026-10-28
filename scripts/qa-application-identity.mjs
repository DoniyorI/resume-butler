// Uses only the two pre-existing fictional QA accounts from the private session.
// Leaves this run's fixtures for visual inspection; never reads real user rows.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { recordApplication, recordApplicationInput } from "../src/server/extension/applications.js";
nextEnv.loadEnvConfig(process.cwd());
const session = JSON.parse(await readFile(process.argv[2], "utf8"));
const [owner, other] = session.accounts;
assert.ok(owner.email.endsWith("@example.test") && other.email.endsWith("@example.test"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const clients = await Promise.all([owner, other].map(async account => {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  assert.equal(data.user.id, account.id);
  return client;
}));
const [client, stranger] = clients;
const run = randomUUID().slice(0, 8), today = new Date().toISOString().slice(0, 10);
const check = result => { if (result.error) throw result.error; return result.data; };
const input = overrides => recordApplicationInput.parse({ company: `QA Identity ${run}`, role: "Engineer", appliedDate: today, url: "", eventId: randomUUID(), ...overrides });
const record = payload => recordApplication(service, owner.id, payload);
const company = `QA Review ${run}`;
const rows = check(await service.from("applications").insert([1, 2].map(index => ({ user_id: owner.id, company, role: "Engineer", status: "Applied", applied_date: today, portal_link: `https://boards.greenhouse.io/qa-${run}/jobs/${index}`, comments: `Synthetic identity QA ${run}` }))).select("id,portal_link"));
const event = input({ company });
assert.equal((await record(event)).status, "needs_matching");
assert.equal((await stranger.rpc("resolve_extension_application_event", { p_event_id: event.eventId, p_target_application_id: rows[0].id, p_create_new: false })).error?.code, "P0002");
assert.equal(check(await stranger.rpc("list_unresolved_extension_events")).some(e => e.eventId === event.eventId), false);
const resolve = () => client.rpc("resolve_extension_application_event", { p_event_id: event.eventId, p_target_application_id: rows[1].id, p_create_new: false });
const resolutions = (await Promise.all([resolve(), resolve()])).map(check);
assert.ok(resolutions.every(result => result.application.id === rows[1].id));
assert.equal((await record(event)).application.id, rows[1].id);

// Distinct HTTP requests hit independent live database transactions.
const concurrent = input({ company: `QA Concurrent ${run}`, url: `https://boards.greenhouse.io/qa-${run}/jobs/901`, postingId: "901", detectedBy: "greenhouse" });
const retries = await Promise.all([record(concurrent), record(concurrent)]);
assert.equal(retries[0].application.id, retries[1].application.id);
const suggestion = check(await service.from("application_suggestions").insert({ user_id: owner.id, message_id: `identity-concurrent-${run}`, company: concurrent.company, role: "Engineer", status: "Interviewed", kind: "new", category: "interview", email_date: new Date().toISOString() }).select("id").single());
const [approval, ingestion] = await Promise.all([
  client.rpc("approve_application_suggestion", { p_suggestion_id: suggestion.id, p_company: concurrent.company, p_role: "Engineer", p_status: "Interviewed", p_identity_version: 1 }),
  record({ ...concurrent, eventId: randomUUID() }),
]);
assert.equal(check(approval), ingestion.application.id);
const concurrentRows = check(await client.from("applications").select("id,status").eq("user_id", owner.id).eq("company", concurrent.company));
assert.equal(concurrentRows.length, 1);
assert.equal(concurrentRows[0].status, "Interviewed");

// Explicit separate creation resolves the original receipt, and deletion never
// recreates its application on replay.
const separateEvent = input({ company });
assert.equal((await record(separateEvent)).status, "needs_matching");
const separate = check(await client.rpc("resolve_extension_application_event", { p_event_id: separateEvent.eventId, p_target_application_id: null, p_create_new: true }));
assert.ok(!rows.some(row => row.id === separate.application.id));
assert.equal((await record(separateEvent)).application.id, separate.application.id);
check(await client.from("applications").delete().eq("user_id", owner.id).eq("id", separate.application.id));
await assert.rejects(record(separateEvent), error => error.status === 409);

// Seed unresolved items for actual Server Action/browser verification.
const browserEvent = input({ company });
assert.equal((await record(browserEvent)).status, "needs_matching");
const browserSuggestion = check(await service.from("application_suggestions").insert({ user_id: owner.id, message_id: `identity-browser-${run}`, company, role: "Engineer", status: "Interviewed", kind: "new", category: "interview", email_date: new Date().toISOString(), email_subject: "Interview invitation — synthetic QA", email_from: "qa@example.test", summary: "Fictional interview invite; choose the second opening.", match_reason: "multiple_candidates", match_candidate_ids: rows.map(row => row.id) }).select("id").single());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const base = process.env.QA_APP_ORIGIN || "http://localhost:3000";
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(owner.email);
  await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: /^Login$/ }).click();
  await page.waitForURL(current => !current.pathname.startsWith("/login"), { timeout: 45000 });
  await page.goto(`${base}/applications`, { waitUntil: "networkidle" });
  const review = page.locator("#matching");
  await review.getByText(company, { exact: false }).first().waitFor();
  const submission = review.locator("details").filter({ hasText: company });
  assert.equal(await submission.locator('input:checked').count(), 0);
  assert.equal(await submission.getByRole("button", { name: "Confirm match" }).isEnabled(), false);
  await page.screenshot({ path: "/tmp/resume-butler-identity-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/resume-butler-identity-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.reload({ waitUntil: "networkidle" });
  const existingChoice = page.locator('#matching details').filter({ hasText: company });
  await existingChoice.locator(`input[value="${rows[1].id}"]`).check();
  await existingChoice.getByRole("button", { name: "Confirm match" }).click();
  await existingChoice.waitFor({ state: "detached" });
  assert.equal((await record(browserEvent)).application.id, rows[1].id);

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${base}/email-sync`, { waitUntil: "networkidle" });
  const email = page.getByRole("listitem").filter({ hasText: company });
  assert.equal(await email.locator('input:checked').count(), 0);
  await page.screenshot({ path: "/tmp/resume-butler-identity-email.png", fullPage: true });
  await email.locator(`input[value="${rows[1].id}"]`).check();
  await email.getByRole("button", { name: "Confirm match" }).click();
  await email.waitFor({ state: "detached" });
  const updated = check(await client.from("applications").select("id,status").eq("user_id", owner.id).in("id", rows.map(row => row.id)));
  assert.equal(updated.find(row => row.id === rows[0].id).status, "Applied");
  assert.equal(updated.find(row => row.id === rows[1].id).status, "Interviewed");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("listitem").filter({ hasText: company }).count(), 0);
  assert.equal(errors.length, 0);
  const report = { run, checks: ["live concurrent duplicate ingestion", "simultaneous email approval and ingestion", "cross-account isolation", "concurrent resolution replay", "desktop and mobile matching", "refresh persistence", "only selected application status changes"], pageErrors: errors, browserSuggestion: browserSuggestion.id, screenshots: ["/tmp/resume-butler-identity-desktop.png", "/tmp/resume-butler-identity-mobile.png", "/tmp/resume-butler-identity-email.png"] };
  await writeFile("/tmp/resume-butler-identity-live-result.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
