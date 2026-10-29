import assert from "node:assert/strict";
import { test } from "node:test";
import { createAutofillReview } from "../extension/autofillReview.js";

const url = "https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply";
const answerId = "00000000-0000-4000-8000-000000000010";
const secondId = "00000000-0000-4000-8000-000000000011";
const answer = { id: answerId, revision: 3, label: "Project", question: "Describe a project.", answer: "I built an API.\nMeasured 25% improvement." };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function setup({ choices = [answer], fields } = {}) {
  const state = {
    account: { userId: "owner", origin: "https://resume-butler.vercel.app", token: "private-token" },
    tab: { id: 7, url }, time: 0, requests: [], sent: [], beforeApi: null, beforeTab: null, beforeAccount: null,
    context: { facts: { name: "Ada Lovelace", email: "ada@example.test", phone: "", linkedin: "", github: "", portfolio: "" }, profileFingerprint: "a".repeat(64), choices: choices.map(({ answer: body, ...metadata }) => metadata) },
    answers: structuredClone(choices),
    inventory: { ok: true, inventoryId: "inventory-one", url, title: "QA Engineer", manual: [{ label: "Location", reason: "Choose a suggestion." }], fields: fields || [
      { id: "name", label: "Full name", kind: "profile", sourceKey: "name", empty: true, maxLength: -1, multiline: false },
      { id: "email", label: "Email", kind: "profile", sourceKey: "email", empty: false, maxLength: -1, multiline: false },
      { id: "project", label: "Describe a project.✱", kind: "answer", empty: true, maxLength: -1, multiline: true },
    ] },
  };
  let nextId = 0;
  const review = createAutofillReview({
    connectedAccount: async () => { if (state.beforeAccount) await state.beforeAccount(); return structuredClone(state.account); },
    activeTab: async () => { if (state.beforeTab) await state.beforeTab(); return structuredClone(state.tab); },
    api: async (path, options = {}) => {
      state.requests.push({ path, options: structuredClone(options) });
      if (state.beforeApi) await state.beforeApi();
      if (options.method !== "POST") return structuredClone(state.context);
      if (options.body.profileFingerprint !== state.context.profileFingerprint) throw Object.assign(new Error("Contacts changed. Review again."), { status: 409 });
      const selected = options.body.answerSelections.map(item => {
        const found = state.answers.find(row => row.id === item.id && row.revision === item.revision);
        if (!found) throw Object.assign(new Error("Answer changed. Review again."), { status: 409 });
        return structuredClone(found);
      });
      return { facts: structuredClone(state.context.facts), profileFingerprint: state.context.profileFingerprint, answers: selected };
    },
    sendToTab: async (tabId, message) => {
      state.sent.push({ tabId, message: structuredClone(message) });
      return message.type === "autofill:scan" ? structuredClone(state.inventory)
        : { ok: true, outcomes: message.values.map(item => ({ fieldId: item.fieldId, status: "filled" })) };
    },
    now: () => state.time, randomId: () => `review-${++nextId}`,
  });
  const base = () => ({ account: { userId: "owner", origin: "https://resume-butler.vercel.app" }, tab: { id: 7, url } });
  return { state, review, base, async prepare() { const result = await review.prepare(base()); assert.equal(result.ok, true); return result.review; } };
}

test("review proposes only known facts and a unique exact approved question match", async () => {
  const { prepare, state } = setup();
  const plan = await prepare();
  assert.equal(plan.fields.find(field => field.id === "name").value, "Ada Lovelace");
  assert.equal(plan.fields.find(field => field.id === "project").value, answer.answer);
  assert.equal(plan.fields.find(field => field.id === "project").answerRevision, 3);
  assert.equal(plan.fields.find(field => field.id === "email").selected, false);
  assert.equal(JSON.stringify(plan).includes("private-token"), false);
  assert.equal(state.sent.filter(item => item.message.type === "autofill:apply").length, 0);
  assert.equal(JSON.stringify(state.sent).includes("ada@example.test"), false, "scanning must transmit no source facts");
});

test("ambiguous and semantically different questions need an explicit answer choice", async () => {
  const { prepare, review, base, state } = setup({ choices: [answer, { ...answer, id: secondId, label: "Another project", answer: "I built a compiler." }] });
  const plan = await prepare();
  assert.equal(plan.fields.find(field => field.id === "project").value, "");
  const selected = await review.selectAnswer({ ...base(), reviewId: plan.id, fieldId: "project", answerId: secondId });
  assert.equal(selected.field.value, "I built a compiler.");
  assert.equal(state.sent.filter(item => item.message.type === "autofill:apply").length, 0);
  const different = setup({ choices: [{ ...answer, question: "Describe a project you did not build." }] });
  assert.equal((await different.prepare()).fields.find(field => field.id === "project").value, "");
});

