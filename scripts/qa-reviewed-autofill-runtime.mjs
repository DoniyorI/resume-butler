// Real unpacked extension, toolbar popup, service worker and isolated content
// scripts. Both the employer page and gateway responses are intercepted fixtures.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";

if (!process.env.PLAYWRIGHT_MODULE || !process.env.QA_CHROME_EXECUTABLE) throw new Error("Set PLAYWRIGHT_MODULE and QA_CHROME_EXECUTABLE to installed official browser tooling.");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const profile = await mkdtemp("/tmp/resume-butler-a6-runtime-");
const extension = fileURLToPath(new URL("../extension/", import.meta.url));
const html = await readFile(new URL("../tests/fixtures/lever-application.html", import.meta.url), "utf8");
const greenhouseHtml = await readFile(new URL("../tests/fixtures/greenhouse-application.html", import.meta.url), "utf8");
const ashbyHtml = await readFile(new URL("../tests/fixtures/ashby-application.html", import.meta.url), "utf8");
const jobUrl = "https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply";
const greenhouseUrl = "https://job-boards.greenhouse.io/examplelabs/jobs/4000001";
const ashbyUrl = "https://jobs.ashbyhq.com/examplelabs/7458d4e9-da2e-47bd-98cb-adfda43d42b2/application";
const answer = { id: "00000000-0000-4000-8000-000000000010", revision: 3, label: "QA project", question: "Describe a project.", answer: "I built an API.\nMeasured 25% improvement." };
const facts = { name: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", phone: "", linkedin: "", github: "", portfolio: "" };
const gateway = { facts, profileFingerprint: "a".repeat(64), choices: [{ id: answer.id, revision: answer.revision, label: answer.label, question: answer.question }] };
let context, root, sessionId, nextId = 0, sourceReads = 0, checks = 0;
const pending = new Map(), outgoing = [];
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
try {
  context = await chromium.launchPersistentContext(profile, { executablePath: process.env.QA_CHROME_EXECUTABLE, headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === "https://jobs.lever.co" && request.method() === "GET") return route.fulfill({ contentType: "text/html", body: html });
    if (url.origin === "https://job-boards.greenhouse.io" && request.method() === "GET" && request.isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: greenhouseHtml });
    if (url.origin === "https://jobs.ashbyhq.com" && request.method() === "GET" && request.isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: ashbyHtml });
    if (url.origin === "http://localhost:3000" && url.pathname.startsWith("/api/extension/")) {
      let body;
      if (url.pathname.endsWith("/autofill")) {
        sourceReads++;
        body = request.method() === "POST" ? { facts, profileFingerprint: gateway.profileFingerprint, answers: JSON.parse(request.postData() || "{}").answerSelections.map(() => answer) } : gateway;
      } else if (url.pathname.endsWith("/me")) body = { userId: "fixture-owner", email: "qa@example.test" };
      else if (url.pathname.endsWith("/opportunities")) body = { resumes: [], opportunity: null };
      else return route.abort();
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(body), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
    }
    if (url.origin === "https://jobs.lever.co" || url.origin === "https://job-boards.greenhouse.io" || url.origin === "https://jobs.ashbyhq.com") outgoing.push(request.method());
    return route.abort();
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  await worker.evaluate(async () => chrome.storage.local.set({ connection: { userId: "fixture-owner", origin: "http://localhost:3000", token: "rbx_fictional_fixture_token", email: "qa@example.test", name: "QA" } }));
  const job = await context.newPage(); await job.goto(jobUrl);
  await job.locator('[name="email"]').fill("manually-entered@example.test");

  // This toolbar popup is absent from Playwright's page list. Locate its
  // actual target through the public CDP transport rather than using a fake tab.
  async function attachPopup() {
    await worker.evaluate(() => chrome.action.openPopup());
    const popupContext = (await worker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ["POPUP"] })))[0];
    check(Boolean(popupContext), true, "a real toolbar popup must exist");
    root ||= await context.browser().newBrowserCDPSession();
    const targets = await root.send("Target.getTargets");
    const target = targets.targetInfos.find(item => item.url === popupContext.documentUrl);
    if (!target) console.log(JSON.stringify({ popupDocument: popupContext.documentUrl, extensionTargets: targets.targetInfos.filter(item => item.url.startsWith("chrome-extension://")).map(item => ({ type: item.type, url: item.url })) }));
    assert.ok(target, "real popup target");
    ({ sessionId } = await root.send("Target.attachToTarget", { targetId: target.targetId, flatten: false }));
  }
  await attachPopup();
  root.on("Target.receivedMessageFromTarget", event => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message), task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id); clearTimeout(task.timer);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  });
  async function evaluate(expression) {
    const id = ++nextId;
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Popup inspection timed out.")); }, 10000);
      pending.set(id, { resolve, reject, timer });
      root.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }) }).catch(reject);
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result?.value;
  }
  async function waitFor(expression) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("Popup condition was not met: " + await evaluate("document.getElementById('autofill-status')?.textContent"));
  }
  await waitFor("!document.getElementById('autofill').hidden");
  await evaluate("document.getElementById('autofill-review').click()");
  await waitFor("!document.getElementById('autofill-body').hidden && !document.getElementById('autofill-apply').disabled");
  check(await evaluate("document.getElementById('autofill-fields').textContent.includes('Ada Lovelace')"), true);
  check(await evaluate("document.getElementById('autofill-fields').textContent.includes('Measured 25% improvement.')"), true);
  await evaluate("document.getElementById('autofill-apply').click()");
  await waitFor("document.getElementById('autofill-status').textContent.includes('2 filled')");
  check(await job.locator('[name="name"]').inputValue(), "Ada Lovelace");
  check(await job.locator('[name="email"]').inputValue(), "manually-entered@example.test");
  check(await job.locator("textarea").first().inputValue(), answer.answer);
  check(await job.locator('[name="eeo[disabilitySignature]"]').inputValue(), "");
  check(await job.locator('#location-input').inputValue(), "");
  check(await job.locator('input[type="file"]').evaluate(element => element.files.length), 0);
  check(await job.locator('input[type="checkbox"]:checked,input[type="radio"]:checked').count(), 0);
  check(outgoing, [], "no employer submission request");
  const leverOutgoing = outgoing.length;
  // The same toolbar popup on a Greenhouse application form.
  const greenhouse = await context.newPage(); await greenhouse.goto(greenhouseUrl);
  await greenhouse.bringToFront();
  await greenhouse.locator("#email").fill("manually-entered@example.test");
  await attachPopup();
  await waitFor("!document.getElementById('autofill').hidden && document.getElementById('autofill-platform').textContent === 'Greenhouse'");
  await evaluate("document.getElementById('autofill-review').click()");
  await waitFor("!document.getElementById('autofill-body').hidden && !document.getElementById('autofill-apply').disabled");
  check(await evaluate("document.getElementById('autofill-fields').textContent.includes('Lovelace')"), true);
  await evaluate("document.getElementById('autofill-apply').click()");
  await waitFor("/filled/.test(document.getElementById('autofill-status').textContent)");
  check(await greenhouse.locator("#first_name").inputValue(), "Ada");
  check(await greenhouse.locator("#last_name").inputValue(), "Lovelace");
  check(await greenhouse.locator("#email").inputValue(), "manually-entered@example.test");
  check(await greenhouse.locator("#phone").inputValue(), "");
  check(await greenhouse.locator("#question_1006").inputValue(), answer.answer);
  check(await greenhouse.locator("#gender, #country, #question_1007").evaluateAll(items => items.map(item => item.value)), ["", "", ""]);
  check(await greenhouse.locator('input[type="file"]').evaluateAll(items => items.map(item => item.files.length)), [0, 0]);
  check(outgoing.length, leverOutgoing, "no Greenhouse submission request");
  // The same toolbar popup on an Ashby application form: no <form>, fields rendered after load.
  const ashby = await context.newPage();
  await ashby.addInitScript(() => { window.__clicks = 0; document.addEventListener("click", () => { window.__clicks++; }, true); });
  await ashby.goto(ashbyUrl);
  await ashby.bringToFront();
  await ashby.waitForSelector(".ashby-application-form-field-entry", { state: "attached" });
  await ashby.locator("#_systemfield_email").fill("manually-entered@example.test");
  await attachPopup();
  await waitFor("!document.getElementById('autofill').hidden && document.getElementById('autofill-platform').textContent === 'Ashby'");
  await evaluate("document.getElementById('autofill-review').click()");
  await waitFor("!document.getElementById('autofill-body').hidden && !document.getElementById('autofill-apply').disabled");
  check(await evaluate("document.getElementById('autofill-fields').textContent.includes('Ada Lovelace')"), true);
  check(await evaluate("document.getElementById('autofill-manual-list').textContent.includes('Where will you work from?')"), true, "the location question is listed as manual");
  await evaluate("document.getElementById('autofill-apply').click()");
  await waitFor("/filled/.test(document.getElementById('autofill-status').textContent)");
  check(await ashby.locator("#_systemfield_name").inputValue(), "Ada Lovelace");
  check(await ashby.locator("#_systemfield_email").inputValue(), "manually-entered@example.test");
  check(await ashby.locator('[id="3a1f0c52-6d4e-4a7b-9c10-0d1e2f3a4b05"]').inputValue(), answer.answer);
  check(await ashby.locator('input[role="combobox"]').evaluateAll(items => items.map(item => item.value)), ["", ""]);
  check(await ashby.locator('input[type="file"]').evaluateAll(items => items.map(item => item.files.length)), [0, 0]);
  check(await ashby.locator('input[type="radio"],input[type="checkbox"]').evaluateAll(items => items.filter(item => item.checked).length), 0);
  check(await ashby.evaluate(() => [window.__clicks, window.__submitAttempts]), [0, 0], "no click and no submit attempt on the Ashby page");
  check(outgoing.length, leverOutgoing, "no Ashby submission request");
  const persisted = await worker.evaluate(async () => JSON.stringify({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null) }));
  check(persisted.includes("Ada Lovelace"), false, "private proposed values must remain in worker memory");
  check(persisted.includes("Measured 25% improvement."), false);
  check(sourceReads >= 3, true, "source reads and final approval checks use the actual worker transport");
  console.log(JSON.stringify({ checks, sourceReads, runtime: "real unpacked MV3 and toolbar popup", data: "intercepted fictional gateway and Lever, Greenhouse and Ashby forms", employerRequests: outgoing.length, result: "pass" }));
} finally {
  for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error("Runtime check closed.")); }
  await root?.detach().catch(() => {}); await context?.close(); await rm(profile, { recursive: true, force: true });
}
