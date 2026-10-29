// User-supplied LinkedIn structure, fictional employer; all network intercepted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
if (!process.env.PLAYWRIGHT_MODULE) throw new Error("Set PLAYWRIGHT_MODULE.");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage(), errors = [];
page.on("pageerror", error => errors.push(error.message));
const fixture = await readFile(new URL("../tests/fixtures/linkedin-job.html", import.meta.url), "utf8");
await context.route("**/*", route => route.fulfill({ contentType: "text/html", body: fixture }));
const sites = await readFile(new URL("../extension/content/sites.js", import.meta.url), "utf8");
const reader = await readFile(new URL("../extension/content/job-reader.js", import.meta.url), "utf8");
const read = () => page.evaluate(() => RB_readJob(RB_SITES.find(site => site.id === "linkedin")));
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
async function reset(url = "https://www.linkedin.com/jobs/view/4484740117/") {
  await page.goto(url); await page.addScriptTag({ content: sites }); await page.addScriptTag({ content: reader });
}
try {
  for (const search of [false, true]) {
    await reset(search ? "https://www.linkedin.com/jobs/search-results/?currentJobId=4484740117" : undefined);
    if (search) await page.evaluate(() => {
      document.title = "Software Engineer jobs | LinkedIn";
      for (const a of document.querySelectorAll('a[href*="4484740117"]')) a.href = "/jobs/search-results/?currentJobId=4484740117&trackingId=fixture";
      for (const el of document.querySelectorAll("[class]")) el.className = "new-generated-class";
      document.querySelector("h1").innerHTML = '<a href="/jobs/view/4484740117/">Staff Backend Engineer</a>';
      const company = document.createElement("a"); company.href = "/company/fixture-company/"; company.textContent = "Fixture Company";
      document.querySelector("h1").after(company);
    });
    const job = await read();
    check(job?.salary, { min: 200000, max: 230000, currency: "USD", period: "year" }, "metadata salary wins over description");
    check(job.location, "Remote"); check(job.workplaceType, "remote"); check(job.employmentType, "Full-time");
    check(job.role, "Staff Backend Engineer"); check(job.company, "Fixture Company");
    check(job.description.includes("Python, REST/GraphQL APIs and GCP."), true);
    check(job.description.includes("$190k-$230k base + equity."), true);
    check(job.description.includes("more"), false); check(job.description.includes("What's on offer\n"), true);
    check(job.url, "https://www.linkedin.com/jobs/view/4484740117/");
  }
  await reset();
  await page.evaluate(() => { document.querySelectorAll('a[href*="4484740117"]').forEach(a => a.href = "/jobs/view/7777777777/"); });
  check(await read(), null, "stale detail panels must not be attributed to the current job");
  await reset("https://www.linkedin.com/jobs/search-results/?currentJobId=7777777777");
  check(await read(), null, "a URL switch must not re-key the old panel");
  await page.evaluate(() => { document.querySelector("h1").innerHTML = '<a href="/jobs/view/7777777777/">New Job B</a>'; });
  check(await read(), null, "a new title must not authorize the old description");
  await reset();
  await page.evaluate(() => { document.querySelector('[data-testid="expandable-text-box"]').insertAdjacentHTML("beforeend", '<script type="text/plain">SECRET SCRIPT</script><style>.SECRET_STYLE{}</style><span hidden>HIDDEN_TEXT</span>'); });
  check(/SECRET|HIDDEN_TEXT/.test((await read()).description), false);
  await reset();
  await page.evaluate(() => document.querySelector("h2").textContent = "About this company");
  check((await read()).description, "", "unrelated expandable text is not a description");
  await reset();
  await page.evaluate(() => { document.querySelector('a[href*="4484740117"]').textContent = "$55/hr - $75/hr"; });
  check((await read()).salary, { min: 55, max: 75, currency: "USD", period: "hour" });
  await reset();
  await page.evaluate(() => { document.querySelector('a[href*="4484740117"]').hidden = true; });
  check((await read()).salary, null, "hidden metadata is ignored");
  await reset();
  await page.evaluate(() => {
    const script = document.createElement("script"); script.type = "application/ld+json";
    script.textContent = JSON.stringify({ "@type": ["JobPosting"], url: "https://www.linkedin.com/jobs/view/9999999999/", title: "Wrong job", hiringOrganization: { name: "Wrong Company" }, description: "Wrong description" });
    document.head.append(script);
  });
  check((await read()).role, "Staff Backend Engineer", "another job's JSON-LD is ignored");
  check((await read()).description.includes("Wrong description"), false);
  await reset();
  await page.evaluate(() => {
    document.querySelectorAll('a[href*="4484740117"]').forEach(a => a.remove());
    const box = document.querySelector('[data-testid="expandable-text-box"]');
    box.removeAttribute("data-testid"); box.className = "jobs-description__content";
    const script = document.createElement("script"); script.type = "application/ld+json";
    script.textContent = JSON.stringify({ "@type": "JobPosting", url: location.href, title: "Legacy Backend Engineer", hiringOrganization: { name: "Legacy Company" }, description: "<p>Legacy Python and Docker description.</p>" });
    document.head.append(script);
  });
  check((await read())?.role, "Legacy Backend Engineer", "independently identified legacy layouts remain supported");
  check((await read())?.description, "Legacy Python and Docker description.");
  await reset();
  await page.evaluate(() => {
    window.__seen = []; window.__submitted = []; window.__jobs = {};
    window.RB_showResult = () => {};
    window.chrome = { runtime: { id: "fixture", onMessage: { addListener() {} }, sendMessage(message, callback) {
      if (message.type === "job-seen") { window.__seen.push(message); window.__jobs[message.key] = message.job; }
      if (message.type === "submitted") window.__submitted.push(message);
      callback(message.type === "job-lookup" ? window.__jobs[message.key] : {});
    } } };
  });
  await page.addScriptTag({ content: await readFile(new URL("../extension/content/detector.js", import.meta.url), "utf8") });
  await page.waitForFunction(() => window.__seen.length === 1);
  await page.evaluate(() => {
    history.replaceState(null, "", "/jobs/search-results/?currentJobId=7777777777");
    document.querySelector("h1").innerHTML = '<a href="/jobs/view/7777777777/">New Job B</a>';
  });
  await page.waitForTimeout(1700);
  check(await page.evaluate(() => window.__seen.some(message => message.job.jobId === "7777777777")), false);
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('a[href*="4484740117"]')) a.href = "/jobs/view/7777777777/";
    const company = document.createElement("a"); company.href = "/company/fixture-company/"; company.textContent = "Fixture Company"; document.querySelector("h1").after(company);
    document.querySelector('[data-testid="expandable-text-box"]').innerHTML = "<p>New B description with Python backend services.</p>";
  });
  await page.waitForFunction(() => window.__seen.some(message => message.job.jobId === "7777777777"));
  check(await page.evaluate(() => window.__seen.at(-1).job.description), "New B description with Python backend services.");
  await page.evaluate(() => { history.replaceState(null, "", "/jobs/view/7777777777/post-apply/"); document.body.textContent = "Application sent"; });
  await page.waitForFunction(() => window.__submitted.length === 1);
  check(await page.evaluate(() => window.__submitted[0].job.description), "New B description with Python backend services.");
  check(await page.evaluate(() => window.__seen.length), 2, "confirmation must not overwrite the posting cache");
  check(errors, []);
  console.log(JSON.stringify({ checks, pageErrors: errors.length, employerRequests: 0 }));
} finally { await browser.close(); }
