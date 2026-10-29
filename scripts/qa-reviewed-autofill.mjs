// Isolated browser fixture: every request is intercepted. No employer receives
// fixture values, and no real form is filled or submitted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error("Set PLAYWRIGHT_MODULE to an installed Playwright module.");
const { chromium } = await import(pathToFileURL(modulePath).href);
const html = await readFile(new URL("../tests/fixtures/lever-application.html", import.meta.url), "utf8");
const adapter = new URL("../extension/content/autofill.js", import.meta.url);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const submitted = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  if (route.request().method() !== "GET") submitted.push(route.request().method());
  return route.request().isNavigationRequest() && route.request().method() === "GET"
    ? route.fulfill({ contentType: "text/html", body: html }) : route.abort();
});
await page.addInitScript(() => {
  window.__listeners = [];
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
const url = "https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply";
const send = message => page.evaluate(value => window.__message(value), message);
async function reset() { await page.goto(url); await page.addScriptTag({ content: await readFile(adapter, "utf8") }); }
async function scan() { const result = await send({ type: "autofill:scan" }); assert.equal(result?.ok, true); return result; }
const apply = (inventory, values) => send({ type: "autofill:apply", inventoryId: inventory.inventoryId, expiresAt: Date.now() + 300000, values });
const values = (inventory, key, value) => [{ fieldId: inventory.fields.find(field => field.sourceKey === key).id, value }];
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

try {
  await reset();
  let inventory = await scan();
  check(inventory.fields.filter(field => field.kind === "profile").map(field => field.sourceKey), ["name", "email", "phone", "linkedin", "github", "portfolio"]);
  check(inventory.fields.filter(field => field.kind === "answer").map(field => field.label), ["Describe a project.", "Additional information"]);
  check(inventory.manual.some(field => /location/i.test(field.label)), true);
  check(inventory.manual.some(field => /referred/i.test(field.label)), true);
  check(inventory.manual.some(field => /university/i.test(field.label)), true);
  check(inventory.fields.some(field => /eeo|signature|referr/i.test(JSON.stringify(field))), false);
  const inputEvents = [];
  await page.exposeFunction("recordInput", value => inputEvents.push(value));
  await page.locator('[name="name"]').evaluate(element => element.addEventListener("input", () => window.recordInput(element.value)));
  let result = await apply(inventory, values(inventory, "name", "Ada Lovelace"));
  check(result.outcomes[0].status, "filled");
  check(await page.locator('[name="name"]').inputValue(), "Ada Lovelace");
  check(inputEvents, ["Ada Lovelace"]);
  check(await page.locator('[name="eeo[disabilitySignature]"]').inputValue(), "");
  check(await page.locator('input[type="file"]').evaluate(element => element.files.length), 0);
  check(await page.locator('input[type="checkbox"]:checked,input[type="radio"]:checked').count(), 0);

  await reset();
  await page.locator('[name="email"]').fill("manually-entered@example.test");
  inventory = await scan();
  check(inventory.fields.find(field => field.sourceKey === "email").empty, false);
  check(JSON.stringify(inventory).includes("manually-entered@example.test"), false);
  result = await apply(inventory, values(inventory, "email", "ada@example.test"));
  check(result.outcomes[0].status, "preserved");
  check(await page.locator('[name="email"]').inputValue(), "manually-entered@example.test");
  await page.locator('[name="phone"]').fill(" ");
  result = await apply(inventory, values(inventory, "phone", "+1 202 555 0140"));
  check(result.outcomes[0].status, "preserved");
  check(await page.locator('[name="phone"]').inputValue(), " ");

  for (const mutation of [
    element => { element.disabled = true; }, element => { element.readOnly = true; },
    element => { element.style.display = "none"; }, element => { element.closest("li").style.opacity = "0"; },
    element => { element.name = "someone-else"; },
    element => { element.closest("li").querySelector(".application-label").textContent = "Reference's email"; },
    element => { element.replaceWith(element.cloneNode()); },
    element => { element.setAttribute("role", "combobox"); },
  ]) {
    await reset(); inventory = await scan();
    await page.locator('[name="email"]').evaluate(mutation);
    result = await apply(inventory, values(inventory, "email", "ada@example.test"));
    check(result.outcomes[0].status === "filled", false, "a changed input must not receive a reviewed value");
    check(await page.locator('input[type="email"][required]').inputValue(), "");
  }

  await reset(); inventory = await scan();
  await page.locator("form").evaluate(form => { form.action = "https://different.example.test/apply"; });
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await page.locator('[name="name"]').inputValue(), "");
  await reset(); inventory = await scan();
  await page.evaluate(() => history.replaceState(null, "", "/qa/00000000-0000-4000-8000-000000000002/apply"));
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await page.locator('[name="name"]').inputValue(), "");

  for (const changeDuringInput of [
    element => element.addEventListener("input", () => { element.form.action = "https://changed.example.test/apply"; }),
    element => element.addEventListener("input", () => history.replaceState(null, "", "/qa/00000000-0000-4000-8000-000000000002/apply")),
    element => element.addEventListener("input", () => element.form.replaceWith(element.form.cloneNode(true))),
  ]) {
    await reset(); inventory = await scan();
    await page.locator('[name="name"]').evaluate(changeDuringInput);
    result = await apply(inventory, [...values(inventory, "name", "Ada Lovelace"), ...values(inventory, "email", "ada@example.test")]);
    check(result.outcomes[1].status, "changed", "a site event must not redirect the rest of a fill batch");
    check(await page.locator('[name="email"]').inputValue(), "");
  }

  await reset();
  await page.locator('[name="email"]').evaluate(element => element.closest("li").after(element.closest("li").cloneNode(true)));
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "email"), false, "duplicate controls are ambiguous");
  await reset();
  await page.locator('[name="phone"]').evaluate(element => { element.disabled = true; });
  await page.locator('[name="email"]').evaluate(element => { element.readOnly = true; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "phone" || field.sourceKey === "email"), false);

  await reset();
  await page.locator("textarea").first().evaluate(element => { element.maxLength = 6; });
  inventory = await scan();
  const custom = inventory.fields.find(field => field.label === "Describe a project.");
  result = await apply(inventory, [{ fieldId: custom.id, value: "Do not truncate this answer." }]);
  check(result.outcomes[0].status, "too-long");
  check(await page.locator("textarea").first().inputValue(), "");
  await reset(); inventory = await scan();
  const unicode = "Built an API — résumé\nMeasured 25% improvement. 日本語";
  result = await apply(inventory, [{ fieldId: inventory.fields.find(field => field.kind === "answer").id, value: unicode }]);
  check(result.outcomes[0].status, "filled");
  check(await page.locator("textarea").first().inputValue(), unicode);

  await reset(); inventory = await scan();
  await page.addScriptTag({ content: await readFile(adapter, "utf8") });
  check(await page.evaluate(() => window.__listeners.length), 1, "reinjection must replace its old listener");
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await page.locator('[name="name"]').inputValue(), "");
  await reset(); inventory = await scan();
  check((await send({ type: "autofill:apply", inventoryId: inventory.inventoryId, expiresAt: Date.now() - 1, values: values(inventory, "name", "Ada Lovelace") })).ok, false);
  check(await page.locator('[name="name"]').inputValue(), "");
  await reset(); inventory = await scan();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { get: () => "hidden" }));
  check((await apply(inventory, values(inventory, "name", "Ada Lovelace"))).ok, false);
  check(await page.locator('[name="name"]').inputValue(), "");
  await reset();
  await page.locator('[name="phone"]').evaluate(element => { element.name = "constructor"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.sourceKey === "phone"), false);
  await reset();
  await page.locator(".custom-question").first().evaluate(element => { element.querySelector(".application-label").textContent = "How did you hear about this opportunity?"; });
  inventory = await scan();
  check(inventory.fields.some(field => field.label === "How did you hear about this opportunity?"), false);
  check(submitted, [], "autofill must never submit the form");
  check(errors, []);
  console.log(JSON.stringify({ checks, submittedRequests: submitted.length, pageErrors: errors, result: "pass" }));
} finally { await browser.close(); }
