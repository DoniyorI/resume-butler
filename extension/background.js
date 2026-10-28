import { createIngestionQueue } from "./ingestionQueue.js";

// Resume Butler extension: background service worker.
//
// Content scripts on job sites report jobs they see and applications they see
// submitted; this worker sends them to the app with the token the app handed
// over when the extension was connected (content/app-bridge.js), retries when
// offline, and keeps a short list of recent additions for undo.
//
// chrome.storage.local:   connection { token, origin, name, email },
//                         recent [{ id, company, role, addedAt }],
//                         queue [job], reported { jobKey: timestamp }
// chrome.storage.session: jobs { jobKey: job } (postings seen this session,
//                         so the confirmation page can be matched to its job)

const PRODUCTION_ORIGIN = "https://resume-butler.vercel.app";
// The local app is trusted only by unpacked (development) installs, so a
// server on someone's localhost can't pose as the app in a published build
const LOCAL_ORIGIN = "http://localhost:3000";
// A submission counts only if the user clicked submit for that job recently
const SUBMIT_CLICK_WINDOW_MS = 2 * 60 * 60 * 1000;
const RECENT_LIMIT = 10;
// A confirmation page can be reloaded or revisited; report each job once a day
const REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RETRY_ALARM = "retry-queue";

// --- Storage helpers ---

async function getLocal(key, fallback) {
  const value = (await chrome.storage.local.get(key))[key];
  return value === undefined ? fallback : value;
}

const setLocal = (values) => chrome.storage.local.set(values);
const ingestionQueue = createIngestionQueue({ storage: chrome.storage.local });

// --- Talking to the app ---

class NotConnectedError extends Error {}

