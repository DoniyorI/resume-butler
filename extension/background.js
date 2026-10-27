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

// --- Talking to the app ---

class NotConnectedError extends Error {}

async function api(path, { method = "GET", body } = {}) {
  const connection = await getLocal("connection", null);
  if (!connection) throw new NotConnectedError("Not connected");
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
    await chrome.storage.local.remove("connection");
    throw new NotConnectedError(data.error || "Not connected");
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
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
  await setLocal({ connection: { token, origin, name: me.name || "", email: me.email || "" } });
  return { ok: true };
}

// --- Recording applications ---

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toPayload(job) {
  return {
    company: job.company,
    role: job.role || "",
    location: job.location || "",
    url: job.url || "",
    jobDescription: job.description || "",
    appliedDate: job.appliedDate || localDate(),
    detectedBy: job.site || "",
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

async function enqueue(job) {
  const queue = await getLocal("queue", []);
  await setLocal({ queue: [...queue, job] });
  chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
}

// Send one job to the app. Returns { status: "added" | "updated" | "queued" |
// "not-connected" | "error", application?, error? }
async function record(job) {
  try {
    const { application, created } = await api("/api/extension/applications", {
      method: "POST",
      body: toPayload(job),
    });
    if (created) await remember(application);
    return { status: created ? "added" : "updated", application };
  } catch (error) {
    if (error instanceof NotConnectedError) return { status: "not-connected" };
    // Offline or a server error: try again later. A 4xx means the data was refused.
    if (!error.status || error.status >= 500) {
      await enqueue({ ...job, appliedDate: job.appliedDate || localDate() });
      return { status: "queued" };
    }
    return { status: "error", error: error.message };
  }
}

async function retryQueue() {
  const queue = await getLocal("queue", []);
  if (queue.length === 0) {
    chrome.alarms.clear(RETRY_ALARM);
    return;
  }
  await setLocal({ queue: [] });
  for (const job of queue) {
    // record() puts it back in the queue if it fails again
    await record(job);
  }
}

// The user clicked submit on a job's form (content/detector.js)
async function noteSubmitClick(key) {
  const { clicks = {} } = await chrome.storage.session.get("clicks");
  clicks[key] = Date.now();
  await chrome.storage.session.set({ clicks });
  return { ok: true };
}

/**
 * A submission the content script saw: added automatically, no questions.
 * In a frame (Greenhouse's embedded form) it also needs a submit click seen
 * for that job in this session, so a site that merely frames a confirmation
 * page can't add jobs. Skips jobs already reported recently.
 */
async function reportSubmitted(key, job, sender) {
  const reported = await getLocal("reported", {});
  const now = Date.now();
  if (reported[key] && now - reported[key] < REPORT_COOLDOWN_MS) return { status: "duplicate" };
  if (sender.frameId) {
    const { clicks = {} } = await chrome.storage.session.get("clicks");
    if (!clicks[key] || now - clicks[key] > SUBMIT_CLICK_WINDOW_MS) return { status: "ignored" };
  }

  const fresh = Object.fromEntries(
    Object.entries(reported).filter(([, at]) => now - at < REPORT_COOLDOWN_MS)
  );
  await setLocal({ reported: { ...fresh, [key]: now } });
  return record(job);
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
  // content/app-bridge.js: connected, and to which account? (never the token)
  "connection-status": async (message, sender) => {
    if (!(await trustedOrigin(new URL(sender.url).origin))) return { connected: false, email: "" };
    const connection = await getLocal("connection", null);
    return { connected: Boolean(connection), email: connection?.email || "" };
  },
  undo: (message) => undo(message.id),
  "open-connect": () => openConnect(PRODUCTION_ORIGIN),
};

// Messages only the extension's own popup may send
const popupHandlers = {
  ...contentHandlers,
  record: (message) => record(message.job),
  // Never includes the token
  status: async () => {
    const connection = await getLocal("connection", null);
    return {
      connection: connection && { origin: connection.origin, name: connection.name, email: connection.email },
      recent: await getLocal("recent", []),
      queued: (await getLocal("queue", [])).length,
    };
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
const SUBMISSION_TYPES = new Set(["submit-clicked", "submitted"]);
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) retryQueue();
});

// First install: open the app's connect page, which connects without a click
// (after signing in, if needed)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${PRODUCTION_ORIGIN}/extension/connect` });
  }
});
