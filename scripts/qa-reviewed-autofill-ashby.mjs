// Isolated browser fixture: every request is intercepted. No employer receives
// fixture values, and no real form is filled or submitted. Mirrors
// qa-reviewed-autofill-greenhouse.mjs for the Ashby adapter, which has no <form>
// element and renders its fields after the page has loaded.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const { chromium } = await import(pathToFileURL(modulePath).href);
const html = await readFile(new URL("../tests/fixtures/ashby-application.html", import.meta.url), "utf8");
const core = new URL("../extension/content/autofill-core.js", import.meta.url);
const adapter = new URL("../extension/content/autofill-ashby.js", import.meta.url);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const submitted = [], errors = [], seen = { clicks: 0, submitClicks: 0, submitEvents: 0 };
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  if (route.request().method() !== "GET") submitted.push(route.request().method());
  else if (!route.request().isNavigationRequest()) submitted.push("GET " + new URL(route.request().url()).pathname);
  return route.request().isNavigationRequest() && route.request().method() === "GET"
    ? route.fulfill({ contentType: "text/html", body: html }) : route.abort();
});
// Counted outside the page, so the totals cover every page load of this run.
await page.exposeFunction("qaSeen", kind => { seen[kind]++; });
await page.addInitScript(() => {
  window.__listeners = [];
  document.addEventListener("submit", () => window.qaSeen("submitEvents"), true);
  document.addEventListener("click", event => {
    window.qaSeen("clicks");
    if (event.target.closest?.(".ashby-application-form-submit-button")) window.qaSeen("submitClicks");
  }, true);
  window.chrome = { runtime: { id: "qa", onMessage: {
    addListener: fn => window.__listeners.push(fn),
    removeListener: fn => { window.__listeners = window.__listeners.filter(item => item !== fn); },
  } } };
  window.__message = message => new Promise(resolve => {
    let replied = false;
    for (const listener of window.__listeners) listener(message, { id: "qa", url: "chrome-extension://qa/background.js" }, value => { replied = true; resolve(value); });
    if (!replied) resolve(null);
  });
});
const url = "https://jobs.ashbyhq.com/examplelabs/7458d4e9-da2e-47bd-98cb-adfda43d42b2/application";
const send = message => page.evaluate(value => window.__message(value), message);
async function inject() { await page.addScriptTag({ content: await readFile(core, "utf8") }); await page.addScriptTag({ content: await readFile(adapter, "utf8") }); }
// The fixture renders its fields about 300 ms after load, like Ashby's React app.
async function reset(target = url, { wait = true } = {}) {
  await page.goto(target); await inject();
  if (wait) await page.waitForSelector(".ashby-application-form-field-entry", { state: "attached" });
}
async function scan() { const result = await send({ type: "autofill:scan" }); assert.equal(result?.ok, true, JSON.stringify(result)); return result; }
const apply = (inventory, values) => send({ type: "autofill:apply", inventoryId: inventory.inventoryId, expiresAt: Date.now() + 300000, values });
const byKey = (inventory, key) => inventory.fields.find(field => field.sourceKey === key);
const values = (inventory, key, value) => [{ fieldId: byKey(inventory, key).id, value }];
const labelValues = (inventory, label, value) => [{ fieldId: inventory.fields.find(field => field.label === label).id, value }];
const input = id => page.locator(`[id="${id}"]`);
const Q = n => `3a1f0c52-6d4e-4a7b-9c10-0d1e2f3a4b${String(n).padStart(2, "0")}`;
const NOT_READY = "This Ashby form is not ready or its layout is unsupported. Complete it manually.";
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

