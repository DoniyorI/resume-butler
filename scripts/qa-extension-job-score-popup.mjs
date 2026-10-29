import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
if (!process.env.PLAYWRIGHT_MODULE) throw new Error("Set PLAYWRIGHT_MODULE.");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await context.newPage(), errors = [], requests = [];
page.on("pageerror", error => errors.push(error.message));
const resumeId = "00000000-0000-4000-8000-000000000010";
let release, mode = "success";
await page.exposeFunction("qaMessage", async message => {
  if (message.type === "status") return { connection: { userId: "A", origin: "https://resume-butler.vercel.app" }, recent: [] };
  if (message.type === "capture-context") return { resumes: [{ id: resumeId, title: "Backend resume" }] };
  if (message.type === "job-score") {
    requests.push(message);
    if (mode === "delay") await new Promise(resolve => { release = resolve; });
    if (mode === "error") return { ok: false, error: "This resume is no longer available. Choose another resume." };
    return { score: mode === "unknown" ? null : 67, totalKeywords: mode === "unknown" ? 0 : 3,
      matched: mode === "unknown" ? [] : ["python", "backend"], missing: mode === "unknown" ? [] : ["docker"],
      source: { type: message.resumeId ? "resume" : "master-cv", id: message.resumeId, title: message.resumeId ? "Backend resume" : "Master CV" } };
  }
  return { ok: true };
});
await page.addInitScript(resumeId => {
  const url = "https://www.linkedin.com/jobs/view/4484740117/";
  window.chrome = {
    runtime: { sendMessage: (message, cb) => window.qaMessage(message).then(cb), lastError: null },
    tabs: { query: async () => [{ id: 7, url }], sendMessage: (_id, _message, cb) => cb({ site: "linkedin", jobId: "4484740117", company: "Fixture Company", role: "Staff Backend Engineer", location: "Remote", workplaceType: "remote", employmentType: "Full-time", salary: { min: 200000, max: 230000, currency: "USD", period: "year" }, url, description: "Build backend APIs with Python, Docker and distributed services." }) },
    management: { getSelf: cb => cb({ installType: "development" }) },
  };
}, resumeId);
await context.route("**/*", async route => {
  const path = new URL(route.request().url()).pathname;
  if (!/^\/popup\/[a-z.-]+$/.test(path) && path !== "/icons/icon-32.png") return route.abort();
  const body = await readFile(new URL(`../extension${path}`, import.meta.url));
  return route.fulfill({ body, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".png") ? "image/png" : "text/html" });
});
let checks = 0;
const check = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
try {
  await page.goto("https://popup.example.test/popup/popup.html");
  await page.locator("#resume-choice option").nth(1).waitFor({ state: "attached" });
  const compare = page.getByRole("button", { name: "Compare with job", exact: true });
  check(await compare.count(), 1);
  check(requests.length, 0, "no background comparisons on load");
  check(await page.locator("#job-facts").innerText(), "$200K–$230K / year · Full-time");
  await compare.click(); await page.locator("#job-score-result").waitFor({ state: "visible" });
  check(await page.locator("#job-score-value").innerText(), "67%");
  check(await page.locator("#job-score-source").innerText(), "Master CV");
  await page.getByText("Matched and missing terms", { exact: true }).click();
  check(await page.locator("#job-score-missing").innerText(), "docker");
  check(requests.at(-1).resumeId, null);
  check(requests.at(-1).tab, { id: 7, url: "https://www.linkedin.com/jobs/view/4484740117/" });
  await page.selectOption("#resume-choice", resumeId);
  check(await page.locator("#job-score-result").isHidden(), true);
  await compare.click(); await page.locator("#job-score-result").waitFor({ state: "visible" });
  check(await page.locator("#job-score-source").innerText(), "Backend resume");
  check(requests.at(-1).resumeId, resumeId);
  mode = "delay"; await compare.click();
  await page.waitForFunction(() => document.querySelector("#job-score-compare").disabled);
  await page.selectOption("#resume-choice", "");
  release(); await page.waitForTimeout(100);
  check(await page.locator("#job-score-result").isHidden(), true, "late responses cannot restore a stale result");
  mode = "unknown"; await compare.click();
  await page.getByText("No recognized job terms. A score would be misleading.", { exact: true }).waitFor();
  check(await page.locator("#job-score-result").isHidden(), true);
  mode = "error"; await compare.click();
  await page.getByText("This resume is no longer available. Choose another resume.", { exact: true }).waitFor();
  check(await page.locator("#save-job").isEnabled(), true);
  mode = "success"; await compare.click(); await page.locator("#job-score-result").waitFor({ state: "visible" });
  await page.screenshot({ path: "/tmp/resume-butler-extension-job-score.png", fullPage: true });
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    check(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  }
  await page.locator("summary").filter({ hasText: "Review captured details" }).click();
  await page.locator("#capture-description").fill("Too short");
  check(await page.locator("#job-score-result").isHidden(), true);
  await compare.click();
  await page.getByText("Open or paste the full job description before comparing.", { exact: true }).waitFor();
  check(errors, []);
  console.log(JSON.stringify({ checks, pageErrors: errors.length }));
} finally { await browser.close(); }
