// Signed-in browser check of fit on saved jobs: seed a small fictional Master
// CV, save three jobs through the UI, read the fit chips and "See why", sort by
// best fit, and check the nav. No AI runs.
// Creates one disposable @example.test user per run and deletes everything it
// created in `finally`. Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-saved-job-fit.mjs [screenshotDir]
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

const shots = process.argv[2] || "/tmp/resume-butler-saved-job-fit-qa";
await mkdir(shots, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");

const run = randomBytes(5).toString("hex");
const email = `sync-qa-${run}-savedfit@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const AI_PATHS = [/^\/api\/generate-/, /^\/api\/tailor-resume/, /^\/api\/suggest-bullets/, /^\/api\/rewrite-/];

// A small fictional Master CV
const BULLETS = [
  ["Built invoice reconciliation services in Python that read from PostgreSQL for the billing team", "Packaged each service with Docker so releases ran the same everywhere"],
  ["Maintained Python data jobs and tuned slow PostgreSQL queries for nightly reports", "Moved the reporting stack onto Docker images with health checks"],
];
const JOBS = {
  fit: {
    company: `Fernwood QA ${run}`,
    link: `https://example.test/jobs/${run}-fit`,
    description: `Backend Engineer at Fernwood

You will build the services behind our billing platform.

Requirements:
- 3+ years of professional software experience
- Python
- PostgreSQL
- Docker
- Kubernetes

Nice to have:
- GraphQL
- Terraform

We are unable to offer visa sponsorship for this role.`,
  },
  far: {
    company: `Quarry QA ${run}`,
    link: `https://example.test/jobs/${run}-far`,
    description: `Mobile Platform Engineer

Requirements:
- 8+ years of experience building native apps
- Rust
- Swift
- Kotlin

You will own our mobile runtime.`,
  },
  blank: { company: `Juniper QA ${run}`, link: `https://example.test/jobs/${run}-blank`, description: "" },
};
const FOOTER = "Fit compares this posting with your Master CV. It is not a prediction of an interview.";
const NO_DESCRIPTION = "Add the job description to see how this fits.";

const steps = {}, observed = {}, pageErrors = [], aiCalls = [], screenshots = [];
const check = ({ data, error }) => { if (error) throw new Error(`${error.code || "DB"}: ${error.message}`); return data; };
async function step(name, needs, fn) {
  const missing = needs.filter(n => steps[n] !== "pass");
  if (missing.length) { steps[name] = `not reached (needs ${missing.join(",")})`; return; }
  try { await fn(); steps[name] = "pass"; }
  catch (error) { steps[name] = `fail: ${error.message.split("\n")[0].slice(0, 400)}`; }
}
const strip = quote => quote.replace(/^…\s*/, "").replace(/\s*…$/, "");

