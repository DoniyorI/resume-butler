// Signed-in browser check of the Tailor tab's Fit card: seed a small fictional
// Master CV, save a job through the UI, add the entries, bullet and skill the
// Master CV backs with one click each, answer "I have this" for a skill it
// lacks, pick the best entries, and add one missing bullet to a second resume
// and undo it. No AI runs.
// Creates one disposable @example.test user per run and deletes everything it
// created in `finally`. Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-tailor-from-fit.mjs [screenshotDir]
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
const email = `sync-qa-${run}-tailorfit@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const AI_PATHS = [/^\/api\/generate-/, /^\/api\/tailor-resume/, /^\/api\/suggest-bullets/, /^\/api\/rewrite-/];

// A small fictional Master CV
const A = { company: "Harbor Ledger", position: "Software Engineer" };
const B = { company: "Tallow Freight", position: "Junior Developer" };
const A_BULLETS = [
  "Built invoice reconciliation services in Python for the billing team",
  "Tuned slow PostgreSQL queries so nightly reports finished before morning",
];
const B_BULLETS = ["Packaged each batch job with Docker so releases ran the same everywhere"];
const JOB = {
  company: `Fernwood QA ${run}`,
  link: `https://example.test/jobs/${run}-tailor`,
  description: `Backend Engineer at Fernwood

You will build the services behind our billing platform.

Requirements:
- Python
- PostgreSQL
- Docker
- Kubernetes
- Terraform`,
};

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
    email, password, email_confirm: true, user_metadata: { first_name: "Tailor Fit QA", last_name: run, sync_qa_run: run },
  }));
  userId = created.user.id;
  const mine = table => admin.from(table).select("*").eq("user_id", userId);

  await step("0-seed-cv", [], async () => {
    const experience = check(await admin.from("cv_experience").insert([
      { user_id: userId, company: A.company, position: A.position, start_date: "2023-07-01", currently_working: true, sort_order: 0 },
      { user_id: userId, company: B.company, position: B.position, start_date: "2021-01-01", end_date: "2023-06-30", sort_order: 1 },
    ]).select("id,company"));
    assert.equal(experience.length, 2);
    const idA = experience.find(e => e.company === A.company).id, idB = experience.find(e => e.company === B.company).id;
    check(await admin.from("cv_experience_bullets").insert([
      ...A_BULLETS.map((content, sort_order) => ({ experience_id: idA, content, sort_order })),
      ...B_BULLETS.map((content, sort_order) => ({ experience_id: idB, content, sort_order })),
    ]));
    check(await admin.from("cv_skills").insert(["Kubernetes", "Git"].map((name, sort_order) => ({ user_id: userId, name, category: "Tools", sort_order }))));
  });

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (AI_PATHS.some(re => re.test(path))) aiCalls.push(path); });
  const shot = async name => { const path = join(shots, name); await page.screenshot({ path }); screenshots.push(path); };

  await step("1-login", [], async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  });

  const card = name => page.locator("article").filter({ hasText: name });
  const panel = () => page.getByRole("tabpanel");
  const fitCard = () => panel().locator('section[aria-label="Fit for this job"]');
  const paperText = async () => (await page.locator(".rb-paper").allTextContents()).join(" ").replace(/\s+/g, " ");
  const addButton = (label, term) => fitCard().getByRole("button", { name: new RegExp(`^${label} for ${term}$`, "i") });
  const gone = async (label, term) => { await addButton(label, term).waitFor({ state: "detached", timeout: 15000 }); };
  const line = () => fitCard().locator("p", { hasText: /requirements your Master CV backs|everything your Master CV backs/ }).first();

  await step("2-save-job", ["0-seed-cv", "1-login"], async () => {
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Save a job" }).click();
    const form = page.locator("form").filter({ hasText: "Save an opening" });
    await form.getByLabel("Company", { exact: true }).fill(JOB.company);
    await form.getByLabel("Job title", { exact: true }).fill("Backend Engineer");
    await form.getByLabel("Posting link", { exact: true }).fill(JOB.link);
    await form.getByLabel("Job description", { exact: true }).fill(JOB.description);
    await form.getByRole("button", { name: "Save job" }).click();
    await card(JOB.company).waitFor();
    const rows = check(await mine("job_opportunities"));
    assert.equal(rows.length, 1, "one saved job row");
    observed.opportunityId = rows[0].id;
  });

  await step("3-studio-fit-card", ["2-save-job"], async () => {
    await card(JOB.company).getByRole("button", { name: "Tailor resume" }).click();
    await page.waitForURL(/\/resumes\/[0-9a-f-]{36}/, { timeout: 45000 });
    await fitCard().waitFor({ timeout: 45000 });
    await line().waitFor({ timeout: 30000 });
    const text = (await line().innerText()).trim();
    observed.emptyLine = text;
    await shot("1-fit-card-empty-resume.png");
    const errs = [];
    if (!/0 of 4/.test(text)) errs.push(`line reads "${text}"`);
    for (const term of ["Python", "PostgreSQL", "Docker"]) if (!(await addButton("Add entry", term).count())) errs.push(`no Add entry row for ${term}`);
    if (!(await addButton("Add to Skills", "Kubernetes").count())) errs.push("no Add to Skills row for kubernetes");
    const missing = fitCard().locator("li").filter({ hasText: /The posting asks for\s+terraform/i });
    if (!(await missing.count())) errs.push("no Not in your Master CV row for terraform");
    else {
      const buttons = await missing.getByRole("button").allInnerTexts();
      if (buttons.length !== 1 || buttons[0].trim() !== "I have this") errs.push(`terraform row buttons: ${JSON.stringify(buttons)}`);
    }
    if (!(await fitCard().getByText("Not in your Master CV", { exact: true }).count())) errs.push("section heading missing");
    assert.deepEqual(errs, []);
  });

  await step("4-add-entry-python", ["3-studio-fit-card"], async () => {
    await addButton("Add entry", "Python").click();
    await gone("Add entry", "Python");
    await gone("Add entry", "PostgreSQL");
    const text = await paperText();
    observed.afterPython = (await line().innerText()).trim();
    const errs = [];
    if (!text.includes(A.company)) errs.push("experience A not on the page");
    for (const bullet of A_BULLETS) if (!text.includes(bullet)) errs.push(`bullet missing: ${bullet.slice(0, 30)}`);
    assert.deepEqual(errs, []);
  });

  await step("5-add-entry-docker", ["4-add-entry-python"], async () => {
    await addButton("Add entry", "Docker").click();
    await gone("Add entry", "Docker");
    const text = await paperText();
    assert.ok(text.includes(B.company) && text.includes(B_BULLETS[0]), "experience B and its bullet on the page");
  });

  await step("6-add-skill-kubernetes", ["5-add-entry-docker"], async () => {
    await addButton("Add to Skills", "Kubernetes").click();
    await gone("Add to Skills", "Kubernetes");
    assert.ok((await paperText()).includes("Kubernetes"), "Kubernetes on the page");
    await line().waitFor();
    observed.afterSkill = (await line().innerText()).trim();
    await shot("2-fit-card-everything-shown.png");
    assert.ok(/shows everything your Master CV backs for this job/.test(observed.afterSkill), `line reads "${observed.afterSkill}"`);
  });

  await step("6b-hidden-section-no-duplicate", ["6-add-skill-kubernetes"], async () => {
    const countOf = async text => (await paperText()).split(text).length - 1;
    assert.equal(await countOf(A_BULLETS[0]), 1, "experience A on the page once before hiding");
    await page.getByRole("button", { name: "Hide Experience", exact: true }).first().click();
    await page.waitForFunction(bullet => ![...document.querySelectorAll(".rb-paper")].some(el => el.textContent.includes(bullet)), A_BULLETS[0]);
    // The fit sees only visible content, so it offers the entry again; adding must not duplicate it
    await addButton("Add entry", "Python").click();
    await page.getByRole("button", { name: "Hide Experience", exact: true }).first().waitFor();
    await page.waitForFunction(bullet => [...document.querySelectorAll(".rb-paper")].some(el => el.textContent.includes(bullet)), A_BULLETS[0]);
    await gone("Add entry", "Python");
    observed.afterHiddenAdd = { aCount: await countOf(A_BULLETS[0]), bCount: await countOf(B_BULLETS[0]) };
    assert.deepEqual(observed.afterHiddenAdd, { aCount: 1, bCount: 1 }, "each experience appears exactly once");
    const row = check(await admin.from("resumes").select("content").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).single());
    await page.waitForTimeout(1200);
    const saved = check(await admin.from("resumes").select("content").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).single());
    assert.equal((saved.content.experience || []).filter(e => e.companyName === A.company).length, 1, "saved document holds experience A once");
    assert.ok(row);
  });

  await step("7-i-have-terraform", ["6-add-skill-kubernetes"], async () => {
    const row = fitCard().locator("li").filter({ hasText: /The posting asks for\s+terraform/i });
    await row.getByRole("button", { name: "I have this" }).click();
    const form = row.locator("form");
    await form.waitFor();
    observed.formText = (await form.innerText()).replace(/\s+/g, " ").slice(0, 300);
    assert.equal(await form.getByLabel("Skill name").inputValue(), "Terraform");
    assert.ok(observed.formText.includes("Only add skills you could talk about in an interview."), "interview sentence");
    await shot("3-i-have-this-form.png");
    // Two submits in the same tick: only one cv_skills row may result
    await form.getByRole("button", { name: "Add to my Master CV" }).evaluate(el => { el.click(); el.click(); });
    await addButton("Add to Skills", "Terraform").waitFor({ timeout: 20000 });
    const rows = check(await mine("cv_skills")).filter(s => /^terraform$/i.test(s.name));
    await page.waitForTimeout(1000);
    const after = check(await mine("cv_skills")).filter(s => /^terraform$/i.test(s.name));
    observed.terraformRows = after.length;
    assert.equal(after.length, 1, "one terraform cv_skills row after a double submit");
    assert.ok(rows.length <= 1);
    assert.ok(!(await paperText()).toLowerCase().includes("terraform"), "terraform is not on the page yet");
  });

  await step("8-pick-best", ["7-i-have-terraform"], async () => {
    await panel().getByRole("button", { name: /Pick the best CV entries for this job/ }).click();
    const picks = panel().locator('section[aria-labelledby="picks-heading"]');
    await picks.waitFor();
    const reasons = await picks.locator("li span.text-xs").allInnerTexts();
    observed.pickReasons = reasons;
    await shot("4-pick-preview.png");
    assert.ok(reasons.length >= 2 && reasons.every(r => /^(Backs|Your most recent role)/.test(r.trim())), `reasons: ${JSON.stringify(reasons)}`);
    await picks.getByRole("button", { name: "Apply to this resume" }).click();
    await picks.waitFor({ state: "detached" }).catch(() => {});
    const text = await paperText();
    assert.ok(text.includes(A.company) && text.includes(B.company), "both experiences on the page after applying");
  });

  await step("9-add-bullet-and-undo", ["2-save-job"], async () => {
    const content = {
      schemaVersion: 2, revision: 0, header: {},
      education: [], projects: [], skills: [], certifications: [], customSections: [],
      experience: [{ companyName: A.company, position: A.position, startDate: "2023-07-01", currentlyWorking: true, description: [A_BULLETS[0]] }],
      target: { jobDescription: "", applicationId: null, opportunityId: null, company: "", role: "" },
    };
    const resume = check(await admin.from("resumes").insert({ user_id: userId, title: `Second ${run}`, content }).select("id").single());
    await page.goto(`${base}/resumes/${resume.id}?job=${observed.opportunityId}`, { waitUntil: "networkidle" });
    await fitCard().waitFor({ timeout: 45000 });
    const button = addButton("Add bullet", "PostgreSQL");
    await button.waitFor({ timeout: 30000 });
    assert.ok(!(await paperText()).includes(A_BULLETS[1]), "bullet not on the page before");
    await shot("5-add-bullet-row.png");
    await button.click();
    await page.locator(".rb-paper", { hasText: A_BULLETS[1] }).first().waitFor();
    const text = await paperText();
    assert.equal(text.split(A_BULLETS[1]).length - 1, 1, "bullet appears exactly once");
    assert.ok(text.includes(A_BULLETS[0]), "existing bullet kept");
    // autosave lands the exact text
    let saved = null;
    for (let i = 0; i < 20 && !saved; i++) {
      const row = check(await admin.from("resumes").select("content").eq("id", resume.id).eq("user_id", userId).single());
      if ((row.content.experience?.[0]?.description || []).includes(A_BULLETS[1])) saved = row.content.experience[0].description;
      else await page.waitForTimeout(500);
    }
    observed.savedBullets = saved;
    assert.deepEqual(saved, [A_BULLETS[0], A_BULLETS[1]], "saved description is the seeded bullet followed by the added one");
    await page.getByRole("button", { name: "Undo" }).first().click();
    await page.waitForFunction(bullet => ![...document.querySelectorAll(".rb-paper")].some(el => el.textContent.includes(bullet)), A_BULLETS[1]);
  });

  steps["10-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
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
