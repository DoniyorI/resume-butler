// Isolated browser fixture: every request is intercepted. No employer receives
// fixture values, and no real form is filled or submitted. Mirrors
// qa-reviewed-autofill.mjs for the Greenhouse adapter.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const { chromium } = await import(pathToFileURL(modulePath).href);
const html = await readFile(new URL("../tests/fixtures/greenhouse-application.html", import.meta.url), "utf8");
const core = new URL("../extension/content/autofill-core.js", import.meta.url);
const adapter = new URL("../extension/content/autofill-greenhouse.js", import.meta.url);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const submitted = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  if (route.request().method() !== "GET") submitted.push(route.request().method());
  else if (!route.request().isNavigationRequest()) submitted.push("GET " + new URL(route.request().url()).pathname);
  return route.request().isNavigationRequest() && route.request().method() === "GET"
    ? route.fulfill({ contentType: "text/html", body: html }) : route.abort();
});
await page.addInitScript(() => {
  window.__listeners = [];
  window.__submitEvents = 0;
  document.addEventListener("submit", () => { window.__submitEvents++; }, true);
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
const url = "https://job-boards.greenhouse.io/examplelabs/jobs/4000001";
const send = message => page.evaluate(value => window.__message(value), message);
async function inject() { await page.addScriptTag({ content: await readFile(core, "utf8") }); await page.addScriptTag({ content: await readFile(adapter, "utf8") }); }
async function reset(target = url) { await page.goto(target); await inject(); }
async function scan() { const result = await send({ type: "autofill:scan" }); assert.equal(result?.ok, true, JSON.stringify(result)); return result; }
const apply = (inventory, values) => send({ type: "autofill:apply", inventoryId: inventory.inventoryId, expiresAt: Date.now() + 300000, values });
const byKey = (inventory, key) => inventory.fields.find(field => field.sourceKey === key);
const values = (inventory, key, value) => [{ fieldId: byKey(inventory, key).id, value }];
const labelValues = (inventory, label, value) => [{ fieldId: inventory.fields.find(field => field.label === label).id, value }];
const input = id => page.locator(`#${id}`);
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

try {
  await reset();
  let inventory = await scan();
  check(inventory.title, "Staff Quality Engineer");
  check(inventory.url, url);
  check(inventory.fields.filter(field => field.kind === "profile").map(field => [field.label, field.sourceKey]), [
    ["First Name", "firstName"], ["Last Name", "lastName"], ["Email", "email"], ["Phone", "phone"],
    ["LinkedIn Profile", "linkedin"], ["Website", "portfolio"], ["GitHub URL", "github"]]);
  check(inventory.fields.filter(field => field.kind === "answer").map(field => field.label),
    ["What name should we use during interviews?", "Tell us about a test strategy you led.", "Describe a project."]);
  const manual = inventory.manual.map(item => `${item.label}: ${item.reason}`);
  check(manual.some(item => /^Country: Choose or enter/.test(item)), true);
  check(manual.some(item => /^Resume\/CV: Attach/.test(item)) && manual.some(item => /^Cover Letter: Attach/.test(item)), true);
  check(manual.some(item => /^Are you authorized.*: Choose or enter/.test(item)) && manual.some(item => /^Will you need visa.*: Choose or enter/.test(item)), true);
  check(manual.some(item => /^Gender: Complete this field yourself/.test(item)) && manual.some(item => /^Veteran Status: Complete this field yourself/.test(item)), true);
  check(manual.some(item => /^Disabled question: This field is not editable/.test(item)), true);
  check(manual.filter(item => /^Preferred pronunciation: Repeated fields are ambiguous/.test(item)).length, 1);
  check(inventory.fields.some(field => /pronunciation|hidden|disabled|country|gender|veteran|authorized|visa/i.test(field.label)), false);
  check(inventory.manual.some(item => /hidden question/i.test(item.label)), false, "hidden fields are not listed");
  check(inventory.manual.some(item => item.label === "Unlabeled field"), false, "required-field shims are ignored silently");
  check(inventory.manual.length, 9, "exactly: country, resume, cover letter, 2 selects, gender, veteran, disabled, repeated");
  check(JSON.stringify(inventory).includes("resume_text"), false);

  // A write sticks under React-style control, fires events, and touches nothing else.
  const inputEvents = [];
  await page.exposeFunction("recordInput", value => inputEvents.push(value));
  await input("first_name").evaluate(element => element.addEventListener("input", () => window.recordInput(element.value)));
  let result = await apply(inventory, values(inventory, "firstName", "Ada"));
  check(result.outcomes[0].status, "filled");
  check(inputEvents, ["Ada"]);
  await page.evaluate(() => window.rerender());
  check(await input("first_name").inputValue(), "Ada", "a controlled value survives a re-render");
  result = await apply(inventory, [...values(inventory, "lastName", "Lovelace"), ...values(inventory, "email", "ada@example.test"), ...values(inventory, "phone", "+1 202 555 0140"),
    ...values(inventory, "linkedin", "https://linkedin.com/in/ada"), ...values(inventory, "github", "https://github.com/ada"), ...values(inventory, "portfolio", "https://ada.example.test/")]);
  check(result.outcomes.map(item => item.status), Array(6).fill("filled"));
  await page.evaluate(() => window.rerender());
  check(await input("email").inputValue(), "ada@example.test", "a second controlled value survives a re-render");
  check(await input("phone").inputValue(), "+1 202 555 0140");
  check(await input("question_1002").inputValue(), "https://ada.example.test/");
  check(await input("country").inputValue(), "");
  check(await input("gender").inputValue(), "");
  check(await input("question_1007").inputValue(), "");
  check(await page.locator(".select-shell-requiredInput").evaluateAll(items => items.map(item => item.value)), ["", ""]);
  check(await page.locator('input[type="file"]').evaluateAll(items => items.map(item => item.files.length)), [0, 0]);
  check(await page.locator("#resume_text,#cover_letter_text").evaluateAll(items => items.map(item => item.value)), ["", ""]);

  // Typed input is preserved, including a lone space.
  await reset();
  await input("email").fill("manually-entered@example.test");
  inventory = await scan();
  check(byKey(inventory, "email").empty, false);
  check(JSON.stringify(inventory).includes("manually-entered@example.test"), false);
  result = await apply(inventory, values(inventory, "email", "ada@example.test"));
  check(result.outcomes[0].status, "preserved");
  check(await input("email").inputValue(), "manually-entered@example.test");
  await input("phone").fill(" ");
  result = await apply(inventory, values(inventory, "phone", "+1 202 555 0140"));
  check(result.outcomes[0].status, "preserved");
  check(await input("phone").inputValue(), " ");

  for (const mutation of [
    element => { element.disabled = true; }, element => { element.readOnly = true; },
    element => { element.style.display = "none"; }, element => { element.closest(".field-wrapper").style.opacity = "0"; },
    element => { element.id = "someone-else"; },
    element => { element.setAttribute("aria-label", "Reference's email"); document.querySelector('label[for="email"]').textContent = "Reference's email"; },
    element => { element.replaceWith(element.cloneNode()); },
    element => { element.setAttribute("role", "combobox"); },
    element => { element.setAttribute("autocomplete", "off"); },
    element => { const wrapper = element.closest(".field-wrapper"); wrapper.replaceWith(wrapper.cloneNode(true)); },
  ]) {
    await reset(); inventory = await scan();
    await input("email").evaluate(mutation);
    result = await apply(inventory, values(inventory, "email", "ada@example.test"));
    check(result.outcomes[0].status === "filled", false, "a changed input must not receive a reviewed value");
    check(await page.evaluate(() => [...document.querySelectorAll("form input")].some(item => item.value === "ada@example.test")), false);
  }

  // Moving the input under a different question wrapper changes its identity.
  await reset(); inventory = await scan();
  await input("email").evaluate(element => { const other = document.createElement("div"); other.className = "field-wrapper"; element.closest("form").append(other); other.append(element); });
  result = await apply(inventory, values(inventory, "email", "ada@example.test"));
  check(result.outcomes[0].status, "changed");
  check(await input("email").inputValue(), "");

  await reset(); inventory = await scan();
  await page.locator("form").evaluate(form => { form.setAttribute("action", "https://different.example.test/apply"); });
  check((await apply(inventory, values(inventory, "firstName", "Ada"))).ok, false);
  check(await input("first_name").inputValue(), "");
  await reset(); inventory = await scan();
  await page.evaluate(() => history.replaceState(null, "", "/examplelabs/jobs/4000002"));
  check((await apply(inventory, values(inventory, "firstName", "Ada"))).ok, false);
  check(await input("first_name").inputValue(), "");

  for (const changeDuringInput of [
    element => element.addEventListener("input", () => { element.form.setAttribute("action", "https://changed.example.test/apply"); }),
    element => element.addEventListener("input", () => history.replaceState(null, "", "/examplelabs/jobs/4000002")),
    element => element.addEventListener("input", () => element.form.replaceWith(element.form.cloneNode(true))),
  ]) {
    await reset(); inventory = await scan();
    await input("first_name").evaluate(changeDuringInput);
    result = await apply(inventory, [...values(inventory, "firstName", "Ada"), ...values(inventory, "email", "ada@example.test")]);
    check(result.outcomes[1].status, "changed", "a site event must not redirect the rest of a fill batch");
    check(await input("email").inputValue(), "");
  }

  // Duplicates, uneditable and unsupported controls.
  await reset();
  await input("email").evaluate(element => element.closest(".field-wrapper").after(element.closest(".field-wrapper").cloneNode(true)));
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "email"), false, "duplicate controls are ambiguous");
  await reset();
  await input("phone").evaluate(element => { element.disabled = true; });
  await input("email").evaluate(element => { element.readOnly = true; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "phone" || field.sourceKey === "email"), false);
  await reset();
  await input("email").evaluate(element => { element.type = "number"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "email"), false, "an unexpected control type has no source");
  await reset();
  await input("first_name").evaluate(element => { element.id = "constructor"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "firstName"), false);
  await reset();
  await input("first_name").evaluate(element => { document.querySelector('label[for="first_name"]').textContent = "First name of your referrer"; element.setAttribute("aria-label", "x"); });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "firstName"), false, "a label that does not match the id is not a contact");
  await reset();
  await input("question_1004").evaluate(element => { document.querySelector('label[for="question_1004"]').textContent = "How did you hear about this opportunity?"; element.setAttribute("aria-label", "How did you hear about this opportunity?"); });
  inventory = await scan();
  check(inventory.fields.some(field => field.label === "How did you hear about this opportunity?"), false);

  // Length and line rules.
  await reset();
  await input("question_1005").evaluate(element => { element.maxLength = 6; });
  inventory = await scan();
  result = await apply(inventory, labelValues(inventory, "Tell us about a test strategy you led.", "Do not truncate this answer."));
  check(result.outcomes[0].status, "too-long");
  check(await input("question_1005").inputValue(), "");
  await reset(); inventory = await scan();
  const unicode = "Built an API — résumé\nMeasured 25% improvement. 日本語";
  result = await apply(inventory, labelValues(inventory, "Describe a project.", unicode));
  check(result.outcomes[0].status, "filled");
  check(await input("question_1006").inputValue(), unicode);
  result = await apply(inventory, labelValues(inventory, "What name should we use during interviews?", "Ada\nLovelace"));
  check(result.outcomes[0].status, "too-long", "a line break never goes into a single-line input");
  check(await input("question_1004").inputValue(), "");

  // Lifecycle: reinjection, deadline, hidden tab.
  await reset(); inventory = await scan();
  await inject();
  check(await page.evaluate(() => window.__listeners.length), 1, "reinjection must replace its old listener");
  check((await apply(inventory, values(inventory, "firstName", "Ada"))).ok, false);
  check(await input("first_name").inputValue(), "");
  await reset(); inventory = await scan();
  check((await send({ type: "autofill:apply", inventoryId: inventory.inventoryId, expiresAt: Date.now() - 1, values: values(inventory, "firstName", "Ada") })).ok, false);
  check(await input("first_name").inputValue(), "");
  await reset(); inventory = await scan();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { get: () => "hidden" }));
  check((await apply(inventory, values(inventory, "firstName", "Ada"))).ok, false);
  check(await input("first_name").inputValue(), "");

  // URL and form rules.
  const ok = [
    "https://job-boards.greenhouse.io/examplelabs/jobs/4000001", "https://job-boards.greenhouse.io/examplelabs/jobs/4000001/",
    "https://job-boards.greenhouse.io/embed/job_app?for=examplelabs&token=4000001",
  ];
  for (const target of ok) { await reset(target); check((await send({ type: "autofill:scan" }))?.ok, true, target); }
  for (const target of [
    "https://job-boards.greenhouse.io/examplelabs/jobs/abc", "https://job-boards.greenhouse.io/examplelabs/jobs/4000001/apply", "https://job-boards.greenhouse.io/embed/job_app",
    "https://job-boards.greenhouse.io/embed/job_app?for=examplelabs", "https://job-boards.greenhouse.io/embed/job_app?for=a%20b&token=1", "https://job-boards.greenhouse.io/embed/job_app?for=a&token=1&token=2",
    "https://job-boards.greenhouse.io/",
  ]) { await reset(target); const reply = await send({ type: "autofill:scan" }); check([reply?.ok, reply?.error], [false, "Open the application form on Greenhouse, then review its fields."], target); }
  await reset(); await page.locator("form").evaluate(form => { form.id = "other"; });
  check((await send({ type: "autofill:scan" })).error, "This Greenhouse form is not ready or its layout is unsupported. Complete it manually.");
  await reset(); await page.locator("form").evaluate(form => { form.after(form.cloneNode(true)); });
  check((await send({ type: "autofill:scan" })).ok, false, "two forms are unsupported");
  await reset(); await page.locator("form").evaluate(form => { form.style.display = "none"; });
  check((await send({ type: "autofill:scan" })).ok, false, "an invisible form is unsupported");
  // Other hosts load neither adapter.
  const foreign = await context.newPage();
  await foreign.addInitScript(() => { window.chrome = { runtime: { id: "qa", onMessage: { addListener: () => { window.__registered = true; }, removeListener() {} } } }; });
  await foreign.route("**/*", route => route.fulfill({ contentType: "text/html", body: html }));
  await foreign.goto("https://boards.greenhouse.io/examplelabs/jobs/4000001");
  await foreign.addScriptTag({ content: await readFile(core, "utf8") }); await foreign.addScriptTag({ content: await readFile(adapter, "utf8") });
  check(await foreign.evaluate(() => Boolean(window.__registered)), false, "boards.greenhouse.io is not an autofill host");
  await foreign.close();

  check(await page.evaluate(() => window.__submitEvents), 0, "no submit event fires");
  check(submitted, [], "autofill must never submit the form or send a request");
  check(errors, []);
  console.log(JSON.stringify({ checks, submittedRequests: submitted.length, pageErrors: errors, result: "pass" }));
} finally { await browser.close(); }
