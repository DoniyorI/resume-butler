// Signed-in browser check of "Check PDF text" in the resume editor (Download menu):
//   the dialog's "Read back N of M lines" with N = M for a plain resume, the extracted text, 375px layout,
//   and that another user's resume id returns 404 and no text through POST /api/resume-readability.
// Creates disposable @example.test users and deletes everything it created in `finally`.
// Compiles through the app's PDF service, so it needs network access. Never prints the password or keys.
//
// NODE_PATH=/opt/homebrew/lib/node_modules node --use-system-ca --import ./tests/register.mjs scripts/qa-resume-readability.mjs [screenshotDir]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readabilityResume } from "../tests/fixtures/readability-resume.mjs";

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
const email = `sync-qa-${run}-read@example.test`;
const otherEmail = `sync-qa-${run}-read-other@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const MISSING = ["42P01", "PGRST205", "PGRST200", "PGRST204"];

// The fixture resume without the accented word, which the PDF fonts draw as two marks
const BULLET = "Built an efficient scheduling service in TypeScript that served 40 internal clients";
const content = {
  ...readabilityResume,
  projects: readabilityResume.projects.map(project => ({ ...project, description: ["Published a command-line tool that checks resume files for formatting problems"] })),
};

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
    email, password, email_confirm: true, user_metadata: { first_name: "Read QA", last_name: run, sync_qa_run: run },
  }));
  const userId = created.user.id;
  createdUsers.push(userId);
  const resume = check(await admin.from("resumes").insert({ user_id: userId, title: `Readability ${run}`, content }).select("id").single());

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(60000);
  page.on("pageerror", error => pageErrors.push(`${error.message} @ ${new URL(page.url()).pathname.replace(/[0-9a-f-]{36}/g, "<id>")}`));
  const login = async (p, who) => {
    await p.goto(`${base}/login`, { waitUntil: "networkidle" });
    await p.getByLabel("Email", { exact: true }).fill(who);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Login", exact: true }).click();
    await p.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  };
  const dialog = page.getByRole("dialog");

  await step("0-login", [], () => login(page, email));

  await step("1-run-check", ["0-login"], async () => {
    await page.goto(`${base}/resumes/${resume.id}`, { waitUntil: "networkidle" });
    await page.locator(".rb-paper").waitFor();
    await page.getByRole("button", { name: "Download" }).click();
    await page.getByRole("menuitem", { name: "Check PDF text" }).click();
    await dialog.getByText(/Read back \d+ of \d+ lines from your PDF/).waitFor();
    const summary = (await dialog.getByText(/Read back \d+ of \d+ lines/).first().innerText()).replace(/\s+/g, " ");
    const [, found, expected] = summary.match(/Read back (\d+) of (\d+)/);
    observed.summary = summary;
    assert.ok(Number(expected) >= 20, `expected lines (${expected})`);
    assert.equal(found, expected, `every line read back (${summary})`);
    assert.equal(await dialog.getByRole("region", { name: "Lines not found" }).count(), 0);
    await shot(page, "readability-dialog.png");
  });

  await step("2-extracted-text", ["1-run-check"], async () => {
    await dialog.getByText("Text extracted from the PDF", { exact: true }).first().click();
    const extracted = await dialog.getByLabel("Text extracted from the PDF").innerText();
    assert.ok(extracted.includes("Alex Example"), "the name is in the extracted text");
    assert.ok(extracted.includes(BULLET), "a bullet is in the extracted text");
    assert.ok(!/Page \(\d+\) Break/.test(extracted), "no page-break marker lines");
    const note = await dialog.innerText();
    assert.ok(note.includes("this is a check, not a guarantee"), "the note is shown");
    for (const row of ["Email: found", "Phone: found", "LinkedIn: found", "GitHub: found"]) assert.ok(note.includes(row), row);
    assert.ok(note.includes("appear in the order they are printed"));
  });

  await step("3-mobile-375", ["1-run-check"], async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    try {
      await page.waitForTimeout(500);
      const box = await dialog.boundingBox();
      const overflow = await page.evaluate(() => {
        const el = document.querySelector('[role="dialog"]');
        return { page: document.documentElement.scrollWidth, inner: window.innerWidth, dialog: el.scrollWidth, client: el.clientWidth };
      });
      observed.mobile = { ...overflow, left: box.x, right: box.x + box.width };
      assert.ok(overflow.page <= overflow.inner + 1, `page overflows (${overflow.page} > ${overflow.inner})`);
      assert.ok(overflow.dialog <= overflow.client + 1, `dialog content overflows (${overflow.dialog} > ${overflow.client})`);
      assert.ok(box.x >= 0 && box.x + box.width <= 375 + 1, "dialog is inside the viewport");
      await shot(page, "readability-mobile.png");
    } finally { await page.setViewportSize({ width: 1280, height: 1000 }); }
  });

  await step("4-other-users-resume", ["0-login"], async () => {
    const other = check(await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { sync_qa_run: run } }));
    createdUsers.push(other.user.id);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const second = await context.newPage();
    second.setDefaultTimeout(45000);
    second.on("pageerror", error => pageErrors.push(`second user: ${error.message}`));
    try {
      await login(second, otherEmail);
      const result = await second.evaluate(async id => {
        const response = await fetch("/api/resume-readability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId: id }) });
        return { status: response.status, body: await response.text() };
      }, resume.id);
      observed.otherUser = { status: result.status };
      assert.ok([403, 404].includes(result.status), `status ${result.status}`);
      for (const secret of ["Alex Example", BULLET, "alex@example.test", "extractedText"]) assert.ok(!result.body.includes(secret), `response leaks "${secret}"`);
    } finally { await context.close(); }
  });

  steps["5-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors: ${pageErrors.slice(0, 3).join(" | ")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  const left = {};
  try {
    for (const userId of createdUsers) {
      for (const table of ["resumes"]) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !MISSING.includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      const { count, error: countError } = await admin.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (!countError && count) left.resumes = (left.resumes || 0) + count;
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
