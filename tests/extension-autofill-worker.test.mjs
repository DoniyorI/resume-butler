import assert from "node:assert/strict";
import { test } from "node:test";

test("only the trusted popup can preview or fill; the worker targets the top frame without persisting values", async () => {
  const state = {}, listeners = {}, calls = [], requests = [];
  const url = "https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply";
  const storage = {
    get: async key => Object.fromEntries((Array.isArray(key) ? key : [key]).filter(k => k in state).map(k => [k, structuredClone(state[k])])),
    set: async entries => Object.assign(state, structuredClone(entries)),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; },
  };
  globalThis.chrome = {
    storage: { local: storage, session: storage, onChanged: { addListener: fn => { listeners.connectionChanged = fn; } } },
    windows: { onFocusChanged: { addListener: fn => { listeners.focusChanged = fn; } } },
    runtime: { id: "test", getURL: path => `chrome-extension://test/${path}`, onMessage: { addListener: fn => { listeners.message = fn; } }, onMessageExternal: { addListener: fn => { listeners.external = fn; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } }, webRequest: { onCompleted: { addListener() {} } },
    management: { getSelf: async () => ({ installType: "development" }) },
    tabs: { onActivated: { addListener: fn => { listeners.activated = fn; } }, onUpdated: { addListener: fn => { listeners.updated = fn; } }, onRemoved: { addListener: fn => { listeners.removed = fn; } }, create: async () => {}, query: async () => [{ id: 7, url }], sendMessage: async (tabId, message, options) => {
      calls.push({ tabId, message, options });
      return message.type === "autofill:scan" ? { ok: true, inventoryId: "inventory", url, fields: [{ id: "name", label: "Full name", kind: "profile", sourceKey: "name", empty: true, maxLength: -1, multiline: false }], manual: [] }
        : { ok: true, outcomes: [{ fieldId: "name", status: "filled" }] };
    } },
  };
  const source = { facts: { name: "Ada Lovelace", email: "ada@example.test", phone: "", linkedin: "", github: "", portfolio: "" }, profileFingerprint: "a".repeat(64), choices: [] };
  globalThis.fetch = async (endpoint, options = {}) => {
    requests.push(endpoint);
    return { ok: true, status: 200, json: async () => endpoint.endsWith("/me") ? { userId: "A" }
      : options.method === "POST" ? { ...source, answers: [] } : source };
  };
  await import("../extension/background.js");
  await new Promise(resolve => listeners.external({ type: "resume-butler:connect", token: "rbx_A" }, { url: "https://resume-butler.vercel.app/extension" }, resolve));
  const base = { account: { userId: "A", origin: "https://resume-butler.vercel.app" }, tab: { id: 7, url } };
  const dispatch = (message, sender) => new Promise(resolve => { if (!listeners.message(message, sender, resolve)) resolve(null); });
  const popup = message => dispatch(message, { id: "test", url: "chrome-extension://test/popup/popup.html" });
  for (const type of ["autofill-prepare", "autofill-select", "autofill-fill", "autofill-copy"]) {
    assert.equal(await dispatch({ type, ...base }, { id: "test", tab: { id: 7 }, frameId: 0, url }), null);
    assert.equal(await dispatch({ type, ...base }, { id: "other", url: "chrome-extension://test/popup/popup.html" }), null);
  }
  assert.equal(requests.filter(endpoint => endpoint.includes("autofill")).length, 0);
  const prepared = await popup({ type: "autofill-prepare", ...base });
  assert.equal(prepared?.ok, true);
  assert.equal(prepared.review.fields[0].value, "Ada Lovelace");
  assert.equal(JSON.stringify(prepared).includes("rbx_A"), false);
  const result = await popup({ type: "autofill-fill", ...base, reviewId: prepared.review.id, fieldIds: ["name"] });
  assert.equal(result?.outcomes[0].status, "filled");
  assert.deepEqual(calls.at(-1), { tabId: 7, message: { type: "autofill:apply", inventoryId: "inventory", expiresAt: prepared.review.expiresAt, values: [{ fieldId: "name", value: "Ada Lovelace" }] }, options: { frameId: 0 } });
  assert.equal(JSON.stringify(state).includes("Ada Lovelace"), false);
  assert.equal(JSON.stringify(state).includes("ada@example.test"), false);
  assert.equal(state.queue?.length || 0, 0, "autofill is never a queued submission");
  for (const invalidate of [
    () => listeners.activated({ tabId: 8, windowId: 1 }),
    () => listeners.updated(7, { status: "loading" }),
    () => listeners.removed(7),
    () => listeners.focusChanged(2),
    () => listeners.connectionChanged({ connection: { newValue: {} } }, "local"),
  ]) {
    const next = await popup({ type: "autofill-prepare", ...base });
    invalidate();
    const before = calls.filter(call => call.message.type === "autofill:apply").length;
    assert.equal((await popup({ type: "autofill-fill", ...base, reviewId: next.review.id, fieldIds: ["name"] }))?.ok, false);
    assert.equal(calls.filter(call => call.message.type === "autofill:apply").length, before);
  }
  await popup({ type: "disconnect" });
  assert.equal((await popup({ type: "autofill-copy", ...base, reviewId: prepared.review.id, fieldId: "name" }))?.ok, false);
});
