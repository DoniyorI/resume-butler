// Signed-in browser check of: language and location on the fit card, a
// response rate that leaves out rows that began with a recruiter reaching out,
// no median from fewer than five replies, and the review of rows that look
// like job alerts. Creates one disposable @example.test user per run and
// deletes everything it created in `finally`. Never prints the password, keys
// or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-fit-stats-alerts.mjs [screenshotDir]
// Add QA_APP_ORIGIN=http://localhost:3001 to check a production build.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
// 3000 is the dev server; 3001 is a production build (`next start -p 3001`),
// which is the one that catches what the minifier changes
const base = process.env.QA_APP_ORIGIN || "http://localhost:3000";
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("This check is restricted to the named QA project.");
if (!["http://localhost:3000", "http://localhost:3001"].includes(base)) throw new Error("This check only runs against http://localhost:3000 or http://localhost:3001.");

const shots = process.argv[2] || "/tmp/resume-butler-fit-stats-alerts-qa";
await mkdir(shots, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");

const run = randomBytes(5).toString("hex");
const email = `sync-qa-${run}-alerts@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const AI_PATHS = [/^\/api\/generate-/, /^\/api\/tailor-resume/, /^\/api\/suggest-bullets/, /^\/api\/rewrite-/];
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const posting = `Requirements:
- Python
- SQL
- Docker
- Must be fluent in English and Korean
You’re located or willing to work from Seoul, South Korea.

Our Process
Two technical sessions with a system design exercise.`;

const steps = {}, observed = {}, pageErrors = [], aiCalls = [], screenshots = [];
const check = ({ data, error }) => { if (error) throw new Error(`${error.code || "DB"}: ${error.message}`); return data; };
async function step(name, needs, fn) {
  const missing = needs.filter(n => steps[n] !== "pass");
  if (missing.length) { steps[name] = `not reached (needs ${missing.join(",")})`; return; }
  try { await fn(); steps[name] = "pass"; }
  catch (error) { steps[name] = `fail: ${error.message.split("\n")[0].slice(0, 400)}`; }
}

let userId = null, browser = null, cleanup = { ok: false };
try {
  const created = check(await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { first_name: "Alerts QA", last_name: run, sync_qa_run: run },
  }));
  userId = created.user.id;
  const insert = async (fields) =>
    check(await admin.from("applications").insert({ user_id: userId, applied_date: daysAgo(30), role: "Software Engineer", ...fields }).select("id").single()).id;

  // Three alert rows, one real recruiter message, five applications (one replied to)
  const ids = {};
  ids.alert = await insert({ company: `Alert Co ${run}`, status: "Reached Out", source: "email", comments: "Auto-detected from email: Job alert notification for a Software Engineer role that matches the recipient's profile." });
  ids.board = await insert({ company: "LinkedIn", role: "Unknown", status: "Reached Out", source: "email", comments: "From email: The email encourages the recipient to share their status." });
  ids.keep = await insert({ company: `Keep Co ${run}`, status: "Reached Out", source: "email", comments: "Auto-detected from email: A reminder that a saved job is still available." });
  ids.recruiter = await insert({ company: `Recruiter Co ${run}`, status: "Reached Out", source: "email", comments: "From email: A recruiter personally reached out about an engineering opening and asked to connect." });
  for (let i = 0; i < 5; i++) {
    ids[`applied${i}`] = await insert({ company: `Applied Co ${i} ${run}`, status: "Applied", source: "manual", ...(i === 0 ? { job_description: posting } : {}) });
  }
  check(await admin.from("applications").update({ status: "Reached Out" }).eq("id", ids.applied1).eq("user_id", userId).select("id"));
  check(await admin.from("cv_skills").insert(["Python", "SQL", "Docker"].map((name) => ({ user_id: userId, category: "Tools", name }))).select("id"));

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (AI_PATHS.some(re => re.test(path))) aiCalls.push(path); });
  const shot = async (name) => { const path = join(shots, name); await page.screenshot({ path, fullPage: true }); screenshots.push(path); };
  const bodyText = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

  await step("1-login", [], async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  });

  await step("2-dashboard-rate-and-median", ["1-login"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const text = await bodyText();
    observed.dashboard = (text.match(/Response rate.{0,90}/) || [""])[0];
    assert.ok(text.includes("1 of 5 applied 14+ days ago heard back"), `rate caption: ${observed.dashboard}`);
    assert.ok(text.includes("20%"), "rate is 1 of 5");
    assert.ok(text.includes("Too few replies for a typical wait"), "median hidden under five replies");
    assert.ok(!/Median \d+ days? to first reply/.test(text), "no median shown");
    await shot("1-dashboard.png");
  });

  await step("3-insights-lines", ["1-login"], async () => {
    await page.goto(`${base}/insights`, { waitUntil: "networkidle" });
    assert.ok((await bodyText()).includes("1 reply with a recorded date so far: too few to give a typical time from Applied to first reply."), "insights timing line");
    await page.goto(`${base}/insights?tab=report`, { waitUntil: "networkidle" });
    const text = await bodyText();
    observed.report = (text.match(/Counts from your own records.{0,420}/) || [""])[0];
    assert.ok(text.includes("for the 5 of 9 applications applied 14 or more days ago"), "report counts five applications");
    assert.ok(text.includes("4 more rows began with a recruiter reaching out, not with an application, and are left out."), "report names the outreach rows");
    await shot("2-report.png");
  });

  await step("4-fit-card", ["1-login"], async () => {
    await page.goto(`${base}/applications/${ids.applied0}`, { waitUntil: "networkidle" });
    let text = await bodyText();
    observed.fit = (text.match(/Fit for this job.{0,330}/) || [""])[0];
    assert.ok(text.includes("Low fit"), `band: ${observed.fit}`);
    assert.ok(text.includes("The posting asks for Korean, which your Master CV doesn't mention, so this is rated low."), "reason names the language");
    await page.getByRole("button", { name: /See why/ }).click();
    await page.getByText("Only you can judge").waitFor();
    text = await bodyText();
    assert.ok(text.includes("Asks for Korean: not mentioned in your Master CV."), "language line");
    assert.ok(text.includes("Location: You’re located or willing to work from Seoul, South Korea.") || text.includes("Location: “You’re located or willing to work from Seoul, South Korea.”"), "location check quoted");
    assert.ok(/Language: .?Must be fluent in English and Korean/.test(text), "language check quoted");
    // The description itself says "system design" in lower case; the card would label a requirement "System Design"
    assert.ok(!text.includes("System Design"), "interview process not read as a requirement");
    await shot("3-fit-card.png");
  });

  await step("5-alert-review", ["1-login"], async () => {
    await page.goto(`${base}/applications`, { waitUntil: "networkidle" });
    await page.getByText("3 rows look like job alerts, not applications").waitFor();
    await shot("4-alert-banner.png");
    await page.getByRole("button", { name: "Review", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Rows that look like job alerts").waitFor();
    const text = (await dialog.innerText()).replace(/\s+/g, " ");
    observed.dialog = text.slice(0, 700);
    for (const name of [`Alert Co ${run}`, "LinkedIn", `Keep Co ${run}`]) assert.ok(text.includes(name), `${name} listed`);
    assert.ok(!text.includes(`Recruiter Co ${run}`), "a real recruiter message is not listed");
    assert.ok(text.includes("Sent by a job site, not by an employer"), "job site reason shown");
    await shot("5-alert-dialog.png");
    await dialog.getByLabel(new RegExp(`Keep Co ${run}`)).click();
    await dialog.getByRole("button", { name: "Remove 2 rows" }).click();
    await page.getByText("Removed 2 rows").waitFor();
    await page.getByText("1 row looks like a job alert, not an application").waitFor();
    const left = check(await admin.from("applications").select("id").eq("user_id", userId)).map((r) => r.id);
    assert.ok(!left.includes(ids.alert) && !left.includes(ids.board), "the two chosen rows are deleted");
    assert.ok(left.includes(ids.keep) && left.includes(ids.recruiter), "the unticked row and the recruiter row remain");
    assert.equal(left.length, 7);
  });

  await step("6-keep-hides-the-notice", ["5-alert-review"], async () => {
    await page.getByRole("button", { name: "Keep these rows and hide this notice" }).click();
    await page.getByText(/look(?:s)? like (?:a )?job alert/).waitFor({ state: "detached" });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByText(/look(?:s)? like (?:a )?job alert/).count(), 0, "stays hidden after a reload");
    assert.equal(check(await admin.from("applications").select("id").eq("user_id", userId)).length, 7, "keeping deletes nothing");
  });

  steps["7-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
  steps["no-ai-calls"] = aiCalls.length ? `fail: ${aiCalls.join(",")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) {
    try {
      for (const table of ["application_suggestions", "applications", "cv_skills"]) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !["42P01", "PGRST205"].includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      const left = {};
      for (const table of ["applications", "cv_skills"]) {
        const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (count) left[table] = count;
      }
      const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profile) left.profiles = 1;
      cleanup = Object.keys(left).length ? { ok: false, left, userId } : { ok: true };
    } catch (error) {
      cleanup = { ok: false, error: error.message.slice(0, 200), userId };
    }
  }
  console.log(JSON.stringify({ run, steps, observed, pageErrors, aiCalls, screenshots, cleanup }, null, 1));
}
