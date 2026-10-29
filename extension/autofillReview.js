// Private, short-lived review state for the MV3 worker. No source values are
// persisted, and only explicitly selected values cross into a job-site script.
const PROFILE_KEYS = ["name", "email", "phone", "linkedin", "github", "portfolio"];
const REVIEW_MS = 5 * 60 * 1000;
const sameAccount = (a, b) => a && b && a.userId === b.userId && a.origin === b.origin && a.token === b.token;
const sameTab = (a, b) => a && b && a.id === b.id && a.url === b.url && (!a.pendingUrl || a.pendingUrl === b.url);
const questionKey = value => value.normalize("NFKC").replace(/\s+/g, " ").trim().replace(/\s*[✱*]$/u, "").trim().toLowerCase();
const expired = () => new Error("This review expired or changed. Review the fields again.");

function supportedTab(tab) {
  try {
    const url = new URL(tab.url);
    return Number.isInteger(tab.id) && !url.username && !url.password && url.origin === "https://jobs.lever.co" &&
      /^\/[^/]+\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\/apply\/?$/i.test(url.pathname) && (!tab.pendingUrl || tab.pendingUrl === tab.url);
  } catch { return false; }
}

function validateContext(context, scan, tab) {
  if (!/^[a-f0-9]{64}$/.test(context?.profileFingerprint) || PROFILE_KEYS.some(key => typeof context?.facts?.[key] !== "string" || context.facts[key].length > 2048) ||
      !Array.isArray(context.choices) || context.choices.length > 100 || context.choices.some(item => typeof item.id !== "string" || typeof item.label !== "string" || typeof item.question !== "string" || !Number.isInteger(item.revision) || item.revision < 1)) throw expired();
  if (!scan?.ok || scan.url !== tab.url || typeof scan.inventoryId !== "string" || !Array.isArray(scan.fields) || scan.fields.length > 100 ||
      new Set(scan.fields.map(field => field.id)).size !== scan.fields.length || scan.fields.some(field =>
        typeof field.id !== "string" || typeof field.label !== "string" || !field.label || field.label.length > 1000 || typeof field.empty !== "boolean" || typeof field.multiline !== "boolean" ||
        !Number.isInteger(field.maxLength) || field.maxLength < -1 || !["profile", "answer"].includes(field.kind) || field.kind === "profile" && !PROFILE_KEYS.includes(field.sourceKey)) ||
      !Array.isArray(scan.manual) || scan.manual.length > 100 || scan.manual.some(field => typeof field.label !== "string" || typeof field.reason !== "string")) throw expired();
}

function publicField(field) {
  const reason = !field.empty ? "Existing value kept" : !field.value ? (field.kind === "profile" ? "Add this detail to your Master CV" : "Choose an approved answer, or complete manually")
    : field.maxLength >= 0 && field.value.length > field.maxLength ? "Too long for this field; copy and edit manually"
    : !field.multiline && /[\r\n]/.test(field.value) ? "This field needs one line; copy and edit manually" : "";
  return { id: field.id, label: field.label, kind: field.kind, value: field.value, empty: field.empty, sourceLabel: field.sourceLabel,
    answerId: field.answerId || "", answerRevision: field.answerRevision || null, selected: Boolean(field.value && !reason), reason };
}

