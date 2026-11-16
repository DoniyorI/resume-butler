import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";

class Node {
  constructor() { this.children = []; this._text = ""; this.hidden = false; this.disabled = false; this.attrs = {}; this.style = {}; this.handlers = {}; this.value = ""; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this._text = String(value); this.children = []; }
  set innerHTML(_) { throw new Error("innerHTML must not be used"); }
  set outerHTML(_) { throw new Error("outerHTML must not be used"); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ""; this.children = nodes; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name]; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
}

const source = await readFile(new URL("../extension/popup/job-score.js", import.meta.url), "utf8");
const description = "Build backend services with Python and Docker for our platform team.";

async function setup(reply) {
  const nodes = new Map();
  const $ = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  $("capture-description").value = description;
  const context = {
    document: { getElementById: $, createElement: () => new Node(), createTextNode: text => { const n = new Node(); n.textContent = text; return n; } },
    chrome: { runtime: { lastError: null, sendMessage: (message, cb) => Promise.resolve(reply(message)).then(cb) } },
    globalThis: null,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  context.RB_jobScoreUi.bind({ account: { userId: "A" }, job: { tabContext: {} } });
  const run = async () => { await $("job-score-compare").onclick(); };
  return { $, run };
}

const baseFit = { band: "good", reason: "Most required skills are in your Master CV.", missing: [], listed: [], preferredMissing: [], notShown: null,
  years: { required: null, have: null, status: "not-stated" }, degree: { required: null, status: "not-stated" }, checks: [] };
const withFit = fit => ({ score: 50, totalKeywords: 4, matched: ["python"], missing: ["docker"], source: { type: "master-cv", id: null, title: "Master CV" }, fit });
const text = ui => ui.$("job-fit").hidden === false ? ui.$("job-fit-lines").textContent : "";

test("each band shows its chip text and the reason, with no percentage or meter", async () => {
  const expected = { strong: "Strong fit", good: "Good fit", stretch: "Stretch", low: "Low fit", unknown: "Not enough to tell" };
  for (const [band, label] of Object.entries(expected)) {
    const ui = await setup(() => withFit({ ...baseFit, band, reason: `Reason for ${band}` }));
    await ui.run();
    assert.equal(ui.$("job-fit-band").textContent, label);
    assert.equal(ui.$("job-fit-reason").textContent, `Reason for ${band}`);
    assert.equal(ui.$("job-fit").hidden, false);
    assert.equal(ui.$("job-keywords").hidden, true, "keyword percentage and meter are hidden in fit mode");
    assert.equal(ui.$("job-score-result").hidden, false);
    assert.doesNotMatch(ui.$("job-fit").textContent + ui.$("job-score-status").textContent, /%/);
  }
});

test("term lines appear only when non-empty", async () => {
  let ui = await setup(() => withFit(baseFit));
  await ui.run();
  assert.equal(text(ui), "");
  ui = await setup(() => withFit({ ...baseFit, missing: ["Kubernetes", "Go"], listed: ["AWS"], preferredMissing: ["Terraform"] }));
  await ui.run();
  const lines = text(ui);
  assert.match(lines, /Not in your Master CV: Kubernetes, Go/);
  assert.match(lines, /Listed without an example: AWS/);
  assert.match(lines, /Nice to have, not in your CV: Terraform/);
  ui = await setup(() => withFit({ ...baseFit, listed: ["AWS"] }));
  await ui.run();
  assert.doesNotMatch(text(ui), /Not in your Master CV|Nice to have/);
});

test("notShown: non-empty, empty and null cases", async () => {
  let ui = await setup(() => ({ ...withFit({ ...baseFit, notShown: ["Rust", "gRPC"] }), source: { type: "resume", id: "r", title: "Backend resume" } }));
  await ui.run();
  assert.match(text(ui), /Your selected resume leaves out: Rust, gRPC/);
  assert.match(ui.$("job-score-status").textContent, /Backend resume/);
  ui = await setup(() => withFit({ ...baseFit, notShown: [] }));
  await ui.run();
  assert.match(text(ui), /Your selected resume shows everything your Master CV backs\./);
  ui = await setup(() => withFit(baseFit));
  await ui.run();
  assert.doesNotMatch(text(ui), /selected resume/);
});

test("years and degree sentences", async () => {
  let ui = await setup(() => withFit({ ...baseFit, years: { required: 5, have: 3, status: "short" }, degree: { required: "Master's degree", status: "short" } }));
  await ui.run();
  assert.match(text(ui), /Asks for 5\+ years; your dated experience covers about 3 years\./);
  assert.match(text(ui), /Asks for a Master's degree, not shown in your education/);
  ui = await setup(() => withFit({ ...baseFit, years: { required: 4, have: null, status: "unknown" }, degree: { required: "PhD", status: "short", inProgress: true } }));
  await ui.run();
  assert.match(text(ui), /Asks for 4\+ years; add dates to your experience to compare\./);
  assert.match(text(ui), /Asks for a PhD, only in progress in your education/);
  ui = await setup(() => withFit({ ...baseFit, years: { required: 2, have: 6, status: "meets" }, degree: { required: "Bachelor's", status: "meets" } }));
  await ui.run();
  assert.doesNotMatch(text(ui), /Asks for/);
});

test("a required language the Master CV does not mention gets its own sentence", async () => {
  let ui = await setup(() => withFit({ ...baseFit, band: "low", language: { required: ["Korean", "Japanese"], missing: ["Korean"], status: "short" } }));
  await ui.run();
  assert.match(text(ui), /Asks for Korean, not mentioned in your Master CV/);
  assert.doesNotMatch(text(ui), /Japanese/);
  ui = await setup(() => withFit({ ...baseFit, language: { required: ["Korean"], missing: [], status: "meets" } }));
  await ui.run();
  assert.doesNotMatch(text(ui), /Korean/);
  // An older server sends no language field
  ui = await setup(() => withFit(baseFit));
  await ui.run();
  assert.doesNotMatch(text(ui), /not mentioned in your Master CV/);
});

test("checks are quoted verbatim with labels, and the footer is present", async () => {
  const kinds = { "work-authorization": "Work authorisation", clearance: "Clearance", citizenship: "Citizenship", onsite: "On-site", relocation: "Relocation", travel: "Travel", location: "Location", language: "Language" };
  const checks = Object.keys(kinds).map(kind => ({ kind, quote: `Quote for ${kind}, "exactly" & <b>so</b>` }));
  const ui = await setup(() => withFit({ ...baseFit, checks }));
  await ui.run();
  const lines = text(ui);
  assert.match(lines, /Only you can judge:/);
  for (const [kind, label] of Object.entries(kinds)) {
    assert.ok(lines.includes(`${label} “Quote for ${kind}, "exactly" & <b>so</b>”`), kind);
  }
});

test("unknown band shows only the chip and reason", async () => {
  const ui = await setup(() => withFit({ ...baseFit, band: "unknown", reason: "Too little detail.", missing: ["Go"], checks: [{ kind: "travel", quote: "Travel 50%" }] }));
  await ui.run();
  assert.equal(ui.$("job-fit-band").textContent, "Not enough to tell");
  assert.equal(ui.$("job-fit-lines").textContent, "");
});

test("footer text is in the markup", async () => {
  const html = await readFile(new URL("../extension/popup/popup.html", import.meta.url), "utf8");
  assert.ok(html.includes("Fit compares this posting with your Master CV. It is not a prediction of an interview."));
  assert.ok(html.includes("Check fit") && html.includes(">Fit<"));
});

test("falls back to keyword coverage when fit is missing or null", async () => {
  for (const fit of [undefined, null]) {
    const response = withFit(fit); if (fit === undefined) delete response.fit;
    const ui = await setup(() => response);
    await ui.run();
    assert.equal(ui.$("job-fit").hidden, true);
    assert.equal(ui.$("job-keywords").hidden, false);
    assert.equal(ui.$("job-score-value").textContent, "50%");
    assert.equal(ui.$("job-score-count").textContent, "1 of 4 recognized terms found");
    assert.equal(ui.$("job-score-missing").textContent, "docker");
    assert.equal(ui.$("job-score-method").textContent, "Keyword coverage");
  }
});

test("server and page text is rendered as text, never as HTML", async () => {
  const evil = "<img src=x onerror=alert(1)>";
  const ui = await setup(() => withFit({ ...baseFit, reason: evil, missing: [evil], listed: [evil], preferredMissing: [evil], notShown: [evil], checks: [{ kind: "clearance", quote: evil }] }));
  await ui.run(); // the stub throws if innerHTML/outerHTML is assigned
  assert.ok(text(ui).includes(evil));
  assert.equal(ui.$("job-fit-reason").textContent, evil);
});

test("a stale response is ignored", async () => {
  let release;
  const ui = await setup(() => new Promise(resolve => { release = () => resolve(withFit(baseFit)); }));
  const pending = ui.run();
  await new Promise(resolve => setImmediate(resolve));
  ui.$("capture-description").handlers.input(); // clear() bumps the generation
  release();
  await pending;
  assert.equal(ui.$("job-score-result").hidden, true);
  assert.equal(ui.$("job-fit-band").textContent, "", "stale fit was not rendered");
});
