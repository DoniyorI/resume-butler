// Signed-in browser check of the Watchlist page. Detects whether migration 021 is applied:
//   - before it: /watchlist shows only "Watchlist needs migration 021.", Saved jobs links to
//     Watchlist, the dashboard still renders its Today card, no page errors;
//   - after it: seeds a small fictional Master CV, watches ashby:ashby with the keyword
//     "engineer" (ONE live request to Ashby's public API), checks the list, order, Save job
//     (one saved job, no application), Dismiss, keyword edit and "Check now" (refused as too
//     soon), a second user's empty watchlist, 375px layout, Remove (postings go, saved job
//     stays), and that no AI endpoint is called.
// Creates disposable @example.test users and deletes everything it created in `finally`.
// Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-watchlist.mjs [screenshotDir]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
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
const email = `sync-qa-${run}-watchlist@example.test`;
const otherEmail = `sync-qa-${run}-watchlist-other@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const MISSING = ["42P01", "PGRST205", "PGRST200", "PGRST204"];
const AI_PATHS = [/^\/api\/generate-/, /^\/api\/tailor-resume/, /^\/api\/suggest-bullets/, /^\/api\/rewrite-/];
const RANK = { "Strong fit": 0, "Good fit": 1, "Stretch": 2, "Low fit": 3, "Not enough to tell": 4, "Fit unavailable": 5 };
const BULLETS = [
  ["Built and shipped REST APIs in Python used by 40 internal teams", "Designed PostgreSQL schemas and tuned slow queries", "Containerised services with Docker and deployed them to Kubernetes"],
  ["Maintained a TypeScript and React dashboard for warehouse staff", "Wrote automated tests that cut regressions"],
];

const steps = {}, observed = {}, pageErrors = [], aiCalls = [], screenshots = [];
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
    email, password, email_confirm: true, user_metadata: { first_name: "Watchlist QA", last_name: run, sync_qa_run: run },
  }));
  const userId = created.user.id;
  createdUsers.push(userId);

  // Not a HEAD request: its empty 404 body carries no error code
  const probe = await admin.from("watched_companies").select("id").eq("user_id", userId).limit(1);
  mode = probe.error && MISSING.includes(probe.error.code) ? "pre-migration" : probe.error ? `probe-error:${probe.error.code}` : "full";
  if (mode.startsWith("probe-error")) throw new Error(`Could not tell whether migration 021 is applied (${probe.error.code})`);

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (AI_PATHS.some(re => re.test(path))) aiCalls.push(path); });
  const login = async (p, who) => {
    await p.goto(`${base}/login`, { waitUntil: "networkidle" });
    await p.getByLabel("Email", { exact: true }).fill(who);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Login", exact: true }).click();
    await p.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  };

  if (mode === "full") {
    const experience = check(await admin.from("cv_experience").insert([
      { user_id: userId, company: "Harbor Ledger", position: "Software Engineer", start_date: "2023-07-01", currently_working: true, sort_order: 0 },
      { user_id: userId, company: "Tallow Freight", position: "Junior Developer", start_date: "2021-01-01", end_date: "2023-06-30", sort_order: 1 },
    ]).select("id,company"));
    const ids = ["Harbor Ledger", "Tallow Freight"].map(name => experience.find(e => e.company === name).id);
    check(await admin.from("cv_experience_bullets").insert(ids.flatMap((id, i) => BULLETS[i].map((content, sort_order) => ({ experience_id: id, content, sort_order })))));
    check(await admin.from("cv_skills").insert(["Python", "PostgreSQL", "Docker", "Kubernetes", "React"].map((name, sort_order) => ({ user_id: userId, name, category: "Tools", sort_order }))));
    check(await admin.from("cv_education").insert({ user_id: userId, school: "Westbrook State University", degree_type: "Bachelor", major: "Computer Science", start_date: "2016-09-01", end_date: "2020-06-01", sort_order: 0 }));
  }

  await step("1-login", [], () => login(page, email));

  if (mode === "pre-migration") {
    await step("2-notice", ["1-login"], async () => {
      await page.goto(`${base}/watchlist`, { waitUntil: "networkidle" });
      await page.getByText("Watchlist needs migration 021.", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Job board link").count(), 0, "nothing else from the feature");
      await shot(page, "watchlist-pre-migration.png");
    });
    await step("3-saved-jobs-link", ["1-login"], async () => {
      await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
      await page.getByRole("link", { name: "Watchlist", exact: true }).waitFor();
      assert.equal(await page.getByRole("link", { name: "Watchlist", exact: true }).getAttribute("href"), "/watchlist");
      await shot(page, "saved-jobs-watchlist-link.png");
    });
    await step("4-dashboard-today", ["1-login"], async () => {
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
    });
  } else {
    const company = () => page.locator("li").filter({ hasText: "open roles kept" }).first();
    const articles = page.locator("article");
    const mine = table => admin.from(table).select("*").eq("user_id", userId);

    await step("2-add-ashby", ["1-login"], async () => {
      await page.goto(`${base}/watchlist`, { waitUntil: "networkidle" });
      await page.getByLabel("Job board link").fill("ashby:ashby");
      await page.getByLabel("Job titles to keep", { exact: true }).fill("engineer");
      await page.getByRole("button", { name: "Watch company" }).click();
      await company().waitFor({ timeout: 60000 });
      const text = (await company().innerText()).replace(/\s+/g, " ");
      observed.company = text.slice(0, 200);
      const kept = Number(/(\d+) of (\d+|\?) open roles kept/.exec(text)?.[1]);
      assert.ok(kept > 0, `kept count above zero (${text})`);
      observed.kept = kept;
    });

    await step("3-postings-and-order", ["2-add-ashby"], async () => {
      await articles.first().waitFor();
      const titles = await articles.locator("h3").allInnerTexts();
      observed.postings = titles.length;
      assert.ok(titles.every(t => /engineer/i.test(t)), `every title contains "engineer": ${titles.filter(t => !/engineer/i.test(t)).join(" | ")}`);
      const chips = await articles.evaluateAll(list => list.map(a => {
        const text = a.innerText;
        for (const label of ["Strong fit", "Good fit", "Stretch", "Low fit", "Not enough to tell", "Fit unavailable"]) if (text.includes(label)) return label;
        return "none";
      }));
      observed.bands = chips.reduce((acc, c) => ({ ...acc, [c]: (acc[c] || 0) + 1 }), {});
      assert.ok(chips.every(c => c in RANK), "every card has a band chip or Fit unavailable");
      const ranks = chips.map(c => RANK[c]);
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "best fit first");
      await shot(page, "watchlist-full.png");
    });

    await step("4-save-job", ["3-postings-and-order"], async () => {
      const before = await articles.count();
      const first = articles.first();
      const title = await first.locator("h3").innerText();
      await first.getByRole("button", { name: "Save job" }).click();
      await page.waitForFunction(n => document.querySelectorAll("article").length === n, before - 1);
      const jobs = check(await mine("job_opportunities"));
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].payload.role, title);
      assert.ok((jobs[0].payload.job_description || "").length > 200, "description saved");
      assert.match(jobs[0].payload.portal_link, /^https:\/\/jobs\.ashbyhq\.com\//);
      assert.equal(check(await mine("applications")).length, 0, "no application");
      observed.savedRole = title;
    });

    await step("5-dismiss", ["4-save-job"], async () => {
      const before = await articles.count();
      await articles.first().getByRole("button", { name: "Dismiss" }).click();
      await page.waitForFunction(n => document.querySelectorAll("article").length === n, before - 1);
      const dismissed = check(await mine("watched_postings")).filter(p => p.dismissed_at);
      assert.equal(dismissed.length, 1);
    });

    await step("6-edit-keywords-and-check", ["2-add-ashby"], async () => {
      await company().getByRole("button", { name: "Edit titles" }).click();
      await company().getByRole("textbox").fill("designer");
      await company().getByRole("button", { name: "Save", exact: true }).click();
      await company().getByText("designer", { exact: true }).waitFor();
      await company().getByRole("button", { name: "Check now" }).click();
      const refused = page.getByText("Checked a moment ago. Try again in a minute.");
      const outcome = await Promise.race([
        refused.waitFor().then(() => "refused"),
        page.getByText(/^Checked .*: \d+ new, \d+ closed\.$/).waitFor().then(() => "checked"),
      ]);
      observed.checkNow = outcome;
      if (outcome === "checked") {
        const titles = await articles.locator("h3").allInnerTexts();
        assert.ok(titles.every(t => /designer/i.test(t)), "only designer roles remain");
      }
    });

    await step("7-second-user-empty", ["1-login"], async () => {
      const other = check(await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { sync_qa_run: run } }));
      createdUsers.push(other.user.id);
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const second = await context.newPage();
      second.setDefaultTimeout(30000);
      second.on("pageerror", error => pageErrors.push(error.message));
      try {
        await login(second, otherEmail);
        await second.goto(`${base}/watchlist`, { waitUntil: "networkidle" });
        await second.getByText("You are not watching any company yet.").waitFor();
        assert.equal(await second.locator("article").count(), 0);
        assert.equal(await second.getByText("open roles kept").count(), 0);
      } finally { await context.close(); }
    });

    await step("8-mobile-375", ["2-add-ashby"], async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${base}/watchlist`, { waitUntil: "networkidle" });
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      observed.mobile = widths;
      await shot(page, "watchlist-375.png");
      await page.setViewportSize({ width: 1440, height: 1100 });
      assert.ok(widths.scroll <= widths.inner, `horizontal scroll at 375px (${widths.scroll} > ${widths.inner})`);
    });

    await step("9-remove-company", ["4-save-job"], async () => {
      await page.goto(`${base}/watchlist`, { waitUntil: "networkidle" });
      await company().getByRole("button", { name: "Remove", exact: true }).click();
      await company().getByText("jobs you saved stay in Saved jobs").waitFor();
      await company().getByRole("button", { name: "Remove", exact: true }).click();
      await page.getByText("You are not watching any company yet.").waitFor();
      assert.equal(check(await mine("watched_postings")).length, 0, "postings deleted with the company");
      assert.equal(check(await mine("watched_companies")).length, 0);
      assert.equal(check(await mine("job_opportunities")).length, 1, "the saved job remains");
    });
  }

  steps["99-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
  steps["99-no-ai-calls"] = aiCalls.length ? `fail: ${aiCalls.join(",")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  const left = {};
  try {
    for (const userId of createdUsers) {
      const { data: experience, error: expError } = await admin.from("cv_experience").select("id").eq("user_id", userId);
      if (expError) throw new Error(`cv_experience: ${expError.message}`);
      const experienceIds = (experience || []).map(row => row.id);
      if (experienceIds.length) {
        const { error } = await admin.from("cv_experience_bullets").delete().in("experience_id", experienceIds);
        if (error) throw new Error(`cv_experience_bullets: ${error.message}`);
      }
      for (const table of ["watched_postings", "watched_companies", "applications", "job_opportunities", "cv_experience", "cv_skills", "cv_education", "cv_projects", "cv_certifications"]) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !MISSING.includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      for (const table of ["watched_companies", "watched_postings", "job_opportunities", "applications", "cv_experience", "cv_skills", "cv_education"]) {
        const { count, error: countError } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (!countError && count) left[table] = (left[table] || 0) + count;
      }
      const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profile) left.profiles = (left.profiles || 0) + 1;
    }
    cleanup = Object.keys(left).length ? { ok: false, left } : { ok: true, users: createdUsers.length };
  } catch (error) {
    cleanup = { ok: false, error: error.message.slice(0, 200), users: createdUsers };
  }
  console.log(JSON.stringify({ run, mode, steps, observed, pageErrors, aiCalls, screenshots, cleanup }));
}
