// Uses only the dedicated synthetic account; never reads other users' resumes.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const path = process.argv[2];
const session = JSON.parse(await readFile(path, "utf8"));
const account = session.accounts[0];
assert.match(account.email, /^sync-qa-.*@example\.test$/);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
if (authError) throw authError;
const content = count => ({
  header: { name: "Alex Fitcheck", email: account.email, phone: "", location: "Test City" },
  education: [], projects: [], skills: [],
  experience: [{ companyName: "Fictional Systems", position: "Software Engineer", location: "Test City", startDate: "2023-01-01", endDate: "2026-01-01", description: Array.from({ length: count }, (_, i) => `Built synthetic service ${i + 1} with reliable APIs and measured test coverage for example workflows.`) }],
  order: [{ id: "experience", title: "Experience" }, { id: "education", title: "Education", hidden: true }, { id: "projects", title: "Projects", hidden: true }, { id: "skills", title: "Skills", hidden: true }],
});
let resumeId = session.pageFitResumeId;
if (!resumeId) {
  const { data, error } = await client.from("resumes").insert({ user_id: account.id, title: `QA Page Fit ${session.run}`, content: content(8) }).select("id").single();
  if (error) throw error;
  resumeId = data.id;
  session.pageFitResumeId = resumeId;
  await writeFile(path, JSON.stringify(session, null, 2), { mode: 0o600 });
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  async function show(count) {
    const { error } = await client.from("resumes").update({ content: content(count) }).eq("id", resumeId).eq("user_id", account.id);
    if (error) throw error;
    await page.goto(`http://localhost:3000/resumes/${resumeId}`, { waitUntil: "networkidle" });
    await page.locator(".rb-paper").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const badge = page.locator("p.text-2xl").filter({ hasText: /^~[\d.]+%$/ });
    await badge.waitFor();
    const label = await badge.innerText();
    return { percent: Number(label.match(/[\d.]+/)[0]), className: await badge.getAttribute("class") };
  }
  const low = await show(8);
  assert.ok(low.percent < 90);
  assert.match(low.className, /amber/);
  await page.screenshot({ path: "/tmp/resume-butler-fit-low.png" });
  let best;
  let lowCount = 8, highCount = 65;
  for (let i = 0; i < 7; i++) {
    const count = Math.floor((lowCount + highCount) / 2);
    const result = await show(count);
    if (result.percent >= 90 && result.percent <= 100) { best = { count, ...result }; break; }
    if (result.percent < 90) lowCount = count + 1;
    else highCount = count - 1;
  }
  assert.ok(best, "must find a near-full fixture");
  assert.match(best.className, /text-brand/);
  await page.getByText("Good page usage", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/resume-butler-fit-target.png" });
  await page.getByRole("button", { name: "Check with the PDF", exact: true }).click();
  await page.getByText("Fits on one page", { exact: true }).waitFor({ timeout: 60000 });
  await page.getByText("1 page", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/resume-butler-fit-pdf.png" });
  assert.deepEqual(errors, []);
  const report = { low, target: best, actualPdfPages: 1, pageErrors: errors, resumeId };
  await writeFile("/tmp/resume-butler-fit-qa-result.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
