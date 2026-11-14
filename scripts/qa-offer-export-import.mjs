// Signed-in browser check of offers, the full data export and the CSV import (migration 022):
//   offer card (save, reload, deadline step), Today, accept, "Close out your search",
//   decline + Withdrew, /api/export JSON and CSV, the Your data card download, the CSV import
//   preview / commit / undo, a second user's isolation and the 375px layout.
// Creates disposable @example.test users and deletes everything it created in `finally`.
// Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-offer-export-import.mjs [screenshotDir]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const base = "http://localhost:3000";
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("This check is restricted to the named QA project.");
if ((process.env.QA_APP_ORIGIN || base) !== base) throw new Error("This check only runs against http://localhost:3000.");

const shots = process.argv[2] || "/private/tmp/claude-501/-Users-doniyori--claude-spares-spare-7DQJBF/f0f1fa16-e7c8-45ce-8407-82abc31434a7/scratchpad/qa";
await mkdir(shots, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");

const run = randomBytes(5).toString("hex");
const email = `sync-qa-${run}-offers@example.test`;
const otherEmail = `sync-qa-${run}-offers-other@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const MISSING = ["42P01", "PGRST205", "PGRST200", "PGRST204"];
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return key(d); };
const csvPath = join(tmpdir(), `qa-import-${run}.csv`);
const CSV = [
  "Employer;Job Title;Stage;Date Applied;URL;Comments",
  "Import One Inc;Backend Dev;Interviewing;13/01/2026;https://example.test/one;first",
  "Import One Inc;Backend Dev;Interviewing;13/01/2026;https://example.test/one;again",
  "Existing Co;Dev;Rejected;01/12/2025;;dup of seeded",
  "Ghost Corp;Analyst;Ghosted;14/01/2026;;went quiet",
  "No Date Ltd;Designer;Applied;;;no date",
  ";Nobody;Applied;15/01/2026;;no employer",
].join("\n");

const steps = {}, observed = {}, pageErrors = [], screenshots = [];
const check = ({ data, error }) => { if (error) throw new Error(`${error.code || "DB"}: ${error.message}`); return data; };
async function step(name, needs, fn) {
  const missing = needs.filter(n => steps[n] !== "pass");
  if (missing.length) { steps[name] = `not reached (needs ${missing.join(",")})`; return; }
  try { await fn(); steps[name] = "pass"; }
  catch (error) { steps[name] = `fail: ${error.message.split("\n")[0].slice(0, 400)}`; }
}
async function shot(page, name) {
  const path = join(shots, name);
  await page.screenshot({ path, fullPage: true }).catch(() => {});
  screenshots.push(path);
}

const createdUsers = [];
let browser = null, cleanup = { ok: false };
try {
  const created = check(await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { first_name: "Offer QA", last_name: run, sync_qa_run: run },
  }));
  const userId = created.user.id;
  createdUsers.push(userId);

  const probe = await admin.from("application_offers").select("id").eq("user_id", userId).limit(1);
  if (probe.error) throw new Error(`Migration 022 does not look applied (${probe.error.code})`);

  const seed = {
    X: { company: "Acme Offer Co", role: "Staff Engineer", status: "Offered", applied_date: addDays(-30) },
    Y: { company: "Still Open LLC", role: "Engineer", status: "Applied", applied_date: addDays(-10) },
    Z: { company: "Existing Co", role: "Dev", status: "Rejected", applied_date: "2025-12-01" },
  };
  const ids = {};
  for (const [k, row] of Object.entries(seed)) {
    ids[k] = check(await admin.from("applications").insert({ user_id: userId, ...row }).select("id").single()).id;
  }
  const mine = table => admin.from(table).select("*").eq("user_id", userId);
  const apps = async () => check(await mine("applications"));
  const offerRow = async () => check(await admin.from("application_offers").select("*").eq("application_id", ids.X).maybeSingle());
  const deadlineRows = async () => check(await admin.from("application_activities").select("*").eq("application_id", ids.X).eq("kind", "offer_deadline"));
  const decideBy = addDays(5), startDate = addDays(40);

  await writeFile(csvPath, CSV);

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(`${error.message} @ ${new URL(page.url()).pathname.replace(/[0-9a-f-]{36}/, "<id>")}`));
  const login = async (p, who) => {
    await p.goto(`${base}/login`, { waitUntil: "networkidle" });
    await p.getByLabel("Email", { exact: true }).fill(who);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Login", exact: true }).click();
    await p.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  };
  const todayCard = () => page.locator("div.rounded-lg").filter({ has: page.getByRole("heading", { name: "Today", exact: true }) }).first();
  const text = async loc => (await loc.innerText()).replace(/\s+/g, " ");
  const offerCard = () => page.locator("#offer");
  const fetchText = (p, path) => p.evaluate(async path => { const r = await fetch(path); return { status: r.status, body: await r.text() }; }, path);

  await step("0-login", [], () => login(page, email));

  await step("1-offer-card", ["0-login"], async () => {
    await page.goto(`${base}/applications/${ids.X}`, { waitUntil: "networkidle" });
    await offerCard().waitFor();
    await offerCard().getByLabel("Base pay").fill("150000");
    await offerCard().getByLabel("Bonus").fill("10% target");
    await offerCard().getByLabel("Start date").fill(startDate);
    await offerCard().getByLabel("Decide by").fill(decideBy);
    await offerCard().getByRole("button", { name: "Save offer" }).click();
    await page.getByText("Offer saved", { exact: true }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await offerCard().getByLabel("Base pay").inputValue(), "150000");
    assert.equal(await offerCard().getByLabel("Bonus").inputValue(), "10% target");
    assert.equal(await offerCard().getByLabel("Start date").inputValue(), startDate);
    assert.equal(await offerCard().getByLabel("Decide by").inputValue(), decideBy);
    const cardText = await text(offerCard());
    observed.offerCard = cardText.slice(0, 120);
    assert.match(cardText, /\$150K/, `formatted pay shown (${cardText.slice(0, 120)})`);
    const offer = await offerRow();
    assert.ok(offer, "offer row exists");
    assert.equal(offer.decision, "pending");
    assert.equal(offer.base_amount, 150000);
    const open = (await deadlineRows()).filter(r => r.status === "open");
    assert.equal(open.length, 1, "one open offer_deadline step");
    assert.equal(open[0].due_on, decideBy);
    await shot(page, "offer-saved.png");
  });

  await step("2-today", ["1-offer-card"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const card = todayCard();
    await card.waitFor();
    const t = await text(card);
    observed.today = t.slice(0, 300);
    assert.ok(t.includes("Acme Offer Co"), `Today names Acme Offer Co (${t.slice(0, 300)})`);
    assert.match(t, /Decide on offer/i, "Today lists the offer deadline step");
    await shot(page, "today-deadline.png");
  });

  await step("3-accept", ["1-offer-card"], async () => {
    await page.goto(`${base}/applications/${ids.X}`, { waitUntil: "networkidle" });
    await offerCard().getByRole("button", { name: "Accept offer" }).click();
    await offerCard().getByRole("button", { name: "Confirm accept" }).click();
    await page.getByText("Offer accepted", { exact: true }).waitFor();
    await offerCard().getByText(/^Accepted on /).waitFor();
    await offerCard().getByRole("button", { name: "Change decision" }).waitFor();
    const offer = await offerRow();
    assert.equal(offer.decision, "accepted");
    assert.ok(offer.decided_on, "decided_on set");
    const rows = await deadlineRows();
    assert.ok(rows.length && rows.every(r => r.status === "done"), `deadline step done (${rows.map(r => r.status)})`);
    assert.equal(await offerCard().getByLabel("Decide by").count(), 0, "Decide by field is hidden once the offer is accepted");
    // Saving the notes of a decided offer must not bring the decide-by step back
    await offerCard().getByLabel("Notes").fill(`accepted, saved again ${run}`);
    await offerCard().getByRole("button", { name: "Save offer" }).click();
    await page.getByText("Offer saved", { exact: true }).waitFor();
    assert.equal((await offerRow()).notes, `accepted, saved again ${run}`);
    const after = await deadlineRows();
    assert.equal(after.filter(r => r.status === "open").length, 0, `no open offer_deadline step after saving (${after.map(r => r.status)})`);
  });

  await step("4-search-closed", ["3-accept"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const card = todayCard();
    await card.waitFor();
    const t = await text(card);
    observed.closeOut = t.slice(0, 400);
    assert.ok(t.includes("Close out your search"), `suggestion shown (${t.slice(0, 300)})`);
    assert.ok(t.includes("Acme Offer Co"), "names Acme Offer Co");
    assert.match(t, /\b1 other application is still open/, "1 other open application");
    await page.goto(`${base}/applications`, { waitUntil: "networkidle" });
    const row = page.locator("tr").filter({ hasText: "Acme Offer Co" }).first();
    await row.waitFor();
    const rt = await text(row);
    assert.ok(rt.includes("Accepted"), `row shows Accepted (${rt.slice(0, 150)})`);
    await shot(page, "applications-accepted.png");
  });

  await step("5-decline", ["3-accept"], async () => {
    await page.goto(`${base}/applications/${ids.X}`, { waitUntil: "networkidle" });
    await offerCard().getByRole("button", { name: "Change decision" }).click();
    await page.getByText("Decision cleared", { exact: true }).waitFor();
    await offerCard().getByRole("button", { name: "Decline offer" }).click();
    assert.equal(await offerCard().getByLabel("Move this application to Withdrew").isChecked(), true, "box checked by default");
    await offerCard().getByRole("button", { name: "Confirm decline" }).click();
    await page.getByText("Offer declined", { exact: true }).waitFor();
    const offer = await offerRow();
    assert.equal(offer.decision, "declined");
    const app = (await apps()).find(a => a.id === ids.X);
    assert.equal(app.status, "Withdrew");
    observed.declinedOffer = { decision: offer.decision, decided_on: offer.decided_on, updated_at: offer.updated_at };
  });

  await step("6-export-json", ["0-login"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const { status, body } = await fetchText(page, "/api/export");
    assert.equal(status, 200);
    for (const secret of ["app_password", "token_hash", "lease_token"]) assert.ok(!body.includes(secret), `export leaks ${secret}`);
    const json = JSON.parse(body);
    assert.equal(json.app, "Resume Butler");
    const companies = (json.data.applications || []).map(a => a.company || a.companyName);
    for (const c of ["Acme Offer Co", "Still Open LLC", "Existing Co"]) assert.ok(companies.includes(c), `applications contain ${c} (${companies})`);
    assert.equal((json.data.applicationOffers || []).length, 1, "one offer row");
    assert.deepEqual(json.summary.incomplete, [], "summary.incomplete empty");
    observed.exportKeys = Object.keys(json.data).length;
    await page.goto(`${base}/profile`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Your data", exact: true }).waitFor();
    await page.getByRole("button", { name: "Download applications (CSV)" }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download everything (JSON)" }).click(),
    ]);
    observed.downloadName = download.suggestedFilename();
    assert.ok(observed.downloadName.startsWith("resume-butler-export-"), `filename ${observed.downloadName}`);
  });

  await step("7-export-csv", ["0-login"], async () => {
    const { status, body } = await fetchText(page, "/api/export?format=csv");
    assert.equal(status, 200);
    const lines = body.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.length);
    assert.equal(lines[0], "Company,Role,Status,Applied date,Location,Link,Pay,Workplace,Employment type,Source,Notes");
    assert.equal(lines.length - 1, 3, `three data rows (${lines.length - 1})`);
  });

  await step("8-import-preview", ["0-login"], async () => {
    await page.goto(`${base}/applications/import`, { waitUntil: "networkidle" });
    await page.locator("#import-file").setInputFiles(csvPath);
    await page.getByRole("heading", { name: "Preview", exact: true }).waitFor();
    const totals = await text(page.locator("section[aria-label='Preview'] p[role='status']"));
    observed.totals = totals;
    assert.equal(totals, "2 ready, 2 already tracked, 1 without a readable date, 1 problem");
    const notice = await text(page.locator("section[aria-label='Preview']"));
    assert.ok(/Ghosted/.test(notice) && /not ones Resume Butler uses/.test(notice), "unknown-status notice mentions Ghosted");
    assert.equal(await page.locator("#import-date-order").inputValue(), "dmy", "date order is day/month");
    assert.ok(/Row\s+Company/.test(await text(page.locator("section[aria-label='Preview'] thead"))), "preview column is labelled Row");
    await shot(page, "import-preview.png");
  });

  await step("9-import-commit", ["8-import-preview"], async () => {
    await page.getByRole("button", { name: /^Import 2 applications$/ }).click();
    await page.getByRole("heading", { name: "Imported 2 applications." }).waitFor();
    const list = await apps();
    assert.equal(list.length, 5);
    const ghost = list.find(a => a.company === "Ghost Corp");
    assert.equal(ghost.status, "Applied");
    assert.equal(ghost.applied_date, "2026-01-14");
    assert.ok(String(ghost.comments || "").includes("Imported status: Ghosted"), `comments: ${ghost.comments}`);
    const one = list.find(a => a.company === "Import One Inc");
    assert.equal(one.status, "Interviewed");
    assert.equal(one.applied_date, "2026-01-13");
    assert.ok(!list.some(a => a.company === "No Date Ltd"), "no No Date Ltd row");
    await shot(page, "import-done.png");
  });

  await step("10-undo", ["9-import-commit"], async () => {
    await page.getByRole("button", { name: "Undo import" }).click();
    await page.getByText("Removed 2 applications.").waitFor();
    assert.equal((await apps()).length, 3);
  });

  await step("11-isolation", ["5-decline"], async () => {
    const other = check(await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { sync_qa_run: run } }));
    createdUsers.push(other.user.id);
    const before = await offerRow();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const second = await context.newPage();
    second.setDefaultTimeout(30000);
    second.on("pageerror", error => pageErrors.push(error.message));
    try {
      await login(second, otherEmail);
      await second.goto(`${base}/applications`, { waitUntil: "networkidle" });
      const listText = await text(second.locator("body"));
      for (const c of ["Acme Offer Co", "Still Open LLC", "Existing Co"]) assert.ok(!listText.includes(c), `B sees ${c}`);
      const { status, body } = await fetchText(second, "/api/export");
      assert.equal(status, 200);
      const json = JSON.parse(body);
      assert.equal((json.data.applications || []).length, 0, "B export has no applications");
      assert.equal((json.data.applicationOffers || []).length, 0, "B export has no offers");
      await second.goto(`${base}/applications/${ids.X}`, { waitUntil: "networkidle" });
      const pageText = await text(second.locator("body"));
      assert.ok(!pageText.includes("Acme Offer Co"), "B is shown A's application");
      assert.equal(await second.locator("#offer").count(), 0, "B sees an offer card for A's application");
    } finally { await context.close(); }
    const after = await offerRow();
    assert.deepEqual(after, before, "A's offer row unchanged");
    assert.equal((await apps()).length, 3);
  });

  await step("12-mobile-375", ["0-login"], async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    try {
      for (const path of ["/applications/import", `/applications/${ids.X}`]) {
        await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
        const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
        observed[`mobile ${path.replace(ids.X, "<X>")}`] = w;
        assert.ok(w.scroll <= w.inner + 1, `horizontal overflow on ${path} (${w.scroll} > ${w.inner})`);
        await shot(page, `mobile-${path.includes("import") ? "import" : "application"}.png`);
      }
    } finally { await page.setViewportSize({ width: 1440, height: 1100 }); }
  });

  steps["13-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  await rm(csvPath, { force: true }).catch(() => {});
  const left = {};
  try {
    for (const userId of createdUsers) {
      for (const table of ["application_offers", "application_activities", "application_suggestions", "applications", "job_opportunities"]) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !MISSING.includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      for (const table of ["application_offers", "application_activities", "applications"]) {
        const { count, error: countError } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (!countError && count) left[table] = (left[table] || 0) + count;
      }
      const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profile) left.profiles = (left.profiles || 0) + 1;
      const { data: got } = await admin.auth.admin.getUserById(userId);
      if (got?.user) left.authUser = (left.authUser || 0) + 1;
    }
    cleanup = Object.keys(left).length ? { ok: false, left } : { ok: true, users: createdUsers.length };
  } catch (error) {
    cleanup = { ok: false, error: error.message.slice(0, 200), users: createdUsers };
  }
  console.log(JSON.stringify({ run, steps, observed, pageErrors, screenshots, cleanup }, null, 1));
  if (cleanup.ok === false || Object.values(steps).some(v => v !== "pass")) process.exitCode = 1;
}
