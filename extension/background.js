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
const APP_ORIGINS = [PRODUCTION_ORIGIN, "http://localhost:3000"];
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

// The token from the app's /extension page: keep it only if the app accepts it
async function connect(token, origin) {
  if (!APP_ORIGINS.includes(origin) || typeof token !== "string" || !token.startsWith("rbx_")) {
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

// A submission the content script saw. Skips jobs already reported recently.
async function reportSubmitted(key, job) {
  const reported = await getLocal("reported", {});
  const now = Date.now();
  if (reported[key] && now - reported[key] < REPORT_COOLDOWN_MS) return { status: "duplicate" };

  const fresh = Object.fromEntries(
    Object.entries(reported).filter(([, at]) => now - at < REPORT_COOLDOWN_MS)
  );
  await setLocal({ reported: { ...fresh, [key]: now } });
  return record(job);
}

async function undo(id) {
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

const handlers = {
  // From content/app-bridge.js on the app's own pages
  connect: (message, sender) => connect(message.token, new URL(sender.url).origin),
  // From content/detector.js
  "job-seen": (message) => rememberJob(message.key, message.job).then(() => ({ ok: true })),
  "job-lookup": (message) => lookupJob(message.key),
  submitted: (message) => reportSubmitted(message.key, message.job),
  // From the popup and the in-page notice
  record: (message) => record(message.job),
  undo: (message) => undo(message.id),
  status: async () => ({
    connection: await getLocal("connection", null),
    recent: await getLocal("recent", []),
    queued: (await getLocal("queue", [])).length,
  }),
  disconnect: async () => {
    await chrome.storage.local.remove(["connection", "recent"]);
    return { ok: true };
  },
  "open-connect": async (message) => {
    const origin = APP_ORIGINS.includes(message.origin) ? message.origin : PRODUCTION_ORIGIN;
    await chrome.tabs.create({ url: `${origin}/extension?connect=1` });
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type];
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

// First install: open the app, which connects the extension without a click
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: `${PRODUCTION_ORIGIN}/extension?connect=1` });
  }
});
