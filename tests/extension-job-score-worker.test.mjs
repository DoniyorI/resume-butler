import assert from "node:assert/strict";
import { test } from "node:test";

test("job comparison is popup-only and rejects account, token or active-tab changes", async () => {
  const state = {}, listeners = {}, requests = [];
  const url = "https://www.linkedin.com/jobs/view/4484740117/";
  let tab = { id: 7, url }, afterFetch = () => {};
  const storage = {
    get: async key => ({ [key]: structuredClone(state[key]) }),
    set: async values => Object.assign(state, structuredClone(values)),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; },
  };
  globalThis.chrome = {
    storage: { local: storage, session: storage },
    runtime: { id: "test", getURL: p => `chrome-extension://test/${p}`, onMessage: { addListener: f => { listeners.message = f; } }, onMessageExternal: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } }, webRequest: { onCompleted: { addListener() {} } },
    tabs: { query: async () => [tab], sendMessage: async () => {} },
  };
  const connection = { userId: "A", origin: "https://resume-butler.vercel.app", token: "rbx_private" };
  state.connection = { ...connection };
  globalThis.fetch = async (endpoint, options) => {
    requests.push({ endpoint, body: JSON.parse(options.body) });
    afterFetch();
    return { ok: true, status: 200, json: async () => ({ score: 50, matched: ["python"], missing: ["docker"], totalKeywords: 2, source: { type: "master-cv", title: "Master CV", id: null } }) };
  };
  await import("../extension/background.js");
  const base = { type: "job-score", account: { userId: "A", origin: connection.origin }, tab: { id: 7, url }, jobDescription: "Python and Docker backend services", resumeId: null };
  const dispatch = (message, sender) => new Promise(resolve => { if (!listeners.message(message, sender, resolve)) resolve(null); });
  const popup = message => dispatch(message, { id: "test", url: "chrome-extension://test/popup/popup.html" });
  assert.equal(await dispatch(base, { id: "test", tab, url }), null);
  assert.equal(requests.length, 0);
  assert.equal((await popup(base))?.score, 50);
  assert.deepEqual(requests[0].body, { jobDescription: base.jobDescription, resumeId: null });
  afterFetch = () => { state.connection.token = "rbx_replaced"; };
  assert.equal((await popup(base))?.ok, false);
  state.connection = { ...connection };
  afterFetch = () => { tab = { id: 8, url }; };
  assert.equal((await popup(base))?.ok, false);
  tab = { id: 7, url }; afterFetch = () => { delete state.connection; };
  assert.equal((await popup(base))?.ok, false);
  assert.equal(JSON.stringify(state).includes("python"), false);
  state.connection = { ...connection };
  const key = "linkedin:www.linkedin.com:4484740117";
  const job = { site: "linkedin", jobId: "4484740117", company: "Fixture", role: "Engineer", url, description: "Full posting details", salary: { min: 200000, max: 230000, currency: "USD", period: "year" }, location: "Remote" };
  await dispatch({ type: "job-seen", key, job }, { id: "test", tab: { id: 7 }, frameId: 0, url });
  await dispatch({ type: "job-seen", key, job: { ...job, description: "", salary: null, location: "" } }, { id: "test", tab: { id: 7 }, frameId: 0, url });
  assert.equal(state.jobs[key].description, job.description);
  assert.deepEqual(state.jobs[key].salary, job.salary);
  assert.equal(state.jobs[key].location, "Remote");
});
