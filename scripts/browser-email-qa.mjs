import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const session = JSON.parse(await readFile(process.argv[2], "utf8"));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") console.log(JSON.stringify({ page: new URL(page.url()).pathname, consoleError: message.text().slice(0, 2200) }));
  });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(session.accounts[0].email);
  await page.getByLabel("Password", { exact: true }).fill(session.accounts[0].password);
  await page.getByRole("button", { name: /^Login$/ }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 45000 });
  await page.goto("http://localhost:3000/email-sync", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/resume-butler-email-qa-before.png", fullPage: true });
  const before = await page.locator("body").innerText();
  await writeFile("/tmp/resume-butler-email-qa-dom.txt", before);
  // Only dedicated synthetic suggestions; never approve an unrecognized row.
  for (const [company, role] of [["QA Acme Research", "Backend Engineer"], ["QA Northstar", "Data Analyst"], ["QA Orbit Labs", "Frontend Engineer"]]) {
    const target = page.getByRole("listitem").filter({ hasText: `${company} · ${role}` });
    if (await target.count() === 0) continue; // Re-run after an earlier successful approval.
    if (await target.count() !== 1) throw new Error(`Expected one synthetic review row for ${company}/${role}`);
    await target.getByRole("button", { name: /^(Update|Add)$/ }).click();
    await target.waitFor({ state: "detached", timeout: 30000 });
  }
  await page.screenshot({ path: "/tmp/resume-butler-email-qa-after.png", fullPage: true });
  await page.goto("http://localhost:3000/applications", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/resume-butler-email-qa-applications.png", fullPage: true });
  await writeFile("/tmp/resume-butler-email-qa-applications.txt", await page.locator("body").innerText());
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: authError } = await client.auth.signInWithPassword({ email: session.accounts[0].email, password: session.accounts[0].password });
  if (authError) throw authError;
  const { data: applications, error: readError } = await client.from("applications")
    .select("id,company,role,status,applied_date").eq("user_id", session.accounts[0].id);
  if (readError) throw readError;
  const { data: approved, error: approvalError } = await client.from("application_suggestions")
    .select("application_id").eq("user_id", session.accounts[0].id).eq("state", "approved");
  if (approvalError) throw approvalError;
  const expectedIds = new Set([...session.applications.primary.map(a => a.id), ...approved.map(s => s.application_id)]);
  assert.deepEqual(applications.map(a => a.id).sort(), [...expectedIds].sort(), "only seeded or explicitly approved applications may exist");
  assert.equal(applications.find(a => a.company === "QA Orbit Labs").status, "Offered");
  const backend = applications.find(a => a.company === "QA Acme Research" && a.role === "Backend Engineer");
  assert.equal(backend.status, "Interviewed");
  assert.deepEqual(applications.filter(a => a.company === "QA Northstar").map(a => a.status).sort(), ["Applied", "Rejected"]);
  const { data: history, error: historyError } = await client.from("application_status_history")
    .select("status").eq("application_id", backend.id);
  if (historyError) throw historyError;
  assert.ok(history.some(h => h.status === "Applied"));
  assert.ok(history.some(h => h.status === "Interviewed"));
  await page.getByRole("row").filter({ hasText: "Backend Engineer" }).getByRole("link", { name: "QA Acme Research" }).click();
  await page.getByText("Timeline", { exact: true }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: "/tmp/resume-butler-email-qa-timeline.png", fullPage: true });
  assert.equal(errors.length, 0, "browser must have no hydration/runtime errors");
  const report = { pageErrors: errors, approved: ["Backend Engineer interview", "Northstar new hiring cycle", "Orbit offer"], applications, history,
    screenshots: ["/tmp/resume-butler-email-qa-applications.png", "/tmp/resume-butler-email-qa-timeline.png"] };
  await writeFile("/tmp/resume-butler-browser-qa-result.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