test("fill rechecks sources and sends only the explicitly selected value to its bound tab", async () => {
  const { prepare, review, base, state } = setup();
  const plan = await prepare();
  const result = await review.fill({ ...base(), reviewId: plan.id, fieldIds: ["project"] });
  assert.equal(result.outcomes[0].status, "filled");
  assert.deepEqual(state.sent.at(-1), { tabId: 7, message: { type: "autofill:apply", inventoryId: "inventory-one", expiresAt: 300000, values: [{ fieldId: "project", value: answer.answer }] } });
  const body = state.requests.at(-1).options.body;
  assert.deepEqual(body.answerSelections, [{ id: answerId, revision: 3 }]);
  await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds: ["project"] }));
  assert.equal(state.sent.filter(item => item.message.type === "autofill:apply").length, 1, "one review cannot write twice");
});

test("changed approvals and contacts stop filling without sending any values", async () => {
  for (const change of [state => { state.answers = []; }, state => { state.context.profileFingerprint = "b".repeat(64); }]) {
    const { prepare, review, base, state } = setup();
    const plan = await prepare(); change(state);
    await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name", "project"] }));
    assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
  }
});

test("an account or job change during a pending read cannot publish source data", async () => {
  for (const change of [state => { state.account.userId = "other"; }, state => { state.account.token = "rotated-token"; }, state => { state.tab.id = 8; }, state => { state.tab.url = url.replace("/qa/", "/other/"); }]) {
    const { review, base, state } = setup();
    const gate = deferred(); state.beforeApi = () => gate.promise;
    const pending = review.prepare(base());
    await new Promise(resolve => setImmediate(resolve));
    change(state); gate.resolve();
    await assert.rejects(pending);
    assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
  }
});

test("account changes while checking the active tab are caught before filling", async () => {
  const { prepare, review, base, state } = setup();
  const plan = await prepare();
  state.beforeTab = async () => { state.account.userId = "other"; };
  await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name"] }));
  assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
});

test("a changed tab while final source checks are pending never receives values", async () => {
  const { prepare, review, base, state } = setup();
  const plan = await prepare(), gate = deferred();
  state.beforeApi = () => gate.promise;
  const pending = review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name"] });
  await new Promise(resolve => setImmediate(resolve));
  state.tab.id = 8; gate.resolve();
  await assert.rejects(pending);
  assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
});

test("expiry, worker reset, malformed selections and overlapping operations cannot write", async () => {
  for (const invalidate of [state => { state.time = 300001; }, (_state, review) => review.clear()]) {
    const { prepare, review, base, state } = setup();
    const plan = await prepare(); invalidate(state, review);
    await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name"] }));
    assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
  }
  for (const fieldIds of [[], ["unknown"], ["name", "name"], ["email"]]) {
    const { prepare, review, base, state } = setup(); const plan = await prepare();
    await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds }));
    assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
  }
  const { prepare, review, base, state } = setup(); const plan = await prepare(), gate = deferred();
  state.beforeApi = () => gate.promise;
  const pending = review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name"] });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name"] }));
  await assert.rejects(review.selectAnswer({ ...base(), reviewId: plan.id, fieldId: "project", answerId: answerId }));
  gate.resolve(); await pending;
  assert.equal(state.sent.filter(item => item.message.type === "autofill:apply").length, 1);
});

test("tab invalidation during the final account read cancels the pending fill", async () => {
  const { prepare, review, base, state } = setup(); const plan = await prepare();
  let accountReads = 0;
  state.beforeAccount = async () => {
    if (++accountReads === 2) { state.tab.id = 8; review.invalidateTab?.(7); }
  };
  await assert.rejects(review.fill({ ...base(), reviewId: plan.id, fieldIds: ["name"] }));
  assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
});

test("crossing the review deadline during fill or copy source reads never releases values", async () => {
  for (const operation of ["fill", "copyField"]) {
    const { prepare, review, base, state } = setup(); const plan = await prepare();
    state.beforeApi = async () => { state.time = 300001; };
    await assert.rejects(review[operation]({ ...base(), reviewId: plan.id, fieldId: "name", fieldIds: ["name"] }));
    assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
  }
});

test("navigation invalidates a pending prepare even before it has a saved review", async () => {
  const { review, base, state } = setup(), gate = deferred();
  state.beforeApi = () => gate.promise;
  const pending = review.prepare(base());
  await new Promise(resolve => setImmediate(resolve));
  review.invalidateTab?.(7); gate.resolve();
  await assert.rejects(pending);
});

test("an explicit copy fallback also checks that the selected version remains approved", async () => {
  const { prepare, review, base, state } = setup(); const plan = await prepare();
  assert.equal((await review.copyField({ ...base(), reviewId: plan.id, fieldId: "project" })).value, answer.answer);
  state.answers = [];
  await assert.rejects(review.copyField({ ...base(), reviewId: plan.id, fieldId: "project" }));
  assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
});

test("unsupported hosts, pending navigation and mismatched inventories do not fetch or fill", async () => {
  for (const mutate of [
    state => { state.tab.url = "https://jobs.lever.co.evil.example/qa/role/apply"; },
    state => { state.tab.pendingUrl = "https://different.example.test"; },
    state => { state.inventory.url = url.replace("/qa/", "/other/"); },
  ]) {
    const { review, base, state } = setup(); mutate(state);
    await assert.rejects(review.prepare({ ...base(), tab: structuredClone(state.tab) }));
    assert.equal(state.sent.some(item => item.message.type === "autofill:apply"), false);
  }
});
