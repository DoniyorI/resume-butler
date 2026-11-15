// Signed-in browser check of "Prepare for the interview" (/applications/<id>/prepare):
//   the entry points (application page, Next steps, Today), the heading, the source line, the upcoming
//   interview, the requirement groups, a story, the recorded answers, that nothing on the page is
//   written by the app, the fallback without a submission, a second user's 404, print, and 375px.
// Creates disposable @example.test users and deletes everything it created in `finally`.
// Never prints the password, keys or tokens.
//
// QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright node --use-system-ca --import ./tests/register.mjs scripts/qa-interview-prep.mjs [screenshotDir]
// (NODE_PATH=/opt/homebrew/lib/node_modules also works for the Playwright import.)
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
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
const email = `sync-qa-${run}-prep@example.test`;
const otherEmail = `sync-qa-${run}-prep-other@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const MISSING = ["42P01", "PGRST205", "PGRST200", "PGRST204"];
const dayKey = offset => { const d = new Date(Date.now() + offset * 86400000); return d.toISOString().slice(0, 10); };

// Everything the page may quote
const COMPANY = "Acme Logistics", ROLE = "Backend Engineer", RESUME_TITLE = `Platform resume ${run}`;
const TS_BULLET = "Built backend services in TypeScript for 40 internal clients";
const PG_BULLET = "Tuned PostgreSQL queries that cut report load time by half";
const DESCRIPTION = [
  "About the role",
  "Acme Logistics moves fresh produce every day.",
  "",
  "What you'll need",
  "- Strong TypeScript skills for backend services",
  "- Production experience with PostgreSQL databases",
  "- Experience with Docker",
  "- Experience with Kubernetes",
].join("\n");
const ANSWERS = [
  { question: "Why Acme Logistics?", answer: "I like logistics software and small teams." },
  { question: "What are your salary expectations?", answer: "Open to the posted range." },
];
const STEP = { title: "Panel interview", contact: "Priya Shah", link: "https://example.test/room", notes: "Bring the system design notes" };
const submittedOn = dayKey(-10);
const submittedLabel = (() => { const [y, m, d] = submittedOn.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); })();
const SEEDED = [COMPANY, ROLE, RESUME_TITLE, TS_BULLET, PG_BULLET, DESCRIPTION, ...ANSWERS.flatMap(a => [a.question, a.answer]), ...Object.values(STEP), "Northwind Labs", "Backend Engineer, Northwind Labs", "Docker", "Skills: Tools", "Kubernetes", "TypeScript", "PostgreSQL"].join("\n");
const INVENTED = ["expert", "proficient", "years of experience in", "extensive", "skilled in", "passionate", "seasoned", "chance of", "likelihood", "% match"];

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
    email, password, email_confirm: true, user_metadata: { first_name: "Prep QA", last_name: run, sync_qa_run: run },
  }));
  const userId = created.user.id;
  createdUsers.push(userId);
  const probe = await admin.from("application_submissions").select("id").eq("user_id", userId).limit(1);
  if (probe.error) throw new Error(`Migration 015 does not look applied (${probe.error.code})`);
  const probeSteps = await admin.from("application_activities").select("id").eq("user_id", userId).limit(1);
  if (probeSteps.error) throw new Error(`Migration 020 does not look applied (${probeSteps.error.code})`);

  // Master CV: two bullets and a Docker skill line (a skill with no example)
  const experience = check(await admin.from("cv_experience").insert({ user_id: userId, company: "Northwind Labs", position: "Backend Engineer", start_date: "2021-01-01", currently_working: true, sort_order: 0 }).select("id")).at(0);
  check(await admin.from("cv_experience_bullets").insert([TS_BULLET, PG_BULLET].map((content, sort_order) => ({ experience_id: experience.id, content, sort_order }))));
  check(await admin.from("cv_skills").insert({ user_id: userId, name: "Docker", category: "Tools", sort_order: 0 }));

  const app = check(await admin.from("applications").insert({ user_id: userId, company: COMPANY, role: ROLE, status: "Interviewed", applied_date: submittedOn, job_description: DESCRIPTION }).select("id").single());
  const plain = check(await admin.from("applications").insert({ user_id: userId, company: "Fallback Co", role: "Engineer", status: "Applied", applied_date: dayKey(-3), job_description: DESCRIPTION }).select("id").single());

  // The record capture_application_submission would write for a "selected" resume
  const snapshot = {
    schemaVersion: 2, revision: 0, header: {}, education: [], projects: [], skills: [], certifications: [], customSections: [],
    experience: [{ companyName: "Northwind Labs", position: "Backend Engineer", startDate: "2021-01-01", currentlyWorking: true, description: [TS_BULLET] }],
  };
  check(await admin.from("application_submissions").insert({
    user_id: userId, event_id: randomUUID(), request_hash: randomBytes(32).toString("hex"), application_id: app.id, kind: "selected",
    submitted_on: submittedOn, application_snapshot: { company: COMPANY, role: ROLE }, job_description: DESCRIPTION,
    resume_title: RESUME_TITLE, resume_snapshot: snapshot, answers: ANSWERS, notes: "",
  }));
  const submission = check(await admin.from("application_submissions").select("id").eq("user_id", userId).single());

  const tomorrow = dayKey(1);
  check(await admin.from("application_activities").insert({
    user_id: userId, application_id: app.id, kind: "interview", title: STEP.title, due_on: tomorrow, starts_at: `${tomorrow}T15:00:00Z`, time_zone: "UTC",
    status: "open", contact_name: STEP.contact, contact_channel: "video", link: STEP.link, notes: STEP.notes,
  }));

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(`${error.message} @ ${new URL(page.url()).pathname.replace(/[0-9a-f-]{36}/g, "<id>")}`));
  observed.consoleErrors = [];
  page.on("console", message => { if (message.type() === "error" && observed.consoleErrors.length < 5) observed.consoleErrors.push(message.text().slice(0, 300)); });
  const login = async (p, who) => {
    await p.goto(`${base}/login`, { waitUntil: "networkidle" });
    await p.getByLabel("Email", { exact: true }).fill(who);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Login", exact: true }).click();
    await p.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  };
  const flat = async loc => (await loc.innerText()).replace(/\s+/g, " ");
  const prepareUrl = `${base}/applications/${app.id}/prepare`;
  const section = key => page.locator(`section[aria-labelledby="prep-${key}"]`);

  await step("0-login", [], () => login(page, email));

  await step("1-entry-points", ["0-login"], async () => {
    await page.goto(`${base}/applications/${app.id}`, { waitUntil: "networkidle" });
    const link = page.getByRole("link", { name: "Prepare for interview" });
    await link.waitFor();
    assert.equal(await link.getAttribute("href"), `/applications/${app.id}/prepare`);
    const stepsCard = page.locator("#next-steps");
    assert.equal(await stepsCard.getByRole("link", { name: "Prepare", exact: true }).getAttribute("href"), `/applications/${app.id}/prepare`, "Next steps row links to prepare");
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const today = page.locator("li[data-activity-id]").filter({ hasText: STEP.title }).first();
    await today.waitFor();
    assert.equal(await today.getByRole("link", { name: "Prepare", exact: true }).getAttribute("href"), `/applications/${app.id}/prepare`, "Today row links to prepare");
    // An Applied application with no interview step has no link
    await page.goto(`${base}/applications/${plain.id}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Prepare for interview" }).count(), 0, "no link for an Applied application without an interview step");
    await page.goto(`${base}/applications/${app.id}`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Prepare for interview" }).click();
    await page.waitForURL(prepareUrl);
  });

  await step("2-heading-and-source", ["1-entry-points"], async () => {
    await page.goto(prepareUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: `Prepare for ${ROLE} at ${COMPANY}` }).waitFor();
    const header = await flat(page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) }));
    observed.source = header.slice(0, 200);
    assert.ok(header.includes(`Submitted ${submittedLabel}`), `source line names the date (${header})`);
    assert.ok(header.includes(`“${RESUME_TITLE}”`), "source line names the resume title");
    assert.equal(await page.getByRole("link", { name: "See what you sent" }).getAttribute("href"), `/submissions/${submission.id}`);
    assert.equal(await page.getByRole("link", { name: "Back to the application" }).getAttribute("href"), `/applications/${app.id}`);
    await shot(page, "prepare-top.png");
  });

  await step("3-upcoming", ["2-heading-and-source"], async () => {
    const card = page.locator('section[aria-label="Upcoming interview"]');
    const t = await flat(card);
    observed.upcoming = t;
    for (const part of [STEP.title, STEP.contact, "Video call", STEP.notes, "3:00 PM UTC"]) assert.ok(t.includes(part), `upcoming card shows ${part} (${t})`);
    assert.equal(await card.getByRole("link", { name: "Open link" }).getAttribute("href"), STEP.link);
  });

  await step("4-groups", ["2-heading-and-source"], async () => {
    const deeper = await flat(section("goDeeper"));
    const bring = await flat(section("bringUp"));
    const example = await flat(section("needExample"));
    const gaps = await flat(section("gaps"));
    observed.groups = { deeper: deeper.slice(0, 160), bring: bring.slice(0, 160), example: example.slice(0, 160), gaps: gaps.slice(0, 160) };
    assert.ok(deeper.startsWith("On the resume they read — expect follow-up questions"), deeper);
    assert.ok(deeper.includes("TypeScript") && deeper.includes(TS_BULLET), "TypeScript is on the resume they read, with the user's bullet");
    assert.ok(deeper.includes("The posting: “Strong TypeScript skills for backend services”"), "posting quote");
    assert.ok(bring.startsWith("In your Master CV but not on what you sent — you can bring it up"), bring);
    assert.ok(bring.includes("PostgreSQL") && bring.includes(PG_BULLET), "PostgreSQL is in the Master CV, not on the resume");
    assert.ok(example.startsWith("Listed but without an example — think of one") && example.includes("Docker"), example);
    assert.ok(gaps.startsWith("Not in your Master CV — prepare an honest answer") && gaps.includes("Kubernetes"), gaps);
    assert.ok(!gaps.includes("Docker") && !deeper.includes("Kubernetes"));
  });

  await step("5-story-checks-answers", ["2-heading-and-source"], async () => {
    const stories = await flat(section("stories"));
    assert.ok(stories.includes(TS_BULLET) && stories.includes("Covers:"), `story bullet verbatim (${stories.slice(0, 200)})`);
    const answers = await flat(section("answers"));
    for (const a of ANSWERS) assert.ok(answers.includes(a.question) && answers.includes(a.answer), `answer ${a.question}`);
    assert.ok(answers.startsWith("What you told them in the application"));
    const footer = await flat(page.locator(".rb-prep"));
    assert.ok(footer.includes("Everything here is quoted from the posting, your Master CV, or what you recorded when you applied. Nothing is generated."));
  });

  await step("6-nothing-invented", ["2-heading-and-source"], async () => {
    const body = await flat(page.locator(".rb-prep"));
    const lower = body.toLowerCase();
    for (const word of INVENTED) assert.ok(!lower.includes(word) || SEEDED.toLowerCase().includes(word), `page contains "${word}"`);
    // Every quoted passage is the user's or the posting's own words
    const quotes = [...body.matchAll(/“([^”]+)”/g)].map(m => m[1].replace(/^…|…$/g, "").trim());
    observed.quotes = quotes.length;
    assert.ok(quotes.length >= 6, `quoted passages found (${quotes.length})`);
    for (const quote of quotes) assert.ok(SEEDED.includes(quote), `quoted text is not seeded: ${quote}`);
    assert.equal(await page.locator("[dangerouslysetinnerhtml]").count(), 0);
  });

  await step("7-no-submission-fallback", ["1-entry-points"], async () => {
    await page.goto(`${base}/applications/${plain.id}/prepare`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Prepare for Engineer at Fallback Co" }).waitFor();
    const t = await flat(page.locator(".rb-prep"));
    assert.ok(t.includes("No submitted version recorded. This uses the job description and resume saved on the application now."), t.slice(0, 300));
    assert.ok(t.includes("No interview scheduled. Add one under Next steps."));
    assert.equal(await page.getByRole("link", { name: "Next steps" }).getAttribute("href"), `/applications/${plain.id}?step=interview#next-steps`);
    assert.ok(await page.locator('section[aria-labelledby="prep-gaps"]').count() === 1 || (await page.locator('section[aria-labelledby="prep-shown"]').count()) === 1, "requirements still grouped");
    assert.equal(await page.locator('section[aria-labelledby="prep-goDeeper"]').count(), 0, "no 'on the resume they read' group without a resume");
    await shot(page, "prepare-current.png");
  });

  await step("8-print", ["2-heading-and-source"], async () => {
    await page.goto(prepareUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Print", exact: true }).waitFor();
    await page.emulateMedia({ media: "print" });
    try {
      const hidden = await page.evaluate(() => ({
        nav: [...document.querySelectorAll("header.fixed")].every(el => getComputedStyle(el).display === "none"),
        print: getComputedStyle([...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Print")).display,
        card: getComputedStyle(document.querySelector('section[aria-labelledby="prep-goDeeper"] > div')).backgroundColor,
      }));
      observed.print = hidden;
      assert.ok(hidden.nav, "the app header is hidden when printing");
      assert.equal(hidden.print, "none", "the Print button is hidden when printing");
      assert.ok(["rgba(0, 0, 0, 0)", "transparent"].includes(hidden.card), `no background colour when printing (${hidden.card})`);
    } finally { await page.emulateMedia({ media: "screen" }); }
  });

  await step("9-mobile-375", ["2-heading-and-source"], async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    try {
      for (const url of [prepareUrl, `${base}/applications/${app.id}`]) {
        await page.goto(url, { waitUntil: "networkidle" });
        const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
        observed[`mobile ${url.endsWith("prepare") ? "prepare" : "application"}`] = w;
        assert.ok(w.scroll <= w.inner + 1, `horizontal overflow on ${url} (${w.scroll} > ${w.inner})`);
        if (url === prepareUrl) await shot(page, "prepare-mobile.png");
      }
    } finally { await page.setViewportSize({ width: 1280, height: 1000 }); }
  });

  await step("10-second-user-404", ["2-heading-and-source"], async () => {
    const other = check(await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { sync_qa_run: run } }));
    createdUsers.push(other.user.id);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const second = await context.newPage();
    second.setDefaultTimeout(30000);
    second.on("pageerror", error => pageErrors.push(`second user: ${error.message}`));
    try {
      await login(second, otherEmail);
      const response = await second.goto(`${base}/applications/${app.id}/prepare`, { waitUntil: "networkidle" });
      observed.secondUserStatus = response.status();
      const t = await flat(second.locator("body"));
      for (const secret of [COMPANY, RESUME_TITLE, TS_BULLET, ANSWERS[0].answer, STEP.contact]) assert.ok(!t.includes(secret), `second user can see "${secret}"`);
      assert.ok(/could not be found|not found|404/i.test(t), `a not-found page is shown (${t.slice(0, 120)})`);
      assert.equal(await second.getByRole("heading", { level: 1, name: /Prepare for/ }).count(), 0);
    } finally { await context.close(); }
  });

  steps["11-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors: ${pageErrors.slice(0, 3).join(" | ")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  const left = {};
  try {
    for (const userId of createdUsers) {
      const { data: experience } = await admin.from("cv_experience").select("id").eq("user_id", userId);
      const experienceIds = (experience || []).map(e => e.id);
      if (experienceIds.length) {
        const { error } = await admin.from("cv_experience_bullets").delete().in("experience_id", experienceIds);
        if (error) throw new Error(`cv_experience_bullets: ${error.message}`);
      }
      const tables = ["application_activities", "application_submissions", "application_suggestions", "applications", "job_opportunities", "resumes", "cv_experience", "cv_skills", "cv_education", "cv_projects", "cv_certifications"];
      for (const table of tables) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !MISSING.includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      for (const table of ["application_activities", "application_submissions", "applications", "cv_experience", "cv_skills"]) {
        const { count, error: countError } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (!countError && count) left[table] = (left[table] || 0) + count;
      }
      if (experienceIds.length) {
        const { count } = await admin.from("cv_experience_bullets").select("id", { count: "exact", head: true }).in("experience_id", experienceIds);
        if (count) left.cv_experience_bullets = count;
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
  // eslint-disable-next-line no-console -- the one JSON report
  console.log(JSON.stringify({ run, steps, observed, pageErrors, screenshots, cleanup }, null, 1));
  if (cleanup.ok === false || Object.values(steps).some(v => v !== "pass")) process.exitCode = 1;
}
