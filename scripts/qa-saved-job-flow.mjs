// Signed-in browser check of the saved job flow: save, tailor (no AI), apply,
// re-save, deep link, manual add with the same link, dashboard caption.
// Creates one disposable @example.test user per run and deletes everything it
// created in `finally`. Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-saved-job-flow.mjs [screenshotDir]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { normalizeResumeContent } from "@/features/resumes/resumeDocument";

nextEnv.loadEnvConfig(process.cwd());
const base = "http://localhost:3000";
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("This check is restricted to the named QA project.");
if ((process.env.QA_APP_ORIGIN || base) !== base) throw new Error("This check only runs against http://localhost:3000.");

const shots = process.argv[2] || "/tmp/resume-butler-saved-job-qa";
await mkdir(shots, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");

const run = randomBytes(5).toString("hex");
const email = `sync-qa-${run}-savedjob@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const company = `Acme QA ${run}`, link = `https://example.test/jobs/${run}`;
const description = "Requirements: 5+ years of experience with Python, C++ and C#. We go above and beyond for customers. Scrum master certification is a plus. Remote.";
const betaCompany = `Beta QA ${run}`, betaLink = `https://example.test/jobs/${run}-b`, betaDescription = `Beta QA ${run}: build reliable Go services with PostgreSQL.`;
const AI_PATHS = [/^\/api\/generate-/, /^\/api\/tailor-resume/, /^\/api\/suggest-bullets/, /^\/api\/rewrite-/];

const steps = {}, observed = {}, pageErrors = [], aiCalls = [], screenshots = [];
const ctx = {};
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
    email, password, email_confirm: true, user_metadata: { first_name: "Saved Job QA", last_name: run, sync_qa_run: run },
  }));
  userId = created.user.id;
  const mine = table => admin.from(table).select("*").eq("user_id", userId);

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(30000);
  const navigations = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (AI_PATHS.some(re => re.test(path))) aiCalls.push(path); });
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });

  await step("1-login", [], async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  });

  const card = name => page.locator("article").filter({ hasText: name });
  async function saveJobViaUi(c, l, d) {
    await page.getByRole("button", { name: "Save a job" }).click();
    const form = page.locator("form").filter({ hasText: "Save an opening" });
    await form.getByLabel("Company", { exact: true }).fill(c);
    await form.getByLabel("Job title", { exact: true }).fill("Backend Engineer");
    await form.getByLabel("Posting link", { exact: true }).fill(l);
    await form.getByLabel("Job description", { exact: true }).fill(d);
    await form.getByRole("button", { name: "Save job" }).click();
    await card(c).waitFor();
  }

  await step("2-save-job", ["1-login"], async () => {
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    await saveJobViaUi(company, link, description);
    const rows = check(await mine("job_opportunities"));
    assert.equal(rows.length, 1, "one saved job row");
    ctx.opportunityId = rows[0].id;
    await page.screenshot({ path: join(shots, "1-saved-job-card.png"), fullPage: true }); screenshots.push(join(shots, "1-saved-job-card.png"));
  });

  await step("3-tailor-and-match", ["2-save-job"], async () => {
    await card(company).getByRole("button", { name: "Tailor resume" }).click();
    await page.waitForURL(/\/resumes\/[0-9a-f-]{36}/, { timeout: 45000 });
    const deep = navigations.find(u => /\/resumes\/[0-9a-f-]{36}\?job=/.test(u));
    observed.tailorUrl = deep || page.url();
    const m = observed.tailorUrl.match(/\/resumes\/([0-9a-f-]{36})\?job=([0-9a-f-]{36})/);
    assert.ok(m, `expected /resumes/<id>?job=<opportunityId>, saw ${observed.tailorUrl}`);
    assert.equal(m[2], ctx.opportunityId);
    ctx.resumeId = m[1];
    const panel = page.getByRole("tabpanel");
    await panel.getByText("Tailoring for", { exact: true }).waitFor();
    await panel.getByText(`Backend Engineer at ${company}`, { exact: true }).waitFor();
    assert.ok((await panel.innerText()).includes("5+ years of experience with Python") || (await panel.textContent()).includes(description), "description shown in the job target");
    const match = panel.locator("section").filter({ hasText: "Job match" });
    await match.waitFor({ timeout: 45000 });
    await page.waitForFunction(el => !el.querySelector(".animate-spin"), await match.elementHandle(), { timeout: 30000 });
    const matchText = await match.innerText();
    observed.matchCard = matchText.replace(/\s+/g, " ").slice(0, 600);
    await page.screenshot({ path: join(shots, "2-studio-job-target.png") }); screenshots.push(join(shots, "2-studio-job-target.png"));
    const errs = [];
    if (await match.locator("circle").count()) errs.push("a score ring is drawn");
    if (!matchText.includes("Add experience, projects or skills before scoring this resume.")) errs.push("empty-resume message missing");
    const heading = match.getByText("Missing from the page", { exact: true });
    const missing = (await heading.count()) ? (await heading.locator("xpath=following-sibling::div[1]/*").allTextContents()).map(s => s.trim().toLowerCase()) : [];
    observed.missingKeywords = missing;
    for (const k of ["c++", "c#"]) if (!missing.includes(k)) errs.push(`missing keywords lack ${k}`);
    for (const k of ["go", "master's degree"]) if (missing.includes(k)) errs.push(`missing keywords wrongly include ${k}`);
    if (missing.some(k => /years? of experience/.test(k))) errs.push("missing keywords include a years-of-experience phrase");
    if (!matchText.includes("The posting asks for 5+ years of experience")) errs.push("5+ years note missing");
    assert.deepEqual(errs, []);
  });

  await step("4-i-applied", ["2-save-job"], async () => {
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    await card(company).getByRole("button", { name: "I applied" }).click();
    const date = await card(company).locator('input[type="date"]').inputValue();
    observed.appliedDateInput = date;
    await card(company).getByRole("button", { name: "Track application" }).click();
    await card(company).getByText("Tracked application", { exact: true }).waitFor();
    const view = card(company).getByRole("link", { name: /View application/ });
    await view.waitFor();
    await view.click();
    await page.waitForURL(/\/applications\/[0-9a-f-]{36}/);
    ctx.applicationId = page.url().match(/\/applications\/([0-9a-f-]{36})/)[1];
    await page.getByText("Kept here in case the posting is taken down.").waitFor();
    await page.waitForLoadState("networkidle");
    assert.ok((await page.locator("body").innerText()).includes("5+ years of experience with Python, C++ and C#"), "application page shows the job description");
    await page.screenshot({ path: join(shots, "3-application-page.png"), fullPage: true }); screenshots.push(join(shots, "3-application-page.png"));
  });

  // The application page compares its saved description with the Master CV. The
  // skills are seeded here, after the tailoring step, so that step still starts from an empty CV.
  await step("4b-application-fit", ["4-i-applied"], async () => {
    check(await admin.from("cv_skills").insert(["Python", "C++", "C#"].map((name, sort_order) => ({ user_id: userId, name, category: "Languages", sort_order }))));
    await page.goto(`${base}/applications/${ctx.applicationId}`, { waitUntil: "networkidle" });
    const fit = page.locator("div.mb-4").filter({ hasText: /Good fit|Strong fit|Stretch|Low fit/ }).first();
    await fit.waitFor();
    const body = await page.locator("body").innerText();
    observed.applicationFit = body.slice(body.indexOf("Fit for this job"), body.indexOf("Fit for this job") + 400).replace(/\s+/g, " ");
    const errs = [];
    if (!(await fit.innerText()).includes("Good fit")) errs.push("fit band is not Good fit");
    if (!body.includes("Based on the saved job description.")) errs.push("sentence missing");
    // The readable names show up under See why
    await fit.getByRole("button", { name: "See why" }).click();
    const why = await page.locator("body").innerText();
    for (const label of ["Python", "C++", "C#"]) if (!why.includes(label)) errs.push(`no ${label} row`);
    await page.screenshot({ path: join(shots, "3b-application-fit.png"), fullPage: true }); screenshots.push(join(shots, "3b-application-fit.png"));
    if (errs.length) throw new Error(errs.join("; "));
  });

  await step("5-application-row", ["4-i-applied"], async () => {
    const apps = check(await mine("applications"));
    assert.equal(apps.length, 1, "exactly one application");
    const a = apps[0];
    observed.application = { status: a.status, applied_date: a.applied_date, portal_link: a.portal_link, resume_id: a.resume_id, descriptionMatches: a.job_description === description };
    const errs = [];
    if (a.id !== ctx.applicationId) errs.push("row id differs from linked page");
    if (a.job_description !== description) errs.push("job_description differs");
    if (!a.portal_link) errs.push("portal_link empty");
    if (!a.applied_date) errs.push("applied_date null");
    if (a.status !== "Applied") errs.push(`status ${a.status}`);
    if (!ctx.resumeId) errs.push("no resume from step 3 to compare");
    else if (a.resume_id !== ctx.resumeId) errs.push(`resume_id ${a.resume_id} != ${ctx.resumeId}`);
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    await card(company).waitFor();
    if (await card(company).getByRole("button", { name: "I applied" }).count()) errs.push("I applied still offered after tracking");
    await page.reload({ waitUntil: "networkidle" });
    if (check(await mine("applications")).length !== 1) errs.push("more than one application after reload");
    assert.deepEqual(errs, []);
  });

  await step("6-resave-keeps", ["2-save-job"], async () => {
    const before = check(await admin.from("job_opportunities").select("resume_id,payload").eq("user_id", userId).eq("id", ctx.opportunityId).single());
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    await card(company).getByRole("button", { name: "Review details" }).click();
    const form = page.locator("form").filter({ hasText: "Review saved job" });
    await form.getByRole("button", { name: "Save job" }).click();
    await form.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    const after = check(await admin.from("job_opportunities").select("resume_id,payload").eq("user_id", userId).eq("id", ctx.opportunityId).single());
    observed.resave = { resumeBefore: before.resume_id, resumeAfter: after.resume_id, descriptionSame: before.payload.job_description === after.payload.job_description };
    assert.equal(after.resume_id, before.resume_id);
    assert.equal(after.payload.job_description, before.payload.job_description);
    assert.equal(after.payload.job_description, description);
  });

  await step("7-deep-link-prompt", ["2-save-job"], async () => {
    const content = normalizeResumeContent({ target: { jobDescription: "Other job text", company: "Other Co QA", role: "Other role", applicationId: null, opportunityId: null } });
    const other = check(await admin.from("resumes").insert({ user_id: userId, title: `QA other target ${run}`, content }).select("id").single());
    await page.goto(`${base}/resumes/${other.id}?job=${ctx.opportunityId}`, { waitUntil: "networkidle" });
    const panel = page.getByRole("tabpanel");
    await panel.getByText("Tailoring for", { exact: true }).waitFor();
    const text = await panel.textContent();
    observed.deepLinkPanel = (await panel.innerText()).replace(/\s+/g, " ").slice(0, 300);
    assert.ok(text.includes("Other job text"), "editor keeps Other job text as the target");
    assert.ok(text.includes("This resume is aimed at another job. Switch to the saved job"), "switch prompt offered");
    await panel.getByRole("button", { name: "Switch", exact: true }).waitFor();
    const stored = check(await admin.from("resumes").select("content").eq("user_id", userId).eq("id", other.id).single());
    assert.equal(stored.content.target.jobDescription, "Other job text");
  });

  await step("8-manual-add-context", ["1-login"], async () => {
    await page.goto(`${base}/saved-jobs`, { waitUntil: "networkidle" });
    await saveJobViaUi(betaCompany, betaLink, betaDescription);
    await page.goto(`${base}/applications`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "New application" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company Name", { exact: true }).fill(betaCompany);
    await dialog.getByLabel("Portal Link", { exact: true }).fill(betaLink);
    await dialog.getByLabel("Role", { exact: true }).fill("Backend Engineer");
    await dialog.getByRole("button", { name: "Add Application" }).click();
    await dialog.waitFor({ state: "detached" });
    const rows = check(await admin.from("applications").select("job_description,portal_link").eq("user_id", userId).eq("company", betaCompany));
    observed.manual = rows.map(r => ({ portal_link: r.portal_link, descriptionMatches: r.job_description === betaDescription, descriptionLength: (r.job_description || "").length }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].job_description, betaDescription);
  });

  await step("9-dashboard-caption", ["1-login"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const caption = page.getByText(/heard back from an employer/);
    await caption.first().waitFor();
    observed.dashboardCaption = (await caption.first().innerText()).trim();
  });

  steps["10-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors` : "pass";
  steps["no-ai-calls"] = aiCalls.length ? `fail: ${aiCalls.join(",")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (userId) {
    try {
      const tables = ["application_suggestions", "applications", "job_opportunities", "cover_letters", "resumes", "cv_skills"];
      for (const table of tables) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !["42P01", "PGRST205"].includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      const left = {};
      for (const table of ["applications", "job_opportunities", "resumes", "cv_skills"]) {
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
  console.log(JSON.stringify({ run, steps, observed, pageErrors, aiCalls, screenshots, cleanup }));
}