export function createAutofillReview({ api, connectedAccount, activeTab, sendToTab, now = Date.now, randomId = () => crypto.randomUUID() }) {
  const reviews = new Map(), preparing = new Set();
  let epoch = 0;
  const clear = () => { epoch++; reviews.clear(); preparing.clear(); };
  const invalidateTab = tabId => {
    if ([...preparing].some(item => item.tabId === tabId) || [...reviews.values()].some(plan => plan.tab.id === tabId)) clear();
  };

  async function assertContext(account, tab, version, expiresAt = Infinity) {
    // Read the account after checking the tab so a reconnect during that check
    // cannot return the old account's source data. The page also checks its own
    // URL/document/form immediately before each write.
    const currentTab = await activeTab();
    const current = await connectedAccount();
    if (now() >= expiresAt || epoch !== version || !sameAccount(current, account) || !sameTab(currentTab, tab)) throw expired();
  }

  const publicReview = plan => ({ id: plan.id, url: plan.tab.url, title: plan.title, expiresAt: plan.expiresAt,
    fields: plan.fields.map(publicField), choices: plan.choices, manual: plan.manual });

  async function sources(plan, fields) {
    const selections = [...new Map(fields.filter(field => field.answerId).map(field => [field.answerId, { id: field.answerId, revision: field.answerRevision }])).values()];
    const result = await api("/api/extension/autofill", { method: "POST", expectedAccount: plan.account,
      body: { profileFingerprint: plan.profileFingerprint, answerSelections: selections } });
    await assertContext(plan.account, plan.tab, plan.epoch, plan.expiresAt);
    if (result.profileFingerprint !== plan.profileFingerprint || !Array.isArray(result.answers)) throw expired();
    return result;
  }

  async function verifiedSources(plan, fields) {
    const result = await sources(plan, fields);
    for (const field of fields) {
      if (field.kind === "profile") {
        if (result.facts?.[field.sourceKey] !== field.value) throw expired();
      } else {
        const answer = result.answers.find(item => item.id === field.answerId && item.revision === field.answerRevision);
        const choice = plan.choices.find(item => item.id === field.answerId);
        if (!answer || answer.answer !== field.value || answer.question !== choice?.question || answer.label !== choice?.label) throw expired();
      }
    }
    return result;
  }

  async function withReview(message, operation) {
    const plan = reviews.get(message.reviewId);
    if (!plan || now() >= plan.expiresAt) { reviews.delete(message.reviewId); throw expired(); }
    if (plan.busy) throw new Error("A review action is still running. Wait for its result.");
    plan.busy = true;
    try {
      if (message.account?.userId !== plan.account.userId || message.account?.origin !== plan.account.origin || !sameTab(message.tab, plan.tab)) throw expired();
      await assertContext(plan.account, plan.tab, plan.epoch, plan.expiresAt);
      return await operation(plan);
    } catch (error) { reviews.delete(plan.id); throw error; }
    finally { plan.busy = false; }
  }

  async function prepare(message) {
    if (!supportedTab(message.tab)) throw expired();
    const version = epoch, watch = { tabId: message.tab.id };
    preparing.add(watch);
    try {
      const account = await connectedAccount();
      if (message.account?.userId !== account.userId || message.account?.origin !== account.origin) throw expired();
      await assertContext(account, message.tab, version);
      const [context, scan] = await Promise.all([
        api("/api/extension/autofill", { expectedAccount: account }),
        sendToTab(message.tab.id, { type: "autofill:scan" }),
      ]);
      await assertContext(account, message.tab, version);
      validateContext(context, scan, message.tab);
      const plan = { id: randomId(), account, tab: { id: message.tab.id, url: message.tab.url }, epoch: version,
        inventoryId: scan.inventoryId, profileFingerprint: context.profileFingerprint, title: typeof scan.title === "string" ? scan.title.slice(0, 250) : "Lever application",
        expiresAt: now() + REVIEW_MS, choices: context.choices.map(({ id, label, question, revision }) => ({ id, label, question, revision })),
        manual: scan.manual.map(({ label, reason }) => ({ label, reason })), fields: [], busy: false, consumed: false };
      plan.fields = scan.fields.map(field => {
        const matches = field.kind === "answer" && field.empty ? plan.choices.filter(choice => questionKey(choice.question) === questionKey(field.label)) : [];
        return { ...field, value: field.kind === "profile" ? context.facts[field.sourceKey] : "", sourceLabel: field.kind === "profile" ? "Master CV" : "",
          ...(matches.length === 1 && { answerId: matches[0].id, answerRevision: matches[0].revision, sourceLabel: matches[0].label }) };
      });
      const defaults = plan.fields.filter(field => field.answerId);
      if (defaults.length) {
        const result = await sources(plan, defaults);
        for (const field of defaults) {
          const current = result.answers.find(item => item.id === field.answerId && item.revision === field.answerRevision);
          const choice = plan.choices.find(item => item.id === field.answerId);
          if (!current || current.question !== choice.question || current.label !== choice.label || typeof current.answer !== "string" || !current.answer || current.answer.length > 10000) throw expired();
          field.value = current.answer;
        }
      }
      await assertContext(account, plan.tab, version, plan.expiresAt);
      for (const [id, previous] of reviews) if (previous.tab.id === plan.tab.id || now() >= previous.expiresAt) reviews.delete(id);
      while (reviews.size >= 4) reviews.delete(reviews.keys().next().value);
      reviews.set(plan.id, plan);
      return { ok: true, review: publicReview(plan) };
    } finally { preparing.delete(watch); }
  }

  const selectAnswer = message => withReview(message, async plan => {
    if (plan.consumed) throw expired();
    const field = plan.fields.find(item => item.id === message.fieldId);
    const choice = plan.choices.find(item => item.id === message.answerId);
    if (!field || field.kind !== "answer" || !field.empty || message.answerId && !choice) throw expired();
    if (!message.answerId) Object.assign(field, { value: "", answerId: "", answerRevision: null, sourceLabel: "" });
    else {
      const candidate = { ...field, answerId: choice.id, answerRevision: choice.revision };
      const result = await sources(plan, [candidate]);
      const current = result.answers.find(item => item.id === choice.id && item.revision === choice.revision);
      if (!current || current.question !== choice.question || current.label !== choice.label || typeof current.answer !== "string" || !current.answer || current.answer.length > 10000) throw expired();
      Object.assign(field, { value: current.answer, answerId: choice.id, answerRevision: choice.revision, sourceLabel: choice.label });
    }
    return { ok: true, field: publicField(field) };
  });

  const fill = message => withReview(message, async plan => {
    if (plan.consumed || !Array.isArray(message.fieldIds) || !message.fieldIds.length || message.fieldIds.length > 50 || new Set(message.fieldIds).size !== message.fieldIds.length) throw expired();
    const fields = message.fieldIds.map(id => plan.fields.find(field => field.id === id));
    if (fields.some(field => !field || !publicField(field).selected)) throw expired();
    plan.consumed = true;
    await verifiedSources(plan, fields);
    const result = await sendToTab(plan.tab.id, { type: "autofill:apply", inventoryId: plan.inventoryId, expiresAt: plan.expiresAt, values: fields.map(field => ({ fieldId: field.id, value: field.value })) });
    if (!result?.ok || !Array.isArray(result.outcomes)) throw new Error(result?.error || "The form could not be checked. Review it again; existing input is kept.");
    return result;
  });

  const copyField = message => withReview(message, async plan => {
    const field = plan.fields.find(item => item.id === message.fieldId);
    if (!field?.value) throw expired();
    await verifiedSources(plan, [field]);
    return { ok: true, value: field.value };
  });

  return { prepare, selectAnswer, fill, copyField, clear, invalidateTab };
}