async function api(path, { method = "GET", body, expectedAccount } = {}) {
  const connection = await getLocal("connection", null);
  if (!connection || expectedAccount && (connection.userId !== expectedAccount.userId || connection.origin !== expectedAccount.origin)) throw new NotConnectedError("Connect the account this submission belongs to");
  const response = await fetch(connection.origin + path, {
    method,
    headers: {
      Authorization: `Bearer ${connection.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    // Disconnected from the app (or never connected): forget the token
    if ((await getLocal("connection", null))?.token === connection.token) await chrome.storage.local.remove("connection");
    throw new NotConnectedError(data.error || "Not connected");
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

async function isDevelopmentInstall() {
  const self = await chrome.management.getSelf();
  return self.installType === "development";
}

async function trustedOrigin(origin) {
  if (origin === PRODUCTION_ORIGIN) return true;
  return origin === LOCAL_ORIGIN && (await isDevelopmentInstall());
}

// The token from the app's /extension page: keep it only if the app accepts it
async function connect(token, origin) {
  if (!(await trustedOrigin(origin)) || typeof token !== "string" || !token.startsWith("rbx_")) {
    return { ok: false };
  }
  const response = await fetch(origin + "/api/extension/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return { ok: false };
  const me = await response.json();
  if (!me.userId) return { ok: false };
  const previous = await getLocal("connection", null);
  if (previous?.userId !== me.userId || previous?.origin !== origin) await setLocal({ recent: [], reported: {} });
  await setLocal({ connection: { token, origin, userId: me.userId, name: me.name || "", email: me.email || "" } });
  chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
  return { ok: true };
}

async function connectedAccount() {
  const connection = await getLocal("connection", null);
  if (!connection) throw new NotConnectedError("Connect first");
  if (connection.userId) return connection;
  const me = await api("/api/extension/me");
  if (!me.userId) throw new NotConnectedError("Update the app connection before tracking");
  const current = await getLocal("connection", null);
  if (current?.token !== connection.token) throw new NotConnectedError("Your connected account changed");
  const refreshed = { ...connection, userId: me.userId };
  await setLocal({ connection: refreshed });
  return refreshed;
}

// --- Recording applications ---

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toPayload(job) {
  return {
    eventId: job.eventId,
    postingId: job.jobId || undefined,
    company: job.company,
    role: job.role || "",
    location: job.location || "",
    url: job.url || "",
    jobDescription: job.description || "",
    appliedDate: job.appliedDate || localDate(),
    detectedBy: job.site || "",
    salary: job.salary || null,
    employmentType: job.employmentType || "",
    workplaceType: job.workplaceType || "",
  };
}

async function remember(application) {
  const recent = await getLocal("recent", []);
  const next = [
    { id: application.id, company: application.company, role: application.role, addedAt: Date.now() },
    ...recent.filter((item) => item.id !== application.id),
  ].slice(0, RECENT_LIMIT);
  await setLocal({ recent: next });
}

// Send one job to the app. Returns { status: "added" | "updated" | "queued" |
// "not-connected" | "error", application?, error? }
async function record(job, expectedAccount) {
  try {
    const account = await connectedAccount();
    if (expectedAccount && (account.userId !== expectedAccount.userId || account.origin !== expectedAccount.origin)) throw new NotConnectedError("Your connected account changed. Review before recording.");
    const entry = await ingestionQueue.captureSubmission({ ...account, job });
    chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
    return await sendEntry(entry);
  } catch (error) {
    return { status: error instanceof NotConnectedError ? "not-connected" : "error", error: error.message };
  }
}

async function sendEntry(entry) {
  try {
    const { application, created } = await api("/api/extension/applications", {
      method: "POST", expectedAccount: entry,
      body: toPayload({ ...entry.job, appliedDate: entry.appliedDate, eventId: entry.eventId }),
    });
    await ingestionQueue.acknowledge(entry);
    const current = await getLocal("connection", null);
    if (created && current?.userId === entry.userId && current?.origin === entry.origin) await remember(application);
    return { status: created ? "added" : "updated", application };
  } catch (error) {
    if (error instanceof NotConnectedError) return { status: "not-connected", error: error.message };
    if (error.code === "needs_matching") {
      await ingestionQueue.pause(entry, "needs_matching");
      return { status: "needs-matching", error: "Saved for review. Choose the matching application in Resume Butler." };
    }
    if (!error.status || error.status >= 500 || error.status === 429) return { status: "queued" };
    await ingestionQueue.pause(entry, "blocked");
    return { status: "error", error: error.message };
  }
}

async function retryQueue() {
  const account = await connectedAccount().catch(() => null);
  if (!account) return;
  const entries = await ingestionQueue.pendingFor(account);
  if (!entries.length) { chrome.alarms.clear(RETRY_ALARM); return; }
  for (const entry of entries) await sendEntry(entry);
}

// The user clicked submit on a job's form (content/detector.js)
async function noteSubmitClick(key) {
  const { clicks = {} } = await chrome.storage.session.get("clicks");
  clicks[key] = Date.now();
  await chrome.storage.session.set({ clicks });
  return { ok: true };
}

async function recentlyClicked(key) {
  const { clicks = {} } = await chrome.storage.session.get("clicks");
  return Boolean(clicks[key]) && Date.now() - clicks[key] <= SUBMIT_CLICK_WINDOW_MS;
}

// --- LinkedIn Easy Apply's submit request ---
// The new Easy Apply shows no confirmation page or stable markup, but its submit
// is one request. When it succeeds, tell that tab's detector, and let the
// submission it reports count as confirmed. Only the URL and status are seen.

const SITE_SUBMIT_REQUESTS = [
  "https://www.linkedin.com/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.jobseeker.easyapply.submit*",
];
const SITE_SUBMIT_WINDOW_MS = 2 * 60 * 1000;

async function noteSiteSubmit(details) {
  if (details.tabId < 0 || details.statusCode !== 200 || details.method !== "POST") return;
  const { siteSubmits = {} } = await chrome.storage.session.get("siteSubmits");
  siteSubmits[details.tabId] = Date.now();
  await chrome.storage.session.set({ siteSubmits });
  chrome.tabs.sendMessage(details.tabId, { type: "site-submitted" }, { frameId: 0 }).catch(() => {});
}

async function recentSiteSubmit(tabId) {
  if (tabId === undefined) return false;
  const { siteSubmits = {} } = await chrome.storage.session.get("siteSubmits");
  return Boolean(siteSubmits[tabId]) && Date.now() - siteSubmits[tabId] <= SITE_SUBMIT_WINDOW_MS;
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    noteSiteSubmit(details);
  },
  { urls: SITE_SUBMIT_REQUESTS }
);

/**
 * A submission the content script saw. Added automatically when the user
 * clicked submit for that job recently; otherwise (a confirmation link opened
 * directly, or a click we missed) the page asks first, except in a frame,
 * where it's ignored. Skips jobs already reported recently.
 */
async function reportSubmitted(key, job, sender, { confirmed = false } = {}) {
  const reported = await getLocal("reported", {});
  const now = Date.now();
  if (reported[key] && now - reported[key] < REPORT_COOLDOWN_MS) return { status: "duplicate" };
  const sawSubmit = !sender.frameId && (await recentSiteSubmit(sender.tab?.id));
  if (!sawSubmit && !(await recentlyClicked(key))) {
    if (sender.frameId) return { status: "ignored" };
    if (!confirmed) return { status: "unconfirmed" };
  }

  const result = await record(job);
  // Only once it's in (or on its way to) the tracker: a failed attempt, such as
  // before connecting, mustn't hide the next one
  if (["added", "updated", "queued"].includes(result.status)) {
    const fresh = Object.fromEntries(
      Object.entries(reported).filter(([, at]) => now - at < REPORT_COOLDOWN_MS)
    );
    await setLocal({ reported: { ...fresh, [key]: now } });
  }
  return result;
}

async function undo(id) {
  // Only applications this extension added (and still remembers) can be undone
  const recentIds = (await getLocal("recent", [])).map((item) => item.id);
  if (!recentIds.includes(id)) return { ok: false, error: "Only recent additions can be undone here" };
  try {
    await api(`/api/extension/applications/${encodeURIComponent(id)}`, { method: "DELETE" });
    const recent = await getLocal("recent", []);
    await setLocal({ recent: recent.filter((item) => item.id !== id) });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// --- Jobs seen this session ---

async function rememberJob(key, job) {
  const { jobs = {} } = await chrome.storage.session.get("jobs");
  jobs[key] = job;
  await chrome.storage.session.set({ jobs });
}

async function lookupJob(key) {
  const { jobs = {} } = await chrome.storage.session.get("jobs");
  return jobs[key] || null;
}

// --- Messages ---

// Messages from content scripts on the app and the job sites
const contentHandlers = {
  // content/app-bridge.js on the app's own pages
  connect: (message, sender) => connect(message.token, new URL(sender.url).origin),
  // content/detector.js
  "job-seen": (message) => rememberJob(message.key, message.job).then(() => ({ ok: true })),
  "job-lookup": (message) => lookupJob(message.key),
  "submit-clicked": (message) => noteSubmitClick(message.key),
  submitted: (message, sender) => reportSubmitted(message.key, message.job, sender),
  // The user clicked "Add" on the notice for an unconfirmed submission
  "confirm-submitted": (message, sender) =>
    reportSubmitted(message.key, message.job, sender, { confirmed: true }),
  // content/app-bridge.js: connected, and to which account? (never the token)
  "connection-status": async (message, sender) => {
    if (!(await trustedOrigin(new URL(sender.url).origin))) return { connected: false, email: "" };
    const connection = await getLocal("connection", null);
    return { connected: Boolean(connection), email: connection?.email || "" };
  },
  undo: (message) => undo(message.id),
  "open-review": async () => {
    const account = await connectedAccount();
    await chrome.tabs.create({ url: `${account.origin}/applications#matching` });
    return { ok: true };
  },
  "open-connect": () => openConnect(PRODUCTION_ORIGIN),
};

// Messages only the extension's own popup may send
const popupHandlers = {
  ...contentHandlers,
  record: (message) => record(message.job, message.account),
  // Never includes the token
  status: async () => {
    const connection = await getLocal("connection", null);
    return {
      connection: connection && { origin: connection.origin, userId: connection.userId, name: connection.name, email: connection.email },
      recent: await getLocal("recent", []),
      ...(await ingestionQueue.summary(connection || {})),
    };
  },
  "adopt-legacy": async (message) => {
    const account = await connectedAccount();
    if (message.account?.userId !== account.userId || message.account?.origin !== account.origin) throw new NotConnectedError("Your connected account changed. Reopen the popup before assigning items.");
    await ingestionQueue.adoptLegacy(account);
    chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
    await retryQueue();
    return { ok: true };
  },
  disconnect: async () => {
    await chrome.storage.local.remove(["connection", "recent"]);
    return { ok: true };
  },
  "open-connect": (message) => openConnect(message.origin),
};

async function openConnect(origin) {
  const target = (await trustedOrigin(origin)) ? origin : PRODUCTION_ORIGIN;
  await chrome.tabs.create({ url: `${target}/extension/connect` });
  return { ok: true };
}

const fromPopup = (sender) => !sender.tab && sender.url?.startsWith(chrome.runtime.getURL(""));

// Submissions are trusted from top-level pages, and from Greenhouse's embedded
// form (an iframe on company sites).
const SUBMISSION_TYPES = new Set(["submit-clicked", "submitted", "confirm-submitted"]);
function frameAllowed(type, sender) {
  if (sender.frameId === 0 || sender.frameId === undefined) return true;
  if (!SUBMISSION_TYPES.has(type)) return true;
  const url = new URL(sender.url);
  return url.hostname === "boards.greenhouse.io" && url.pathname.startsWith("/embed/");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !frameAllowed(message?.type, sender)) return false;
  const handler = (fromPopup(sender) ? popupHandlers : contentHandlers)[message?.type];
  if (!handler) return false;
  Promise.resolve(handler(message, sender))
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  // Keep the channel open for the async response
  return true;
});

// The app page can also hand the token over directly (externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== "resume-butler:connect") return false;
  connect(message.token, new URL(sender.url).origin)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false }));
  return true;
});

// Recreate the periodic alarm after a browser restart as Chrome may clear it.
chrome.runtime.onStartup.addListener(() => chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 }));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) retryQueue();
});

// Chrome only adds content scripts to pages loaded after an install or update.
// Add them to the job site and app tabs already open, so those work without a
// reload (the old copies, cut off from the extension, stop by themselves).
async function injectIntoOpenTabs() {
  for (const script of chrome.runtime.getManifest().content_scripts || []) {
    const tabs = await chrome.tabs.query({ url: script.matches });
    for (const tab of tabs) {
      chrome.scripting
        .executeScript({ target: { tabId: tab.id, allFrames: Boolean(script.all_frames) }, files: script.js })
        // Tabs that can't take scripts (discarded, still loading, an error page)
        .catch(() => {});
    }
  }
}

// First install: open the app's connect page, which connects without a click
// (after signing in, if needed)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") injectIntoOpenTabs();
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${PRODUCTION_ORIGIN}/extension/connect` });
  }
});
