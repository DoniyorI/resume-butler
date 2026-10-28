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
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/me")) return { ok: true, status: 200, json: async () => ({ userId: options.headers.Authorization.endsWith("A") ? "A" : "B" }) };
    sent.push(JSON.parse(options.body));
    if (offline) throw new Error("offline");
    return { ok: true, status: 201, json: async () => ({ application: { id: "recorded", company: "QA", role: "Engineer" }, created: true }) };
  };
  await import("../extension/background.js");
  const connect = token => new Promise(resolve => listeners.external({ type: "resume-butler:connect", token: `rbx_${token}` }, { url: "https://resume-butler.vercel.app/extension" }, resolve));
  const popup = message => new Promise(resolve => listeners.message(message, { id: "test", url: "chrome-extension://test/popup/popup.html" }, resolve));
  await connect("A");
  const job = { site: "greenhouse", jobId: "123", company: "QA", role: "Engineer", url: "https://boards.greenhouse.io/qa/jobs/123" };
  assert.equal((await popup({ type: "record", job })).status, "queued");
  await connect("B");
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
