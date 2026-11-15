import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const user = "11111111-1111-4111-8111-111111111111";
const resume = "22222222-2222-4222-8222-222222222222";
const url = "https://boards.greenhouse.io/acme/jobs/123";
const load = () => import("../src/server/opportunities/service.js");

function storedDb() {
  const db = database({
    resumes: [{ id: resume, user_id: user, title: "Chosen" }],
    job_opportunities: [{ id: "job", user_id: user, identity_key: "greenhouse:acme:123", resume_id: resume,
      payload: { company: "Acme", role: "Staff Engineer", location: "Berlin", job_description: "Full text", workplace_type: "hybrid" } }],
  });
  db.saved = null;
  db.rpc = async (name, args) => { db.saved = args; return { data: { id: "11111111-1111-4111-8111-111111111112" }, error: null }; };
  return db;
}

test("an extension capture without a resume keeps the stored resume", async () => {
  const { saveOpportunity, opportunityInput } = await load();
  const db = storedDb();
  await saveOpportunity(db, user, opportunityInput.parse({ company: "Acme", role: "Staff Engineer", url, detectedBy: "greenhouse", postingId: "123" }), { keepStored: true });
  assert.equal(db.saved.p_resume_id, resume);
});

test("an extension capture with blank role or location keeps the stored ones", async () => {
  const { saveOpportunity, opportunityInput } = await load();
  const db = storedDb();
  await saveOpportunity(db, user, opportunityInput.parse({ company: "Acme", role: "", location: "", url, detectedBy: "greenhouse", postingId: "123" }), { keepStored: true });
  assert.equal(db.saved.p_payload.role, "Staff Engineer");
  assert.equal(db.saved.p_payload.location, "Berlin");
  assert.equal(db.saved.p_payload.job_description, "Full text");
  assert.equal(db.saved.p_payload.workplace_type, "hybrid");
  // The web editor is authoritative: it may clear a field
  await saveOpportunity(db, user, opportunityInput.parse({ company: "Acme", role: "", location: "", url, detectedBy: "greenhouse", postingId: "123", resumeId: null }));
  assert.equal(db.saved.p_payload.role, "");
  assert.equal(db.saved.p_resume_id, null);
});

test("the worker leaves resumeId out of a save when the popup did not change it", async () => {
  const listeners = {}, state = {}, bodies = [];
  const storage = {
    get: async key => Object.fromEntries((Array.isArray(key) ? key : [key]).filter(k => k in state).map(k => [k, structuredClone(state[k])])),
    set: async entries => Object.assign(state, structuredClone(entries)),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; },
  };
  globalThis.chrome = {
    storage: { local: storage, session: storage },
    runtime: { id: "test", getURL: x => `chrome-extension://test/${x}`, onMessage: { addListener: fn => { listeners.message = fn; } }, onMessageExternal: { addListener: fn => { listeners.external = fn; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
    webRequest: { onCompleted: { addListener() {} } }, management: { getSelf: async () => ({ installType: "development" }) }, tabs: { create: async () => {}, sendMessage: async () => {} },
  };
  globalThis.fetch = async (u, options) => {
    if (u.endsWith("/me")) return { ok: true, status: 200, json: async () => ({ userId: "A" }) };
    bodies.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ opportunity: { id: "saved" } }) };
  };
  await import("../extension/background.js");
  await new Promise(resolve => listeners.external({ type: "resume-butler:connect", token: "rbx_A" }, { url: "https://resume-butler.vercel.app/extension" }, resolve));
  const popup = message => new Promise(resolve => { if (!listeners.message(message, { id: "test", url: "chrome-extension://test/popup/popup.html" }, resolve)) resolve(null); });
  const account = (await popup({ type: "status" })).connection;
  const job = { site: "greenhouse", jobId: "123", company: "QA", role: "Engineer", url: "https://boards.greenhouse.io/qa/jobs/123" };
  await popup({ type: "save-job", job, account });
  assert.equal("resumeId" in bodies.at(-1), false, "no resume in the capture means no resumeId in the request");
  await popup({ type: "save-job", job, account, resumeId: null });
  assert.equal(bodies.at(-1).resumeId, null, "an explicit clear still reaches the server");
});

test("the popup sends a resume only when the user changed the choice", async () => {
  const elements = new Map(), sent = [];
  const node = id => {
    if (!elements.has(id)) elements.set(id, { onclick: null, value: "", addEventListener() {}, replaceChildren() {}, add() {} });
    return elements.get(id);
  };
  const job = { company: "QA", role: "Engineer", url };
  vm.runInNewContext(await readFile(new URL("../extension/popup/popup.js", import.meta.url), "utf8"), {
    document: { getElementById: node }, Date, window: { close() {} }, Option: function Option(label, value) { return { label, value }; },
    chrome: {
      runtime: { sendMessage: (message, callback) => {
        sent.push(message);
        if (message.type === "status") callback({ connection: { userId: "A", origin: "http://localhost:3000" }, recent: [] });
        if (message.type === "capture-context") callback({ resumes: [{ id: resume, title: "Chosen" }], opportunity: { resume_id: resume, payload: { company: "QA" } } });
        if (message.type === "save-job") callback({ ok: true });
      } },
      tabs: { query: async () => [{ id: 1 }], sendMessage: (id, message, cb) => cb(job) },
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  await node("save-job").onclick();
  assert.equal(sent.findLast(m => m.type === "save-job").resumeId, undefined, "unchanged choice is not resent");
  node("resume-choice").value = "";
  await node("save-job").onclick();
  assert.equal(sent.findLast(m => m.type === "save-job").resumeId, null, "choosing decide later clears it");
});
