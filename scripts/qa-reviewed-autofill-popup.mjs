// Real popup DOM and review lifecycle, with a fictional Chrome/API transport.
// The separate runtime check covers the unpacked MV3 browser wiring.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createAutofillReview } from "../extension/autofillReview.js";

if (!process.env.PLAYWRIGHT_MODULE) throw new Error("Set PLAYWRIGHT_MODULE.");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 680 } });
const page = await context.newPage(), pageErrors = [], writes = [];
page.on("pageerror", error => pageErrors.push(error.message));
const jobUrl = "https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply";
const connection = { userId: "owner", origin: "https://resume-butler.vercel.app", email: "qa@example.test", token: "private-token" };
const facts = { name: "Ada Lovelace", email: "ada@example.test", phone: "", linkedin: "", github: "", portfolio: "" };
const approved = { id: "00000000-0000-4000-8000-000000000010", revision: 3, label: "API project", question: "Describe a project.", answer: "I built an API.\nMeasured 25% improvement." };
let failSource = false, revoked = false;
const controller = createAutofillReview({
  connectedAccount: async () => connection,
  activeTab: async () => ({ id: 7, url: jobUrl }),
  api: async (_path, options = {}) => {
    if (failSource) throw new Error("Connection unavailable. Review again when connected.");
    if (options.method !== "POST") return { facts, profileFingerprint: "a".repeat(64), choices: [{ ...approved, answer: undefined }] };
    if (revoked && options.body.answerSelections.length) throw new Error("A selected answer is no longer approved. Review the fields again.");
    return { facts, profileFingerprint: "a".repeat(64), answers: options.body.answerSelections.map(() => approved) };
  },
  sendToTab: async (_tabId, message) => {
    if (message.type === "autofill:scan") return { ok: true, inventoryId: "inventory", url: jobUrl, title: "QA Engineer", fields: [
      { id: "name", label: "Full name", kind: "profile", sourceKey: "name", empty: true, maxLength: -1, multiline: false },
      { id: "email", label: "Email", kind: "profile", sourceKey: "email", empty: false, maxLength: -1, multiline: false },
      { id: "phone", label: "Phone", kind: "profile", sourceKey: "phone", empty: true, maxLength: -1, multiline: false },
      { id: "project", label: "Describe a project.", kind: "answer", empty: true, maxLength: -1, multiline: true },
      { id: "unknown", label: "What would you like to share?", kind: "answer", empty: true, maxLength: -1, multiline: true },
    ], manual: [{ label: "Current location", reason: "Choose a location from the site's suggestions." }, { label: "Resume/CV", reason: "Attach the intended file yourself." }] };
    writes.push(message);
    return { ok: true, outcomes: message.values.map(field => ({ fieldId: field.fieldId, status: field.fieldId === "name" ? "preserved" : "filled" })) };
  },
});
await page.exposeFunction("qaMessage", async message => {
  const handlers = { "autofill-prepare": "prepare", "autofill-select": "selectAnswer", "autofill-fill": "fill", "autofill-copy": "copyField" };
  try {
    if (handlers[message.type]) return await controller[handlers[message.type]](message);
    if (message.type === "status") return { connection: { ...connection, token: undefined }, recent: [], queued: 0 };
    if (message.type === "capture-context") return { resumes: [{ id: "00000000-0000-4000-8000-000000000099", title: "Backend working resume" }] };
    if (message.type === "save-job") return { ok: true, opportunity: { id: "saved" } };
    if (message.type === "record") return { status: "queued" };
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
});
await page.addInitScript(jobUrl => {
  window.chrome = {
    runtime: { sendMessage: (message, callback) => window.qaMessage(message).then(callback), lastError: null },
    tabs: { query: async () => [{ id: 7, url: jobUrl }], sendMessage: (_id, _message, callback) => callback({ site: "lever", jobId: "00000000-0000-4000-8000-000000000001", company: "QA", role: "QA Engineer", url: jobUrl, description: "Fictional posting" }) },
    management: { getSelf: callback => callback({ installType: "development" }) },
  };
  Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Clipboard denied"); } } });
}, jobUrl);
await context.route("**/*", async route => {
  const path = new URL(route.request().url()).pathname;
  if (!/^\/(?:popup\/(?:popup\.html|popup\.css|popup\.js|autofill\.js)|icons\/icon-32\.png)$/.test(path)) return route.abort();
  try {
    const body = await readFile(new URL(`../extension${path}`, import.meta.url));
    await route.fulfill({ body, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".png") ? "image/png" : "text/html" });
  } catch (error) { if (error.code === "ENOENT") await route.fulfill({ status: 404 }); else throw error; }
});
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const group = label => page.getByRole("group", { name: label, exact: true });
const review = async () => { await page.getByRole("button", { name: /Review fields|Review again/ }).click(); await page.getByRole("group", { name: "Full name", exact: true }).waitFor({ timeout: 5000 }); };
try {
  await page.goto("https://popup.example.test/popup/popup.html");
  await page.getByRole("button", { name: "Review fields", exact: true }).waitFor({ timeout: 5000 });
  check(await page.getByText("Ada Lovelace", { exact: true }).count(), 0, "source values stay hidden before explicit review");
  check(await page.locator("#autofill").evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById("job")) & Node.DOCUMENT_POSITION_FOLLOWING)), true, "filling is the primary action on an application form");
  await review();
  check(await group("Full name").getByRole("checkbox").isChecked(), true);
  check(await group("Email").getByRole("checkbox").isEnabled(), false);
  check(await group("Phone").getByText(/Add this detail/).count(), 1);
  check(await group("Describe a project.").getByText(/I built an API/).count(), 1);
  await group("Full name").getByRole("checkbox").uncheck();
  check(await page.getByRole("button", { name: "Fill 1 selected field", exact: true }).isEnabled(), true);
  await page.getByRole("button", { name: "Copy Describe a project.", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  check(await dialog.getByRole("textbox").inputValue(), approved.answer);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("combobox", { name: "Approved answer for What would you like to share?", exact: true }).selectOption(approved.id);
  await group("What would you like to share?").getByText(/I built an API/).waitFor();
  check(await page.getByRole("button", { name: "Fill 2 selected fields", exact: true }).isEnabled(), true);
  await group("Full name").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Fill 3 selected fields", exact: true }).click();
  await page.getByRole("status").filter({ hasText: /2 filled/ }).waitFor();
  check(writes.length, 1);
  check(writes[0].values.map(field => field.fieldId).sort(), ["name", "project", "unknown"]);
  check(await page.getByRole("button", { name: "Selected fields checked", exact: true }).isEnabled(), false);
  check(await page.getByRole("status").filter({ hasText: /1.*kept/ }).count(), 1);
  await page.getByLabel("Working resume", { exact: true }).selectOption("00000000-0000-4000-8000-000000000099");
  check(await page.getByRole("link", { name: /Open.*Backend working resume/ }).getAttribute("href"), connection.origin + "/resumes/00000000-0000-4000-8000-000000000099");
  check(await page.getByText(/Attach.*yourself/).count() > 0, true);

  await page.screenshot({ path: "/tmp/resume-butler-a6-popup.png", fullPage: true });
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 740 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}px`);
  }
  await page.screenshot({ path: "/tmp/resume-butler-a6-popup-narrow.png", fullPage: true });

  await review(); revoked = true;
  await page.getByRole("button", { name: /Fill .*selected field/ }).click();
  await page.getByRole("status").filter({ hasText: /no longer approved/ }).waitFor();
  check(writes.length, 1, "a stale approval never reaches the form");
  revoked = false; failSource = true;
  await page.getByRole("button", { name: /Review fields|Review again/ }).click();
  await page.getByRole("status").filter({ hasText: /Connection unavailable/ }).waitFor();
  check(await page.getByRole("button", { name: "I applied to this", exact: true }).isEnabled(), true, "autofill failures must not disable capture");
  check(pageErrors, []);
  console.log(JSON.stringify({ checks, writes: writes.length, pageErrors, result: "pass", screenshots: ["/tmp/resume-butler-a6-popup.png", "/tmp/resume-butler-a6-popup-narrow.png"] }));
} finally { await browser.close(); }