let userId = null, browser = null, cleanup = { ok: false };
try {
  const created = check(await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { first_name: "Saved Fit QA", last_name: run, sync_qa_run: run },
  }));
  userId = created.user.id;
  const mine = table => admin.from(table).select("*").eq("user_id", userId);

  await step("0-seed-cv", [], async () => {
    const experience = check(await admin.from("cv_experience").insert([
      { user_id: userId, company: "Harbor Ledger", position: "Software Engineer", start_date: "2023-07-01", currently_working: true, sort_order: 0 },
      { user_id: userId, company: "Tallow Freight", position: "Junior Developer", start_date: "2021-01-01", end_date: "2023-06-30", sort_order: 1 },
    ]).select("id,company"));
    assert.equal(experience.length, 2);
    const ids = ["Harbor Ledger", "Tallow Freight"].map(name => experience.find(e => e.company === name).id);
    check(await admin.from("cv_experience_bullets").insert(ids.flatMap((id, i) => BULLETS[i].map((content, sort_order) => ({ experience_id: id, content, sort_order })))));
    check(await admin.from("cv_skills").insert(["Python", "PostgreSQL", "Docker", "Kubernetes"].map((name, sort_order) => ({ user_id: userId, name, category: "Tools", sort_order }))));
    check(await admin.from("cv_education").insert({ user_id: userId, school: "Westbrook State University", degree_type: "Bachelor", major: "Education", start_date: "2016-09-01", end_date: "2020-06-01", sort_order: 0 }));
  });

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (AI_PATHS.some(re => re.test(path))) aiCalls.push(path); });

  await step("1-login", [], async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  });

  const card = name => page.locator("article").filter({ hasText: name });
  async function saveJobViaUi({ company, link, description }) {
    await page.getByRole("button", { name: "Save a job" }).click();
    const form = page.locator("form").filter({ hasText: "Save an opening" });
    await form.getByLabel("Company", { exact: true }).fill(company);
    await form.getByLabel("Job title", { exact: true }).fill("Engineer");
    await form.getByLabel("Posting link", { exact: true }).fill(link);
    if (description) await form.getByLabel("Job description", { exact: true }).fill(description);
    await form.getByRole("button", { name: "Save job" }).click();
    await card(company).waitFor();
  }
  const order = async () => {
    const texts = await page.locator("article").allInnerTexts();
    return Object.fromEntries(Object.entries(JOBS).map(([key, job]) => [key, texts.findIndex(t => t.includes(job.company))]));
  };

  await step("2-save-three-jobs", ["0-seed-cv", "1-login"], async () => {
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    for (const job of [JOBS.fit, JOBS.far, JOBS.blank]) {
      await saveJobViaUi(job);
      await page.waitForLoadState("networkidle");
    }
    assert.equal(check(await mine("job_opportunities")).length, 3, "three saved job rows");
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
  });

  await step("3-chips", ["2-save-three-jobs"], async () => {
    const chips = {};
    for (const [key, job] of Object.entries(JOBS)) {
      const text = await card(job.company).innerText();
      chips[key] = ["Strong fit", "Good fit", "Stretch", "Low fit", "Not enough to tell"].find(label => text.includes(label)) || null;
      if (key === "far") observed.farReason = (await card(job.company).locator("span.rounded-full + p").first().textContent().catch(() => null));
      if (key === "fit") observed.fitReason = (await card(job.company).locator("span.rounded-full + p").first().textContent().catch(() => null));
    }
    observed.chips = chips;
    observed.blankHint = (await card(JOBS.blank.company).innerText()).includes(NO_DESCRIPTION);
    await page.screenshot({ path: join(shots, "1-saved-jobs-list.png"), fullPage: true }); screenshots.push(join(shots, "1-saved-jobs-list.png"));
    const errs = [];
    if (!["Strong fit", "Good fit"].includes(chips.fit)) errs.push(`matching job shows ${chips.fit}`);
    if (!["Low fit", "Stretch"].includes(chips.far)) errs.push(`distant job shows ${chips.far}`);
    if (chips.blank) errs.push(`job without description shows ${chips.blank}`);
    if (!observed.blankHint) errs.push("add-description hint missing");
    assert.deepEqual(errs, []);
  });

  await step("4-see-why", ["2-save-three-jobs"], async () => {
    const fitCard = card(JOBS.fit.company);
    const toggle = fitCard.getByRole("button", { name: "See why" });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    const panel = fitCard.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
    const text = await panel.innerText();
    observed.panel = text.replace(/\s+/g, " ").slice(0, 900);
    const quotes = (await panel.locator("p", { hasText: "“" }).allTextContents()).map(t => strip(t.slice(t.indexOf("“") + 1, t.lastIndexOf("”"))));
    observed.evidenceQuotes = quotes;
    const errs = [];
    if (!quotes.some(q => q && BULLETS.flat().some(b => b.includes(q)))) errs.push("no evidence quote is a substring of a seeded bullet");
    const kube = panel.locator("li").filter({ hasText: /kubernetes/i }).first();
    if (!(await kube.count()) || !(await kube.innerText()).includes("Listed, no example yet")) errs.push("Kubernetes is not listed without an example");
    const judge = panel.locator("section").filter({ hasText: "Only you can judge" });
    if (!(await judge.count()) || !/visa sponsorship/i.test(await judge.innerText())) errs.push("sponsorship quote missing under Only you can judge");
    if (!text.includes(FOOTER)) errs.push("footer sentence missing");
    if (/\d+%|\d+\.\d+ ?\/|score/i.test(text.replace(/covers about \d+(\.\d+)?/, ""))) errs.push("a percentage or score appears");
    await page.screenshot({ path: join(shots, "2-see-why-1440.png"), fullPage: true }); screenshots.push(join(shots, "2-see-why-1440.png"));
    assert.deepEqual(errs, []);
  });

  await step("5-sort", ["2-save-three-jobs"], async () => {
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    const newest = await order();
    await page.getByRole("navigation", { name: "Sort saved jobs" }).getByRole("link", { name: "Best fit" }).click();
    await page.waitForURL(/sort=fit/);
    await page.waitForLoadState("networkidle");
    const ranked = await order();
    observed.order = { newest, ranked };
    const errs = [];
    if (!(newest.blank < newest.far && newest.far < newest.fit)) errs.push("default order is not newest first");
    if (!(ranked.fit < ranked.far)) errs.push("best fit does not put the matching job before the distant one");
    if (ranked.blank !== 2) errs.push("job without a description is not last");
    if ((await page.getByRole("navigation", { name: "Sort saved jobs" }).getByRole("link", { name: "Best fit" }).getAttribute("aria-current")) !== "true") errs.push("Best fit not marked current");
    assert.deepEqual(errs, []);
  });

  await step("6-nav", ["1-login"], async () => {
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Saved jobs", exact: true });
    await link.waitFor();
    assert.equal(await link.getAttribute("aria-current"), "page");
  });

  await step("7-mobile", ["2-save-three-jobs"], async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    const fitCard = card(JOBS.fit.company);
    await fitCard.getByRole("button", { name: "See why" }).click();
    await fitCard.getByText(FOOTER).waitFor();
    observed.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await fitCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(shots, "3-see-why-375.png"), fullPage: true }); screenshots.push(join(shots, "3-see-why-375.png"));
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileLink = page.locator("#mobile-nav").getByRole("link", { name: "Saved jobs", exact: true });
    assert.equal(await mobileLink.getAttribute("aria-current"), "page");
    assert.ok(observed.mobileOverflow <= 0, `page scrolls sideways by ${observed.mobileOverflow}px at 375px`);
  });

  steps["8-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
  steps["no-ai-calls"] = aiCalls.length ? `fail: ${aiCalls.join(",")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) {
    try {
      const { data: experience, error: expError } = await admin.from("cv_experience").select("id").eq("user_id", userId);
      if (expError) throw new Error(`cv_experience: ${expError.message}`);
      const experienceIds = (experience || []).map(e => e.id);
      if (experienceIds.length) {
        const { error } = await admin.from("cv_experience_bullets").delete().in("experience_id", experienceIds);
        if (error) throw new Error(`cv_experience_bullets: ${error.message}`);
      }
      const tables = ["application_suggestions", "applications", "job_opportunities", "cover_letters", "resumes", "cv_experience", "cv_skills", "cv_education", "cv_projects", "cv_certifications"];
      for (const table of tables) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !["42P01", "PGRST205"].includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      const left = {};
      for (const table of ["applications", "job_opportunities", "resumes", "cv_experience", "cv_skills", "cv_education"]) {
        const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (count) left[table] = count;
      }
      if (experienceIds.length) {
        const { count } = await admin.from("cv_experience_bullets").select("id", { count: "exact", head: true }).in("experience_id", experienceIds);
        if (count) left.cv_experience_bullets = count;
      }
      const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profile) left.profiles = 1;
      cleanup = Object.keys(left).length ? { ok: false, left, userId } : { ok: true };
    } catch (error) {
      cleanup = { ok: false, error: error.message.slice(0, 200), userId };
    }
  }
  // eslint-disable-next-line no-console -- the one JSON line is the report
  console.log(JSON.stringify({ run, steps, observed, pageErrors, aiCalls, screenshots, cleanup }));
}