try {
  // The page renders late: before it does, review says so; after it, review works.
  await reset(url + "?delay=3000", { wait: false });
  let early = await send({ type: "autofill:scan" });
  check([early?.ok, early?.error], [false, NOT_READY], "a not-yet-rendered page is reported, not guessed at");
  await page.waitForSelector(".ashby-application-form-field-entry", { state: "attached" });
  check((await send({ type: "autofill:scan" }))?.ok, true, "the same page can be reviewed once it has rendered");

  await reset();
  let inventory = await scan();
  check(inventory.title, "Senior Test Engineer");
  check(inventory.url, url);
  check(inventory.fields.filter(field => field.kind === "profile").map(field => [field.label, field.sourceKey]), [
    ["Name", "name"], ["Email", "email"], ["LinkedIn Profile", "linkedin"], ["Website", "portfolio"]]);
  check(inventory.fields.filter(field => field.kind === "answer").map(field => field.label),
    ["Which time zone do you usually work in?", "Describe a project.", "Tell us how you give feedback to teammates."]);
  const manual = inventory.manual.map(item => `${item.label}: ${item.reason}`);
  check(manual.some(item => /^Resume: Attach the intended file yourself/.test(item)), true);
  check(inventory.manual.filter(item => /^Resume/.test(item.label)).length, 1, "the resume-parsing uploader is skipped silently");
  check(manual.some(item => /^Where will you work from\?: Choose a location from the site's suggestions\./.test(item)), true, "the location combobox is found through its entry");
  check(manual.some(item => /^Are you able to start within two months\?: Choose or enter/.test(item)), true);
  check(inventory.manual.filter(item => /start within two months/.test(item.label)).length, 1, "a yes/no pair is listed once");
  check(manual.some(item => /^Preferred working arrangement: Choose or enter/.test(item)), true);
  check(manual.some(item => /^Which test tools have you used\?: Choose or enter/.test(item)), true);
  check(manual.some(item => /^Which office is closest to you\?: Choose or enter/.test(item)), true);
  check(manual.some(item => /^How did you hear about this role\?: Complete this field yourself/.test(item)), true);
  check(manual.some(item => /^What is your age range\?: Complete this field yourself/.test(item)) && manual.some(item => /^How would you describe your gender\?: Complete this field yourself/.test(item)) &&
    manual.some(item => /^Which ethnicity\(ies\) do you identify with\?: Complete this field yourself/.test(item)), true, "demographic questions are one entry per question");
  check(manual.some(item => /^Disabled question: This field is not editable/.test(item)), true);
  check(manual.filter(item => /^Preferred nickname: Repeated fields are ambiguous/.test(item)).length, 1);
  check(inventory.fields.some(field => /nickname|hidden|disabled|location|office|arrangement|tools|age|gender|ethnicity|start within|hear about|resume/i.test(field.label)), false);
  check(inventory.manual.some(item => /hidden question/i.test(item.label)), false, "hidden fields are not listed");
  check(inventory.manual.some(item => ["Unlabeled field", "Upload file", "Remote", "On site", "Under 30", "Woman", "Option one", "Playwright", "Yes", "No"].includes(item.label)), false,
    "no per-option, unlabelled or button entries");
  check(inventory.manual.length, 12, "exactly: resume, location, yes/no, arrangement, tools, office, how-heard, 3 survey questions, disabled, repeated");
  check(JSON.stringify(inventory).includes("g-recaptcha"), false);

  // The group ids change on every load; nothing depends on them.
  const groupOf = () => page.locator('input[type="radio"]').first().getAttribute("id");
  const firstGroup = await groupOf();
  await reset(); await scan();
  check(firstGroup !== await groupOf(), true, "radio group ids differ between loads");
  inventory = await scan();
  check(inventory.manual.length, 12, "the same inventory on a reload with new group ids");

  // A write sticks under React-style control, fires events, and touches nothing else.
  const inputEvents = [];
  await page.exposeFunction("recordInput", value => inputEvents.push(value));
  await input("_systemfield_name").evaluate(element => element.addEventListener("input", () => window.recordInput(element.value)));
  check(await input("_systemfield_name").evaluate(element => Boolean(element._valueTracker)), true, "the fixture's name field is controlled");
  let result = await apply(inventory, values(inventory, "name", "Ada Lovelace"));
  check(result.outcomes[0].status, "filled");
  check(inputEvents, ["Ada Lovelace"]);
  await page.evaluate(() => window.rerender());
  check(await input("_systemfield_name").inputValue(), "Ada Lovelace", "a controlled value survives a re-render");
  result = await apply(inventory, [...values(inventory, "email", "ada@example.test"), ...values(inventory, "linkedin", "https://linkedin.com/in/ada"),
    ...values(inventory, "portfolio", "https://ada.example.test/"), ...labelValues(inventory, "Describe a project.", "I built an API.\nMeasured 25% improvement.")]);
  check(result.outcomes.map(item => item.status), Array(4).fill("filled"));
  await page.evaluate(() => window.rerender());
  check(await input("_systemfield_email").inputValue(), "ada@example.test", "a second controlled value survives a re-render");
  check(await input(Q(1)).inputValue(), "https://linkedin.com/in/ada");
  check(await input(Q(2)).inputValue(), "https://ada.example.test/");
  check(await input(Q(5)).inputValue(), "I built an API.\nMeasured 25% improvement.");
  check(await input(Q(3)).inputValue(), "");
  check(await input(Q(6)).inputValue(), "");
  check(await input(Q(9)).inputValue(), "");
  check(await input(Q(10)).inputValue(), "");
  check(await page.locator('input[role="combobox"]').evaluateAll(items => items.map(item => item.value)), ["", ""]);
  check(await page.locator('input[type="radio"],input[type="checkbox"]').evaluateAll(items => items.filter(item => item.checked).length), 0);
  check(await page.locator('input[type="file"]').evaluateAll(items => items.map(item => item.files.length)), [0, 0]);
  check(await page.locator(".ashby-application-form-input-yesno-option").evaluateAll(items => items.map(item => item.getAttribute("aria-pressed"))), ["false", "false"]);

  // Typed input is preserved, including a lone space.
  await reset();
  await input("_systemfield_email").fill("manually-entered@example.test");
  inventory = await scan();
  check(byKey(inventory, "email").empty, false);
  check(JSON.stringify(inventory).includes("manually-entered@example.test"), false);
  result = await apply(inventory, values(inventory, "email", "ada@example.test"));
  check(result.outcomes[0].status, "preserved");
  check(await input("_systemfield_email").inputValue(), "manually-entered@example.test");
  await input("_systemfield_name").fill(" ");
  result = await apply(inventory, values(inventory, "name", "Ada Lovelace"));
  check(result.outcomes[0].status, "preserved");
  check(await input("_systemfield_name").inputValue(), " ");

  const wasWritten = () => page.evaluate(() => [...document.querySelectorAll("input,textarea")].some(item => item.value === "ada@example.test"));
  for (const mutation of [
    element => { element.disabled = true; }, element => { element.readOnly = true; },
    element => { element.style.display = "none"; }, element => { element.closest(".ashby-application-form-field-entry").style.opacity = "0"; },
    element => { element.id = "someone-else"; },
    element => { element.setAttribute("aria-label", "Reference's email"); document.querySelector('label[for="_systemfield_email"]').textContent = "Reference's email"; },
    element => { element.replaceWith(element.cloneNode()); },
    element => { element.setAttribute("role", "combobox"); },
    element => { element.setAttribute("autocomplete", "off"); },
    element => { element.name = "other"; },
    element => { element.closest(".ashby-application-form-field-entry").setAttribute("data-field-path", "someone-else"); },
    element => { const wrapper = element.closest(".ashby-application-form-field-entry"); wrapper.replaceWith(wrapper.cloneNode(true)); },
    element => { document.body.append(element); },
  ]) {
    await reset(); inventory = await scan();
    await input("_systemfield_email").evaluate(mutation);
    result = await apply(inventory, values(inventory, "email", "ada@example.test"));
    check(result.outcomes[0].status === "filled", false, "a changed input must not receive a reviewed value");
    check(await wasWritten(), false);
  }

  // Moving the input under a different question entry changes its identity.
  await reset(); inventory = await scan();
  await input("_systemfield_email").evaluate(element => { const other = document.createElement("div"); other.className = "ashby-application-form-field-entry"; element.closest(".ashby-application-form-section-container").append(other); other.append(element); });
  result = await apply(inventory, values(inventory, "email", "ada@example.test"));
  check(result.outcomes[0].status, "changed");
  check(await input("_systemfield_email").inputValue(), "");

  // The root (there is no <form>) and the URL are re-checked before every write.
  const root = () => page.locator('[role="tabpanel"]');
  await reset(); inventory = await scan();
  await root().evaluate(element => { element.setAttribute("aria-labelledby", "job-overview"); });
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await input("_systemfield_name").inputValue(), "");
  await reset(); inventory = await scan();
  await page.evaluate(() => history.replaceState(null, "", "/examplelabs/00000000-0000-4000-8000-000000000002/application"));
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await input("_systemfield_name").inputValue(), "");
  await reset(); inventory = await scan();
  await root().evaluate(element => element.replaceWith(element.cloneNode(true)));
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false, "a replaced root is a different form");
  check(await input("_systemfield_name").inputValue(), "");

  for (const changeDuringInput of [
    element => element.addEventListener("input", () => { document.querySelector('[role="tabpanel"]').setAttribute("aria-labelledby", "job-overview"); }),
    element => element.addEventListener("input", () => history.replaceState(null, "", "/examplelabs/00000000-0000-4000-8000-000000000002/application")),
    element => element.addEventListener("input", () => { const panel = document.querySelector('[role="tabpanel"]'); panel.replaceWith(panel.cloneNode(true)); }),
  ]) {
    await reset(); inventory = await scan();
    await input("_systemfield_name").evaluate(changeDuringInput);
    result = await apply(inventory, [...values(inventory, "name", "Ada Lovelace"), ...values(inventory, "email", "ada@example.test")]);
    check(result.outcomes[1].status, "changed", "a site event must not redirect the rest of a fill batch");
    check(await input("_systemfield_email").inputValue(), "");
  }

  // Duplicates, uneditable and unsupported controls.
  await reset();
  await input("_systemfield_email").evaluate(element => element.closest(".ashby-application-form-field-entry").after(element.closest(".ashby-application-form-field-entry").cloneNode(true)));
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "email"), false, "duplicate controls are ambiguous");
  await reset();
  await input("_systemfield_name").evaluate(element => { element.disabled = true; });
  await input("_systemfield_email").evaluate(element => { element.readOnly = true; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "name" || field.sourceKey === "email"), false);
  await reset();
  await input("_systemfield_email").evaluate(element => { element.type = "number"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "email"), false, "an unexpected control type has no source");
  await reset();
  await input("_systemfield_name").evaluate(element => { element.id = "constructor"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "name"), false);
  await reset();
  await input("_systemfield_name").evaluate(element => { document.querySelector('label[for="_systemfield_name"]').textContent = "Name of your referrer"; element.setAttribute("aria-label", "x"); });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "name"), false, "a label that does not match the id is not a contact");
  await reset();
  await input(Q(1)).evaluate(element => { element.name = "other"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "linkedin"), false, "a custom question whose name differs from its id has no source");
  await reset();
  await input(Q(3)).evaluate(element => { const entry = element.closest(".ashby-application-form-field-entry"); entry.setAttribute("data-field-path", "someone-else"); });
  inventory = await scan();
  check(inventory.fields.some(field => field.label === "Which time zone do you usually work in?"), false, "a question whose entry path differs from its id has no source");
  await reset();
  await input(Q(3)).evaluate(element => { element.closest(".ashby-application-form-field-entry").classList.remove("ashby-application-form-field-entry"); });
  inventory = await scan();
  check(inventory.fields.some(field => field.label === "Which time zone do you usually work in?"), false, "a control without a field entry is manual");
  check(inventory.manual.some(item => item.label === "Which time zone do you usually work in?"), true);
  await reset();
  await input(Q(3)).evaluate(element => { document.querySelector(`label[for="${element.id}"]`).textContent = "Were you referred by an employee?"; });
  inventory = await scan();
  check(inventory.fields.some(field => /referred/.test(field.label)), false);

  // Length and line rules.
  await reset();
  await input(Q(6)).evaluate(element => { element.maxLength = 6; });
  inventory = await scan();
  result = await apply(inventory, labelValues(inventory, "Tell us how you give feedback to teammates.", "Do not truncate this answer."));
  check(result.outcomes[0].status, "too-long");
  check(await input(Q(6)).inputValue(), "");
  await reset(); inventory = await scan();
  const unicode = "Built an API — résumé\nMeasured 25% improvement. 日本語";
  result = await apply(inventory, labelValues(inventory, "Tell us how you give feedback to teammates.", unicode));
  check(result.outcomes[0].status, "filled");
  check(await input(Q(6)).inputValue(), unicode);
  result = await apply(inventory, labelValues(inventory, "Which time zone do you usually work in?", "Europe/\nBerlin"));
  check(result.outcomes[0].status, "too-long", "a line break never goes into a single-line input");
  check(await input(Q(3)).inputValue(), "");

  // Lifecycle: reinjection, deadline, hidden tab.
  await reset(); inventory = await scan();
  await inject();
  check(await page.evaluate(() => window.__listeners.length), 1, "reinjection must replace its old listener");
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await input("_systemfield_name").inputValue(), "");
  await reset(); inventory = await scan();
  check((await send({ type: "autofill:apply", inventoryId: inventory.inventoryId, expiresAt: Date.now() - 1, values: values(inventory, "name", "Ada Lovelace") })).ok, false);
  check(await input("_systemfield_name").inputValue(), "");
  await reset(); inventory = await scan();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { get: () => "hidden" }));
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await input("_systemfield_name").inputValue(), "");

  // URL and root rules.
  const id = "7458d4e9-da2e-47bd-98cb-adfda43d42b2";
  for (const target of [url, url + "/", url + "?utm_source=careers", `https://jobs.ashbyhq.com/example.labs-2/${id.toUpperCase()}/application`]) {
    await reset(target); check((await send({ type: "autofill:scan" }))?.ok, true, target);
  }
  for (const target of [
    `https://jobs.ashbyhq.com/examplelabs/${id}`, `https://jobs.ashbyhq.com/examplelabs/${id}/`, "https://jobs.ashbyhq.com/examplelabs/not-a-uuid/application",
    `https://jobs.ashbyhq.com/examplelabs/${id}/application/extra`, `https://jobs.ashbyhq.com/examplelabs/7458d4e9-da2e-17bd-98cb-adfda43d42b2/application`,
    "https://jobs.ashbyhq.com/application", "https://jobs.ashbyhq.com/examplelabs", "https://jobs.ashbyhq.com/",
  ]) { await reset(target); const reply = await send({ type: "autofill:scan" }); check([reply?.ok, reply?.error], [false, "Open the application form on Ashby, then review its fields."], target); }
  await reset(); await page.locator(".ashby-application-form-container").first().evaluate(item => { item.after(item.cloneNode(true)); });
  check([(await send({ type: "autofill:scan" })).ok], [false], "two form containers are unsupported");
  check((await send({ type: "autofill:scan" })).error, NOT_READY);
  await reset(); await root().evaluate(item => { item.style.display = "none"; });
  check((await send({ type: "autofill:scan" })).error, NOT_READY, "an invisible root is unsupported");
  await reset(); await page.evaluate(() => document.querySelectorAll(".ashby-application-form-field-entry").forEach(item => item.remove()));
  check((await send({ type: "autofill:scan" })).error, NOT_READY, "a container without field entries is not ready");
  await reset(); await page.evaluate(() => document.body.append(document.querySelector(".ashby-survey-form-container")));
  check((await send({ type: "autofill:scan" })).error, NOT_READY, "a survey outside the root is unsupported");
  await reset(); await page.evaluate(() => document.querySelectorAll(".ashby-application-form-container").forEach(item => item.remove()));
  check((await send({ type: "autofill:scan" })).error, NOT_READY, "no container at all is not ready");
  // Other hosts load neither adapter.
  for (const foreignUrl of [`https://app.ashbyhq.com/examplelabs/${id}/application`, `https://jobs.ashbyhq.com.evil.example/examplelabs/${id}/application`]) {
    const foreign = await context.newPage();
    await foreign.addInitScript(() => { window.chrome = { runtime: { id: "qa", onMessage: { addListener: () => { window.__registered = true; }, removeListener() {} } } }; });
    await foreign.route("**/*", route => route.fulfill({ contentType: "text/html", body: html }));
    await foreign.goto(foreignUrl);
    await foreign.addScriptTag({ content: await readFile(core, "utf8") }); await foreign.addScriptTag({ content: await readFile(adapter, "utf8") });
    check(await foreign.evaluate(() => Boolean(window.__registered)), false, `${foreignUrl} is not an autofill host`);
    await foreign.close();
  }

  // Nothing above clicked, submitted or sent anything, on any page load of this run.
  await reset(); inventory = await scan();
  await apply(inventory, [...values(inventory, "name", "Ada Lovelace"), ...values(inventory, "email", "ada@example.test")]);
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.__submitAttempts), 0, "the submit button's own click listener never fires");
  check(seen, { clicks: 0, submitClicks: 0, submitEvents: 0 }, "no click of any kind, no click on the submit button, no submit event");
  check(submitted, [], "autofill must never submit anything or send a request");
  check(errors, []);
  // Positive control: the instrumentation does see a real click on the plain submit button.
  await page.locator(".ashby-application-form-submit-button").click();
  await page.waitForTimeout(100);
  check([await page.evaluate(() => window.__submitAttempts), seen.clicks, seen.submitClicks], [1, 1, 1], "the click counters work");
  check(submitted, [], "the page has no form, so even a real click sends nothing");
  console.log(JSON.stringify({ checks, submittedRequests: submitted.length, clicksByAutofill: 0, submitAttemptsByAutofill: 0, submitEventsByAutofill: 0, pageErrors: errors, result: "pass" }));
} finally { await browser.close(); }
