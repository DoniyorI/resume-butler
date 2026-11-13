// Signed-in browser check of "Next actions": the dashboard's Today card and
// rule-based suggestions, and the application page's Next steps card.
// Detects whether migration 020 is applied:
//   - before it: Today renders, suggestions appear for seeded applications
//     (Applied 20 days ago, Offered, Interviewed), the application page shows
//     "Next steps need migration 020" and still saves, no page errors;
//   - after it: add an assessment due tomorrow and a timed interview, see both
//     in Today, mark one done, reschedule the other, delete, and confirm
//     another user's application id is refused by the database.
// Creates disposable @example.test users and deletes everything it created in
// `finally`. Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-next-steps.mjs [screenshotDir]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { addDays, localDateKey } from "@/features/activities/kinds";

nextEnv.loadEnvConfig(process.cwd());
const base = "http://localhost:3000";
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("This check is restricted to the named QA project.");
if ((process.env.QA_APP_ORIGIN || base) !== base) throw new Error("This check only runs against http://localhost:3000.");

const shots = process.argv[2] || "/tmp/resume-butler-next-steps-qa";
await mkdir(shots, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");

const run = randomBytes(5).toString("hex");
const email = `sync-qa-${run}-nextsteps@example.test`;
const otherEmail = `sync-qa-${run}-nextsteps-other@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const today = localDateKey();
const companies = { applied: `Waiting QA ${run}`, offered: `Offer QA ${run}`, interviewed: `Interview QA ${run}` };
const MISSING = ["42P01", "PGRST205", "PGRST200", "PGRST204"];

const steps = {}, observed = {}, pageErrors = [], screenshots = [];
const ctx = {};
const check = ({ data, error }) => { if (error) throw new Error(`${error.code || "DB"}: ${error.message}`); return data; };
async function step(name, needs, fn) {
  const missing = needs.filter(n => steps[n] !== "pass");
  if (missing.length) { steps[name] = `not reached (needs ${missing.join(",")})`; return; }
  try { await fn(); steps[name] = "pass"; }
  catch (error) { steps[name] = `fail: ${error.message.split("\n")[0].slice(0, 400)}`; }
}
async function shot(page, name) {
  const path = join(shots, name);
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}

const createdUsers = [];
let browser = null, cleanup = { ok: false }, mode = "unknown";
try {
  const created = check(await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { first_name: "Next Steps QA", last_name: run, sync_qa_run: run },
  }));
  const userId = created.user.id;
  createdUsers.push(userId);

  // Not a HEAD request: its empty 404 body carries no error code
  const probe = await admin.from("application_activities").select("id").eq("user_id", userId).limit(1);
  mode = probe.error && MISSING.includes(probe.error.code) ? "pre-migration" : probe.error ? `probe-error:${probe.error.code}` : "full";
  if (mode.startsWith("probe-error")) throw new Error(`Could not tell whether migration 020 is applied (${probe.error.code})`);

  const seed = [
    { key: "applied", status: "Applied", applied_date: addDays(today, -20) },
    { key: "offered", status: "Offered", applied_date: addDays(today, -40) },
    { key: "interviewed", status: "Interviewed", applied_date: addDays(today, -25) },
  ];
  for (const row of seed) {
    const app = check(await admin.from("applications").insert({
      user_id: userId, company: companies[row.key], role: "QA Engineer", status: row.status, applied_date: row.applied_date,
    }).select("id").single());
    ctx[row.key] = app.id;
  }

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(error.message));
  const today_card = () => page.locator("div.rounded-lg").filter({ has: page.getByRole("heading", { name: "Today", exact: true }) }).first();

  await step("1-login", [], async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  });

  await step("2-dashboard-today", ["1-login"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const card = today_card();
    await card.waitFor();
    await card.getByText("Suggested next steps").waitFor();
    const text = (await card.innerText()).replace(/\s+/g, " ");
    observed.todayCard = text.slice(0, 700);
    const errs = [];
    if (!text.includes(`Record the decision deadline for your offer from ${companies.offered}.`)) errs.push("offer suggestion missing");
    if (!text.includes(`Add your next round or a thank-you follow-up for ${companies.interviewed}.`)) errs.push("interview suggestion missing");
    // The reason names the applied date; the server counts days in its own zone, so allow one day either side
    if (!new RegExp(`No reply from ${companies.applied} since you applied on [A-Z][a-z]{2} \\d{1,2}, \\d{4}\\.`).test(text)) errs.push("follow-up suggestion missing");
    if (mode === "pre-migration" && !text.includes("Dated next steps need migration 020.")) errs.push("setup line missing");
    // Today sits above the stat cards
    const order = await page.evaluate(() => {
      const all = [...document.querySelectorAll("h3")].map(h => h.textContent.trim());
      return all.indexOf("Today");
    });
    if (order !== 0) errs.push(`Today is not the first card (index ${order})`);
    await shot(page, "1-dashboard.png");
    assert.deepEqual(errs, [], errs.join("; "));
  });

  if (mode === "pre-migration") {
    await step("3-application-page", ["1-login"], async () => {
      await page.goto(`${base}/applications/${ctx.applied}`, { waitUntil: "networkidle" });
      await page.getByText("Next steps need migration 020", { exact: true }).waitFor();
      observed.nextStepsCard = await page.locator("#next-steps").count();
      assert.equal(observed.nextStepsCard, 0, "no Next steps card before the migration");
      await page.getByText("Kept here in case the posting is taken down.").waitFor();
      await shot(page, "2-application-pre-migration.png");
    });

    await step("4-application-still-saves", ["3-application-page"], async () => {
      const note = `QA note ${run}`;
      await page.getByLabel("Notes", { exact: true }).fill(note);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("Application saved").first().waitFor();
      const row = check(await admin.from("applications").select("comments").eq("user_id", userId).eq("id", ctx.applied).single());
      assert.equal(row.comments, note);
    });
  } else {
    const tomorrow = addDays(today, 1);
    const later = addDays(today, 3);
    const mine = () => admin.from("application_activities").select("*").eq("user_id", userId).order("created_at");
    async function addStep(kind, title, date, time) {
      const card = page.locator("#next-steps");
      await card.getByRole("button", { name: "Add", exact: true }).click();
      const form = card.locator("form");
      await form.getByRole("combobox", { name: "Kind" }).click();
      await page.getByRole("option", { name: kind, exact: true }).click();
      await form.getByLabel("Title", { exact: true }).fill(title);
      await form.getByLabel("Date", { exact: true }).fill(date);
      if (time) await form.getByLabel("Time (optional)", { exact: true }).fill(time);
      await form.getByRole("button", { name: "Add step" }).click();
      await form.waitFor({ state: "detached" });
      await card.getByText(title, { exact: true }).waitFor();
    }

    await step("3-add-steps", ["1-login"], async () => {
      await page.goto(`${base}/applications/${ctx.interviewed}`, { waitUntil: "networkidle" });
      await addStep("Assessment", `Take-home ${run}`, tomorrow);
      await addStep("Interview", `Onsite ${run}`, later, "14:30");
      const rows = check(await mine());
      observed.rows = rows.map(r => ({ kind: r.kind, due_on: r.due_on, starts_at: Boolean(r.starts_at), time_zone: r.time_zone, status: r.status }));
      assert.equal(rows.length, 2);
      assert.equal(rows[0].due_on, tomorrow);
      assert.equal(rows[1].due_on, later);
      assert.ok(rows[1].starts_at && rows[1].time_zone, "interview keeps its time and zone");
      ctx.assessment = rows[0].id; ctx.interview = rows[1].id;
      await shot(page, "2-application-steps.png");
    });

    await step("4-today-lists-both", ["3-add-steps"], async () => {
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      const card = today_card();
      await card.getByText(`Take-home ${run}`, { exact: true }).waitFor();
      await card.getByText(`Onsite ${run}`, { exact: true }).waitFor();
      const text = await card.innerText();
      // The open interview step suppresses the interview suggestion
      assert.ok(!text.includes(`for ${companies.interviewed}.`), "interview suggestion suppressed");
      await shot(page, "3-dashboard-today.png");
    });

    await step("5-done-from-today", ["4-today-lists-both"], async () => {
      await today_card().locator(`li[data-activity-id="${ctx.assessment}"]`).getByRole("button", { name: "Done" }).click();
      await page.getByText("Marked done").first().waitFor();
      const row = check(await admin.from("application_activities").select("status,completed_at").eq("user_id", userId).eq("id", ctx.assessment).single());
      assert.equal(row.status, "done");
      assert.ok(row.completed_at);
    });

    await step("6-reschedule", ["3-add-steps"], async () => {
      const moved = addDays(today, 5);
      await page.goto(`${base}/applications/${ctx.interviewed}`, { waitUntil: "networkidle" });
      const item = page.locator(`#next-steps li[data-activity-id="${ctx.interview}"]`);
      await item.getByRole("button", { name: "Edit" }).click();
      const form = page.locator("#next-steps form");
      await form.getByLabel("Date", { exact: true }).fill(moved);
      await form.getByRole("button", { name: "Save step" }).click();
      await form.waitFor({ state: "detached" });
      const row = check(await admin.from("application_activities").select("due_on").eq("user_id", userId).eq("id", ctx.interview).single());
      assert.equal(row.due_on, moved);
    });

    await step("7-delete", ["6-reschedule"], async () => {
      const item = page.locator(`#next-steps li[data-activity-id="${ctx.interview}"]`);
      await item.getByRole("button", { name: "Delete" }).click();
      await item.getByText("Delete this step?").waitFor();
      await item.getByRole("button", { name: "Delete" }).click();
      await item.waitFor({ state: "detached" });
      const rows = check(await admin.from("application_activities").select("id").eq("user_id", userId).eq("id", ctx.interview));
      assert.equal(rows.length, 0);
    });

    await step("8-foreign-application-refused", ["1-login"], async () => {
      const otherUser = check(await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { sync_qa_run: run } }));
      createdUsers.push(otherUser.user.id);
      const theirs = check(await admin.from("applications").insert({ user_id: otherUser.user.id, company: `Other QA ${run}`, status: "Applied" }).select("id").single());
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      check(await client.auth.signInWithPassword({ email, password }));
      const attempt = await client.from("application_activities").insert({ user_id: userId, application_id: theirs.id, kind: "task", title: "Not mine" });
      observed.foreignInsert = attempt.error?.code || "accepted";
      assert.ok(attempt.error, "inserting against another user's application must fail");
      await client.auth.signOut();
      const leaked = check(await admin.from("application_activities").select("id").eq("application_id", theirs.id));
      assert.equal(leaked.length, 0);
    });
  }

  steps["9-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  const left = {};
  try {
    for (const userId of createdUsers) {
      for (const table of ["application_activities", "applications"]) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !MISSING.includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      const { count } = await admin.from("applications").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (count) left[userId] = { applications: count };
      const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profile) left[userId] = { ...left[userId], profiles: 1 };
    }
    cleanup = Object.keys(left).length ? { ok: false, left } : { ok: true, users: createdUsers.length };
  } catch (error) {
    cleanup = { ok: false, error: error.message.slice(0, 200), users: createdUsers };
  }
  console.log(JSON.stringify({ run, mode, steps, observed, pageErrors, screenshots, cleanup }));
}
