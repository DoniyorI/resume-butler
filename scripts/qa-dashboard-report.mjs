// Signed-in browser check of the dashboard's descriptive figures and the Search report:
//   response rate "x of N", offer rate, median days to first response, the Application flow
//   (Reached Out is not "Awaiting response"), the follow-up card, the four report tables for chosen
//   groups, "too few to compare", the month link, 375px overflow, a second user's empty report,
//   the dashboard's shape (no charts, report or collapsible sections; an Insights card; stat cards link
//   to /insights; "Show N more" in Today) and /insights (?tab=activity|flow|report, invalid tab falls back).
// Creates disposable @example.test users and deletes everything it created in `finally`.
// Never prints the password, keys or tokens.
//
// NODE_PATH=/opt/homebrew/lib/node_modules node --use-system-ca --import ./tests/register.mjs scripts/qa-dashboard-report.mjs [screenshotDir]
// (QA_PLAYWRIGHT_MODULE=/opt/homebrew/lib/node_modules/playwright also works.)
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
const email = `sync-qa-${run}-report@example.test`;
const otherEmail = `sync-qa-${run}-report-other@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const MISSING = ["42P01", "PGRST205", "PGRST200", "PGRST204"];
const pad = n => String(n).padStart(2, "0");
// Local calendar date `offset` days from today (the app reads applied_date as a local date)
const dateOf = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return d; };
const dayKey = offset => { const d = dateOf(offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// 06:00 local, `after` days after the applied date: a whole number of days once rounded
const replyAt = (offset, after) => { const d = dateOf(offset + after); d.setHours(6, 0, 0, 0); return d.toISOString(); };

const RESUME_A = `Report A ${run}`, RESUME_B = `Report B ${run}`;
// offset: days ago the application was made (negative); history: [status, days after applying]
const SEED = [
  { n: 1, offset: -60, status: "Offered", source: "manual", resume: "A", workplace: "remote", history: [["Applied", 0], ["Reached Out", 5], ["Interviewed", 12], ["Offered", 30]] },
  { n: 2, offset: -55, status: "Rejected", source: "manual", resume: "A", workplace: "remote", history: [["Applied", 0], ["Interviewed", 8], ["Rejected", 20]] },
  { n: 3, offset: -50, status: "Rejected", source: "manual", resume: "A", workplace: "remote", history: [["Applied", 0], ["Rejected", 9]] },
  { n: 4, offset: -45, status: "Applied", source: "manual", resume: "A", workplace: "onsite", history: [["Applied", 0]] },
  { n: 5, offset: -40, status: "Reached Out", source: "manual", resume: "A", workplace: null, history: [["Applied", 0], ["Reached Out", 3]] },
  { n: 6, offset: -35, status: "Interviewed", source: "extension", site: "greenhouse", resume: "B", workplace: "hybrid", history: [["Applied", 0], ["Interviewed", 10]] },
  { n: 7, offset: -30, status: "Applied", source: "extension", site: "lever", resume: "B", workplace: "remote", history: [["Applied", 0]] },
  { n: 8, offset: -28, status: "Rejected", source: "email", resume: null, workplace: null, history: [["Applied", 0], ["Rejected", 6]] },
  { n: 9, offset: -25, status: "Applied", source: "email", resume: null, workplace: null, history: [["Applied", 0]] },
  { n: 10, offset: -22, status: "Withdrew", source: "extension", site: "greenhouse", resume: "B", workplace: "hybrid", history: [["Applied", 0], ["Reached Out", 7], ["Withdrew", 15]] },
  // Applied inside the last 14 days: shown in the totals, left out of every rate and the report
  { n: 11, offset: -5, status: "Applied", source: "manual", resume: "A", workplace: "remote", history: [["Applied", 0]] },
  { n: 12, offset: -2, status: "Applied", source: "extension", resume: "B", workplace: "remote", history: [["Applied", 0]] },
];
const ELIGIBLE = SEED.filter(s => s.offset <= -20);
// What the seed implies, worked out here and not by the app's code
const everAny = (s, list) => s.history.some(([status]) => list.includes(status));
const stat = list => ({
  apps: list.length,
  responses: list.filter(s => everAny(s, ["Reached Out", "Interviewed", "Offered"])).length,
  interviews: list.filter(s => everAny(s, ["Interviewed", "Offered"])).length,
  offers: list.filter(s => everAny(s, ["Offered"])).length,
});
const replyDays = ELIGIBLE.map(s => s.history.find(([status]) => ["Reached Out", "Interviewed", "Offered"].includes(status))?.[1]).filter(d => d !== undefined).sort((a, b) => a - b);
const median = replyDays.length % 2 ? replyDays[(replyDays.length - 1) / 2] : (replyDays[replyDays.length / 2 - 1] + replyDays[replyDays.length / 2]) / 2;
const total = stat(ELIGIBLE);
const cell = ({ apps, responses, interviews, offers }) => [String(apps), String(responses), apps < 5 ? "too few to compare" : `${Math.round((responses / apps) * 100)}% (${responses} of ${apps})`, String(interviews), String(offers)];
const monthLabel = s => dateOf(s.offset).toLocaleDateString("en-US", { month: "short", year: "numeric" });

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
  const created = check(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "Report QA", last_name: run, sync_qa_run: run } }));
  const userId = created.user.id;
  createdUsers.push(userId);
  const resumes = {};
  for (const [key, title] of [["A", RESUME_A], ["B", RESUME_B]]) resumes[key] = check(await admin.from("resumes").insert({ user_id: userId, title }).select("id").single()).id;
  for (const s of SEED) {
    const row = check(await admin.from("applications").insert({
      user_id: userId, company: `Report Co ${s.n}`, role: "Engineer", status: s.status, applied_date: dayKey(s.offset), source: s.source,
      source_site: s.site || null, workplace_type: s.workplace, resume_id: s.resume ? resumes[s.resume] : null,
    }).select("id").single());
    // The insert trigger logged one row at "now"; replace it with the dated history
    check(await admin.from("application_status_history").delete().eq("application_id", row.id).select("id"));
    check(await admin.from("application_status_history").insert(s.history.map(([status, after]) => ({ application_id: row.id, status, changed_at: replyAt(s.offset, after) }))).select("id"));
  }

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => pageErrors.push(`${error.message} @ ${new URL(page.url()).pathname}`));
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
  const tableRow = async (id, label, p = page) => {
    const tr = p.locator(`section[data-report-table="${id}"] tr[data-group="${label}"]`);
    await tr.waitFor();
    return (await tr.locator("td").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim());
  };

  await step("0-login", [], async () => { await login(page, email); await page.goto(`${base}/`, { waitUntil: "networkidle" }); });

  const inDom = (p, sel) => p.locator(sel).count();
  const insights = (p, tab) => p.goto(`${base}/insights${tab ? `?tab=${tab}` : ""}`, { waitUntil: "networkidle" });

  await step("0a-dashboard-shape", ["0-login"], async () => {
    const body = await flat(page.locator("main, body").first());
    assert.equal(await inDom(page, "section[aria-label][id] button[aria-expanded], [id$=\"-panel\"][hidden]"), 0, "no collapsible sections");
    assert.equal(await inDom(page, "#search-report"), 0, "no report");
    assert.equal(await inDom(page, "section[data-report-table]"), 0, "no report tables");
    assert.equal(await inDom(page, "svg.recharts-surface"), 0, "no chart");
    assert.ok(!body.includes("Where your applications are now"), "Pipeline absent");
    assert.ok(!/Status breakdown/i.test(body), "Status breakdown is gone");
    assert.ok(body.includes("Recent applications") && /View all \(\d+\)/.test(body), "Recent applications card with View all (N)");
    assert.ok(await page.locator("tbody tr").count() <= 6, "at most 6 recent rows");
    // The Insights card: three rows, each a link to its tab, with a summary
    const card = page.getByText("Charts and a report of your own records").locator("xpath=ancestor::div[contains(@class,'border')][1]");
    const text = await flat(card);
    assert.ok(/\d+ applications? in the last 30 days/.test(text), text);
    assert.ok(text.includes(`How ${SEED.length} applications moved`), text);
    assert.ok(text.includes("Outcomes by source, resume and more"), text);
    for (const tab of ["activity", "flow", "report"]) assert.equal(await card.locator(`a[href="/insights?tab=${tab}"]`).count(), 1, `Insights card links to ${tab}`);
    await shot(page, "dashboard-desktop.png");
  });

  await step("0b-insights-links", ["0a-dashboard-shape"], async () => {
    for (const [label, tab] of [["Search report", "report"], ["Application flow", "flow"], ["Activity", "activity"]]) {
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      await page.locator(`a[href="/insights?tab=${tab}"]`).filter({ hasText: label }).first().click();
      await page.waitForURL(`**/insights?tab=${tab}`);
      assert.equal(await page.locator('[role="tablist"]').first().locator('[data-state="active"]').innerText(), label, `${tab} tab is active`);
    }
    // Stat cards are links too
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.locator('a[href="/insights?tab=report"]').filter({ hasText: "Response rate" }).click();
    await page.waitForURL("**/insights?tab=report");
    await page.locator("#search-report").waitFor();
  });

  await step("0c-tabs", ["0a-dashboard-shape"], async () => {
    // Activity is the default and an invalid tab falls back to it; the Pipeline renders, nothing else does
    for (const url of [null, "activity", "nonsense"]) {
      await insights(page, url);
      assert.equal(await page.locator('[role="tablist"]').first().locator('[data-state="active"]').innerText(), "Activity", `${url} -> Activity`);
      await page.getByText("Where your applications are now (current status)").waitFor();
      assert.equal(await inDom(page, "#search-report"), 0, "report not rendered on Activity");
    }
    const body = await flat(page.locator("main, body").first());
    assert.ok(body.includes("Counts and charts from your own records. Descriptive only."), "subtitle");
    assert.equal(await page.locator('a[href="/"]').filter({ hasText: "Dashboard" }).count() > 0, true, "back link");
    await shot(page, "insights-activity-desktop.png");
    // Flow
    await insights(page, "flow");
    await page.waitForFunction(() => [...document.querySelectorAll("svg text")].some(t => /Awaiting response/.test(t.textContent)));
    assert.equal(await inDom(page, "#search-report"), 0, "report not rendered on Flow");
    // Clicking a tab changes the URL, and Back returns to the previous tab
    await page.getByRole("tab", { name: "Search report" }).click();
    await page.waitForURL("**/insights?tab=report");
    await page.locator("#search-report").waitFor();
    await page.goBack();
    await page.waitForURL("**/insights?tab=flow");
    assert.equal(await page.locator('[role="tablist"]').first().locator('[data-state="active"]').innerText(), "Application flow", "Back returns to Flow");
  });

  await step("0d-today-show-more", ["0-login"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const items = page.locator('section[aria-label="Suggested next steps"] li');
    await items.first().waitFor();
    assert.equal(await items.count(), 4, "four suggestions by default");
    const more = page.getByRole("button", { name: /^Show \d+ more$/ });
    const n = Number((await more.innerText()).replace(/\D+/g, ""));
    assert.ok(n > 0);
    await more.click();
    assert.equal(await items.count(), 4 + n, `Show ${n} more reveals them`);
    await page.getByRole("button", { name: "Show fewer" }).click();
    assert.equal(await items.count(), 4, "Show fewer returns to four");
  });

  await step("1-cards", ["0-login"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const cards = await flat(page.locator("div.grid.grid-cols-2").first());
    observed.cards = cards;
    const pct = n => Math.round((n / total.apps) * 100);
    assert.ok(cards.includes(`Total applications ${SEED.length}`), cards);
    assert.ok(cards.includes(`Response rate ${pct(total.responses)}% ${total.responses} of ${total.apps} applied 14+ days ago heard back`), `response rate (${cards})`);
    assert.ok(cards.includes(`Offer rate ${pct(total.offers)}% ${total.offers} of ${total.apps} applied 14+ days ago reached an offer`), `offer rate (${cards})`);
    assert.ok(cards.includes(`Median days to first response ${median} days From ${replyDays.length} responses`), `median (${cards}; expected ${median} from ${replyDays})`);
    assert.ok(!/Avg\. response time/.test(cards));
  });

  await step("2-copy", ["0a-dashboard-shape"], async () => {
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const body = await flat(page.locator("main, body").first());
    assert.ok(!body.includes("A short follow-up email often gets a response"), "unsupported follow-up claim is gone");
    assert.ok(body.includes("Still at Applied after 14 days."), "factual follow-up line stays");
    const waiting = SEED.filter(s => s.status === "Applied" && s.offset <= -14).length;
    assert.ok(body.includes(`Waiting on a reply ${waiting}`), `waiting count ${waiting}`);
    await insights(page, "activity");
    await page.getByText("Where your applications are now (current status)").waitFor();
  });

  await step("3-flow", ["0c-tabs"], async () => {
    await insights(page, "flow");
    const applied = SEED.filter(s => s.status === "Applied").length, reached = SEED.filter(s => s.status === "Reached Out").length;
    await page.waitForFunction(() => [...document.querySelectorAll("svg text")].some(t => /Awaiting response/.test(t.textContent)));
    const labels = await page.evaluate(() => [...document.querySelectorAll("svg text")].map(t => t.textContent));
    observed.flowLabels = labels.filter(t => /Awaiting|reached out|Still|Rejected/.test(t));
    const num = re => Number((labels.find(t => re.test(t)) || "").replace(/\D+/g, ""));
    assert.equal(num(/^Awaiting response/), applied, `Awaiting response counts only applications at Applied (${applied})`);
    assert.equal(num(/^Employer reached out/), reached, `Reached Out has its own node (${reached})`);
    await shot(page, "insights-flow-desktop.png");
  });

  await step("4-report-source", ["0c-tabs"], async () => {
    await insights(page, "report");
    await page.locator("#search-report").waitFor();
    const note = await flat(page.locator("#search-report"));
    assert.ok(note.includes(`for the ${ELIGIBLE.length} of ${SEED.length} applications applied 14 or more days ago`), note.slice(0, 300));
    assert.ok(note.includes("too few to compare") && note.includes("describes your search only"));
    assert.deepEqual(await tableRow("report-source", "Added manually"), cell(stat(ELIGIBLE.filter(s => s.source === "manual"))));
    assert.deepEqual(await tableRow("report-source", "Browser extension"), cell(stat(ELIGIBLE.filter(s => s.source === "extension"))));
    assert.deepEqual(await tableRow("report-source", "From email"), cell(stat(ELIGIBLE.filter(s => s.source === "email"))));
    assert.deepEqual(await tableRow("report-site", "Greenhouse"), cell(stat(ELIGIBLE.filter(s => s.site === "greenhouse"))));
    const manual = await tableRow("report-source", "Added manually");
    assert.equal(manual[2], "60% (3 of 5)", "five applications get a percentage with its numerator and denominator");
    assert.equal((await tableRow("report-source", "From email"))[2], "too few to compare", "a small group has no percentage");
  });

  await step("5-report-resume-workplace", ["0c-tabs"], async () => {
    await page.locator("#search-report").waitFor();
    assert.deepEqual(await tableRow("report-resume", RESUME_A), cell(stat(ELIGIBLE.filter(s => s.resume === "A"))));
    assert.deepEqual(await tableRow("report-resume", RESUME_B), cell(stat(ELIGIBLE.filter(s => s.resume === "B"))));
    assert.deepEqual(await tableRow("report-resume", "No resume linked"), cell(stat(ELIGIBLE.filter(s => !s.resume))));
    assert.deepEqual(await tableRow("report-workplace", "Remote"), cell(stat(ELIGIBLE.filter(s => s.workplace === "remote"))));
    assert.deepEqual(await tableRow("report-workplace", "Not recorded"), cell(stat(ELIGIBLE.filter(s => !s.workplace))));
    assert.deepEqual(await tableRow("report-workplace", "Hybrid"), cell(stat(ELIGIBLE.filter(s => s.workplace === "hybrid"))));
  });

  await step("6-report-month", ["0c-tabs"], async () => {
    await page.locator("#search-report").waitFor();
    const months = [...new Set(ELIGIBLE.map(monthLabel))];
    let sum = 0;
    for (const label of months) {
      const list = ELIGIBLE.filter(s => monthLabel(s) === label);
      const cells = await tableRow("report-month", label);
      assert.deepEqual(cells, cell(stat(list)), `month ${label}`);
      sum += Number(cells[0]);
    }
    assert.equal(sum, ELIGIBLE.length, "the month rows add up to the included applications");
    const first = months[0];
    const link = page.locator(`section[data-report-table="report-month"] tr[data-group="${first}"] td a`).first();
    const href = await link.getAttribute("href");
    observed.monthHref = href;
    assert.ok(/^\/applications\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}$/.test(href), href);
    await shot(page, "insights-report-desktop.png");
  });

  await step("7-mobile-375", ["0-login"], async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    try {
      const measure = () => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      const w = await measure();
      observed.mobile = w;
      assert.ok(w.scroll <= w.inner + 1, `dashboard horizontal overflow (${w.scroll} > ${w.inner})`);
      observed.mobileOrder = await page.evaluate(() => {
        const titles = ["Today", "Waiting on a reply", "Recent applications", "Goal", "Inbox", "Insights"];
        const found = titles.map(t => { const h = [...document.querySelectorAll("h3, h2")].find(h => h.textContent.trim().startsWith(t)); return h ? [t, Math.round(h.getBoundingClientRect().top + scrollY)] : [t, null]; });
        return found.filter(([, y]) => y !== null).sort((a, b) => a[1] - b[1]).map(([t]) => t);
      });
      await shot(page, "dashboard-mobile.png");
      for (const tab of ["activity", "flow", "report"]) {
        await insights(page, tab);
        if (tab === "report") await page.locator("#search-report").waitFor();
        if (tab === "activity") await page.getByText("Where your applications are now (current status)").waitFor();
        const m = await measure();
        observed[`mobile-${tab}`] = m;
        assert.ok(m.scroll <= m.inner + 1, `insights ${tab} horizontal overflow (${m.scroll} > ${m.inner})`);
        if (tab === "report") await shot(page, "insights-mobile.png");
      }
    } finally { await page.setViewportSize({ width: 1280, height: 1000 }); }
  });

  await step("8-second-user", ["0-login"], async () => {
    const other = check(await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true, user_metadata: { sync_qa_run: run } }));
    createdUsers.push(other.user.id);
    check(await admin.from("applications").insert({ user_id: other.user.id, company: "Other Co", role: "Engineer", status: "Applied", applied_date: dayKey(-1), source: "manual" }).select("id"));
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const second = await context.newPage();
    second.setDefaultTimeout(30000);
    second.on("pageerror", error => pageErrors.push(`second user: ${error.message}`));
    try {
      await login(second, otherEmail);
      await second.goto(`${base}/`, { waitUntil: "networkidle" });
      const cards = await flat(second.locator("div.grid.grid-cols-2").first());
      assert.ok(cards.includes("Response rate Not enough history yet"), `no 0% without history (${cards})`);
      assert.ok(!/Response rate 0%/.test(cards));
      await second.goto(`${base}/insights?tab=report`, { waitUntil: "networkidle" });
      await second.locator("#search-report").waitFor();
      const report = await flat(second.locator("#search-report"));
      assert.ok(report.includes("Not enough history yet"), report);
      assert.ok(!report.includes(RESUME_A) && !report.includes("Browser extension"));
    } finally { await context.close(); }
  });

  steps["9-no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.length} page errors: ${pageErrors.slice(0, 3).join(" | ")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  const left = {};
  try {
    for (const userId of createdUsers) {
      const tables = ["application_activities", "application_suggestions", "applications", "resumes"];
      for (const table of tables) {
        const { error } = await admin.from(table).delete().eq("user_id", userId);
        if (error && !MISSING.includes(error.code)) throw new Error(`${table}: ${error.message}`);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      for (const table of ["applications", "resumes"]) {
        const { count, error: countError } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (!countError && count) left[table] = (left[table] || 0) + count;
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
