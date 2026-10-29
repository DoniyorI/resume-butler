import assert from "node:assert/strict";
import { test } from "node:test";

test("worker resumes the reconnected account and refuses stale legacy assignment", async () => {
  const state = {}, listeners = {}, alarms = new Set();
  const storage = {
    get: async key => Object.fromEntries((Array.isArray(key) ? key : [key]).filter(k => k in state).map(k => [k, structuredClone(state[k])])),
    set: async entries => Object.assign(state, structuredClone(entries)),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; },
  };
  globalThis.chrome = {
    storage: { local: storage, session: storage },
    runtime: { id: "test", getURL: x => `chrome-extension://test/${x}`, onMessage: { addListener: fn => { listeners.message = fn; } }, onMessageExternal: { addListener: fn => { listeners.external = fn; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    alarms: { create: name => alarms.add(name), clear: name => alarms.delete(name), onAlarm: { addListener: fn => { listeners.alarm = fn; } } },
    webRequest: { onCompleted: { addListener() {} } }, management: { getSelf: async () => ({ installType: "development" }) }, tabs: { create: async () => {}, sendMessage: async () => {} },
  };
  let offline = true;
  const sent = [];
  const saved = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/me")) return { ok: true, status: 200, json: async () => ({ userId: options.headers.Authorization.endsWith("A") ? "A" : "B" }) };
    if (url.includes("/opportunities")) {
      saved.push({ url, body: options.body && JSON.parse(options.body), authorization: options.headers.Authorization });
      return { ok: true, status: 200, json: async () => options.method === "POST" ? { opportunity: { id: "saved" } } : { resumes: [{ id: "resume-a", title: "Working copy" }] } };
    }
    sent.push(JSON.parse(options.body));
    if (offline) throw new Error("offline");
    return { ok: true, status: 201, json: async () => ({ application: { id: "recorded", company: "QA", role: "Engineer" }, created: true }) };
  };
  await import("../extension/background.js");
  const connect = token => new Promise(resolve => listeners.external({ type: "resume-butler:connect", token: `rbx_${token}` }, { url: "https://resume-butler.vercel.app/extension" }, resolve));
  const popup = message => new Promise(resolve => { if (!listeners.message(message, { id: "test", url: "chrome-extension://test/popup/popup.html" }, resolve)) resolve(null); });
  await connect("A");
  const job = { site: "greenhouse", jobId: "123", company: "QA", role: "Engineer", url: "https://boards.greenhouse.io/qa/jobs/123" };
  const accountA = (await popup({ type: "status" })).connection;
  const choices = await popup({ type: "capture-context", job, account: accountA });
  assert.deepEqual(choices?.resumes, [{ id: "resume-a", title: "Working copy" }]);
  const saveResult = await popup({ type: "save-job", job: { ...job, description: "Full posting text" }, resumeId: "resume-a", account: accountA });
  assert.equal(saveResult.opportunity.id, "saved");
  assert.equal(saved.at(-1).body.resumeId, "resume-a");
  assert.equal(saved.at(-1).body.jobDescription, "Full posting text");
  assert.equal(sent.length, 0, "saving must never call the application endpoint");
  assert.equal(state.queue?.length || 0, 0, "saving is not a queued submission");
  assert.equal((await popup({ type: "record", job })).status, "queued");
  await connect("B");
  const savedBefore = saved.length;
  assert.equal((await popup({ type: "save-job", job, account: accountA })).ok, false);
  assert.equal(saved.length, savedBefore, "stale popup cannot save into another account");
  const fromContent = await new Promise(resolve => { if (!listeners.message({ type: "capture-context", job, account: accountA }, { id: "test", tab: { id: 1 }, url: job.url }, resolve)) resolve(null); });
  assert.equal(fromContent?.resumes, undefined, "job site content scripts cannot request resume metadata");
  listeners.alarm({ name: "retry-queue" });
  await new Promise(resolve => setTimeout(resolve, 20));
  await connect("A");
  assert.ok(alarms.has("retry-queue"), "reconnection must restore automatic retries");
  const captured = structuredClone(state.queue[0]);
  offline = false;
  listeners.alarm({ name: "retry-queue" });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(state.queue.length, 0);
  assert.equal(sent.at(-1).eventId, captured.eventId);
  assert.equal(sent.at(-1).appliedDate, captured.appliedDate);
  assert.deepEqual(sent.at(-1), sent[0], "retry must send the original captured payload");
  state.queue = [{ ...job }];
  const displayed = (await popup({ type: "status" })).connection;
  await connect("B");
  assert.equal((await popup({ type: "adopt-legacy", account: displayed })).ok, false);
  assert.equal(state.queue[0].userId, undefined);
});
