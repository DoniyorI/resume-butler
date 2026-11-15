import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { database } from "./helpers/database.mjs";

const gmail = await import("@/server/email/gmailClient");
const { finishGmailConnect, startGmailConnect, STATE_COOKIE } = await import("@/server/email/gmailConnect");
const connection = await import("@/server/email/connection");
const { encryptSecret, decryptSecret } = await import("@/server/crypto");

const userId = "00000000-0000-4000-8000-000000000021";
const otherUser = "00000000-0000-4000-8000-000000000022";
const origin = "https://app.example.test";
const b64 = (text, encoding = "utf8") => Buffer.from(text, encoding).toString("base64url");
const GOOGLE_HOSTS = new Set(["oauth2.googleapis.com", "gmail.googleapis.com"]);

beforeEach(() => {
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "synthetic-client-secret";
});

const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

// A fake Google: records every call, refuses any host that is not Google's
function fakeGoogle(handlers) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    assert.ok(GOOGLE_HOSTS.has(parsed.host), `unexpected host ${parsed.host}`);
    calls.push({ url: parsed, init, body: init.body ? new URLSearchParams(String(init.body)) : null });
    for (const [match, handler] of handlers) if (match(parsed, init)) return handler(parsed, init);
    return json(404, { error: { code: 404 } });
  };
  return { calls, fetchImpl };
}
const isToken = (u) => u.host === "oauth2.googleapis.com" && u.pathname === "/token";
const isRevoke = (u) => u.host === "oauth2.googleapis.com" && u.pathname === "/revoke";
const isList = (u) => u.pathname === "/gmail/v1/users/me/messages";
const isGet = (u) => u.pathname.startsWith("/gmail/v1/users/me/messages/");
const isProfile = (u) => u.pathname === "/gmail/v1/users/me/profile";

function apiMessage(id, { headers = {}, parts, body, internalDate = "1762000000000" } = {}) {
  const base = { "Message-ID": `<${id}@mail.example>`, From: "\"Acme Hiring\" <Jobs@Acme.example>", Subject: `Thanks for applying ${id}`, Date: "Tue, 11 Nov 2026 10:00:00 +0000" };
  const all = { ...base, ...headers };
  return {
    id,
    internalDate,
    payload: {
      mimeType: parts ? "multipart/mixed" : "text/plain",
      headers: Object.entries(all).filter(([, v]) => v != null).map(([name, value]) => ({ name, value })),
      ...(parts ? { parts } : { body: { data: b64(body ?? `Thanks for applying to Acme, ${id}.`) } }),
    },
  };
}

// ---------- parsing ----------

test("a Gmail API message parses into the same shape as an IMAP message", () => {
  const email = gmail.parseGmailMessage(apiMessage("m1", {
    parts: [
      { mimeType: "multipart/alternative", parts: [
        { mimeType: "text/plain", headers: [{ name: "Content-Type", value: "text/plain; charset=\"UTF-8\"" }], body: { data: b64("Your   application\n for Backend Engineer was received.") } },
        { mimeType: "text/html", body: { data: b64("<p>ignored when plain text exists</p>") } },
      ] },
      { mimeType: "text/plain", filename: "resume.txt", body: { attachmentId: "att-1" } },
    ],
  }));
  assert.deepEqual({ ...email, date: email.date.toISOString() }, {
    messageId: "<m1@mail.example>",
    subject: "Thanks for applying m1",
    fromName: "Acme Hiring",
    fromAddress: "jobs@acme.example",
    from: "\"Acme Hiring\" <Jobs@Acme.example>",
    date: "2026-11-11T10:00:00.000Z",
    body: "Your application for Backend Engineer was received.",
    bulk: false,
  });
});

test("HTML-only bodies are turned into text, a part's charset is honored and list headers mark bulk mail", () => {
  const html = gmail.parseGmailMessage(apiMessage("m2", { parts: [{ mimeType: "text/html", body: { data: b64("<style>x{}</style><p>Interview&nbsp;invite</p>") } }] }));
  assert.equal(html.body, "Interview invite");
  const latin = gmail.parseGmailMessage(apiMessage("m3", { parts: [{ mimeType: "text/plain", headers: [{ name: "Content-Type", value: "text/plain; charset=ISO-8859-1" }], body: { data: b64("Résumé reçu", "latin1") } }] }));
  assert.equal(latin.body, "Résumé reçu");
  assert.equal(gmail.parseGmailMessage(apiMessage("m4", { headers: { "List-Unsubscribe": "<mailto:x@y>" } })).bulk, true);
  assert.equal(gmail.parseGmailMessage(apiMessage("m5", { headers: { Precedence: "bulk" } })).bulk, true);
  const undated = gmail.parseGmailMessage(apiMessage("m6", { headers: { Date: null } }));
  assert.equal(undated.date.getTime(), 1762000000000);
  assert.equal(gmail.parseGmailMessage(apiMessage("m7", { headers: { From: "bare@example.test" } })).fromAddress, "bare@example.test");
});

// ---------- reading ----------

test("reading Gmail refreshes access, searches the inbox window and reads each message read-only", async () => {
  const { calls, fetchImpl } = fakeGoogle([
    [isToken, () => json(200, { access_token: "access-1" })],
    [isList, (u) => json(200, u.searchParams.get("pageToken")
      ? { messages: [{ id: "c" }], resultSizeEstimate: 3 }
      : { messages: [{ id: "a" }, { id: "b" }], nextPageToken: "p2", resultSizeEstimate: 3 })],
    [(u) => isGet(u) && u.pathname.endsWith("/b"), () => json(404, {})],
    [isGet, (u) => json(200, apiMessage(u.pathname.split("/").pop()))],
  ]);
  const emails = await gmail.fetchGmailEmails({ refreshToken: "refresh-1" }, {
    since: new Date("2026-11-01T00:00:00Z"), before: new Date("2026-11-15T00:00:00Z"), fetchImpl,
  });
  assert.deepEqual(emails.map((e) => e.messageId), ["<a@mail.example>", "<c@mail.example>"]);
  assert.equal(emails.truncated, 0);
  const token = calls.find((c) => isToken(c.url));
  assert.equal(token.body.get("grant_type"), "refresh_token");
  assert.equal(token.body.get("refresh_token"), "refresh-1");
  const list = calls.find((c) => isList(c.url));
  assert.equal(list.url.searchParams.get("q"), "in:inbox after:2026/11/1 before:2026/11/15 -category:promotions -category:social -category:forums");
  assert.equal(list.init.headers.Authorization, "Bearer access-1");
  for (const call of calls.filter((c) => isGet(c.url))) assert.equal(call.url.searchParams.get("format"), "full");
  assert.ok(calls.every((c) => !c.init.method || c.init.method === "POST" && isToken(c.url)), "only GETs to Gmail");
});

test("the message cap keeps the newest messages and reports what it left out", async () => {
  const { calls, fetchImpl } = fakeGoogle([
    [isToken, () => json(200, { access_token: "access" })],
    [isList, (u) => json(200, { messages: Array.from({ length: Number(u.searchParams.get("maxResults")) }, (_, i) => ({ id: `n${i}` })), nextPageToken: "more", resultSizeEstimate: 40 })],
    [isGet, (u) => json(200, apiMessage(u.pathname.split("/").pop()))],
  ]);
  const emails = await gmail.fetchGmailEmails({ refreshToken: "r" }, { since: new Date("2026-11-01"), before: new Date("2026-11-15"), maxMessages: 5, fetchImpl });
  assert.equal(emails.length, 5);
  assert.equal(emails.truncated, 35);
  assert.equal(calls.filter((c) => isList(c.url)).length, 1);
});

test("Google's reason decides the message: only a lost grant asks to reconnect, and the log names step and reason", (t) => {
  const log = t.mock.method(console, "error", () => {});
  const apiError = (status, reason) => ({ status, body: { error: { code: status, errors: [{ reason }], status: "PERMISSION_DENIED" } } });
  assert.equal(gmail.gmailError(apiError(403, "accessNotConfigured"), "list").status, 503);
  assert.match(gmail.gmailError(apiError(403, "accessNotConfigured")).message, /not set up correctly/);
  assert.equal(gmail.gmailError(apiError(403, "insufficientPermissions")).status, 400);
  assert.equal(gmail.gmailError(apiError(403, "userRateLimitExceeded")).status, 503);
  assert.equal(gmail.gmailError(apiError(403, "somethingNew")).status, 502, "an unknown 403 is not a reconnect");
  assert.equal(gmail.gmailError({ status: 401, body: { error: "invalid_client" } }, "token refresh").status, 503);
  assert.deepEqual(log.mock.calls[0].arguments, ["Gmail request failed", { step: "list", status: 403, reason: "accessNotConfigured" }]);
  assert.equal(gmail.gmailReason({ error: { status: "UNAUTHENTICATED" } }), "UNAUTHENTICATED");
});

test("rate-limited reads are retried, and a message still refused is left for the next scan", async (t) => {
  t.mock.method(console, "warn", () => {});
  const tries = new Map();
  const limited = json(403, { error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } });
  const { fetchImpl } = fakeGoogle([
    [isToken, () => json(200, { access_token: "access" })],
    [isList, () => json(200, { messages: [{ id: "ok" }, { id: "slow" }, { id: "stuck" }], resultSizeEstimate: 3 })],
    [isGet, (u) => {
      const id = u.pathname.split("/").pop();
      tries.set(id, (tries.get(id) || 0) + 1);
      if (id === "slow" && tries.get(id) < 3) return limited;
      if (id === "stuck") return limited;
      return json(200, apiMessage(id));
    }],
  ]);
  const emails = await gmail.fetchGmailEmails({ refreshToken: "r" }, {
    since: new Date("2026-11-01"), before: new Date("2026-11-15"), fetchImpl, minGapMs: 0, retryBaseMs: 1,
  });
  assert.deepEqual(emails.map((e) => e.messageId).sort(), ["<ok@mail.example>", "<slow@mail.example>"]);
  assert.equal(tries.get("slow"), 3);
  assert.equal(tries.get("stuck"), 4, "the first try and three retries");
  assert.equal(emails.truncated, 1, "the refused message counts as not processed");
});

test("message reads are spaced out to stay under Gmail's per-user rate", async () => {
  const starts = [];
  const { fetchImpl } = fakeGoogle([
    [isToken, () => json(200, { access_token: "access" })],
    [isList, () => json(200, { messages: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` })) })],
    [isGet, (u) => { starts.push(Date.now()); return json(200, apiMessage(u.pathname.split("/").pop())); }],
  ]);
  await gmail.fetchGmailEmails({ refreshToken: "r" }, { since: new Date("2026-11-01"), before: new Date("2026-11-15"), fetchImpl, minGapMs: 20 });
  assert.ok(starts.at(-1) - starts[0] >= 5 * 20 - 5, `6 reads took ${starts.at(-1) - starts[0]} ms`);
});

test("revoked or expired Google access asks the user to reconnect, without leaking tokens", async (t) => {
  t.mock.method(console, "error", () => {});
  const { fetchImpl } = fakeGoogle([[isToken, () => json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." })]]);
  await assert.rejects(
    gmail.fetchGmailEmails({ refreshToken: "secret-refresh" }, { since: new Date("2026-11-01"), before: new Date("2026-11-15"), fetchImpl }),
    (error) => error.status === 400 && /Reconnect Gmail/.test(error.message) && !error.message.includes("secret")
  );
  assert.equal(gmail.gmailError({ status: 429, body: null }).status, 503);
  assert.equal(gmail.gmailError({ status: 500, body: null }).status, 502);
  assert.equal(gmail.gmailError({ status: 401, body: null }).status, 400);
});

// ---------- connecting ----------

test("Gmail sign-in is hidden until both Google keys are set", () => {
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.equal(gmail.isGmailConfigured(), false);
  assert.deepEqual(startGmailConnect(userId, origin), { outcome: "unavailable" });
});

test("the consent URL asks for read-only Gmail, offline access and carries the state", () => {
  const start = startGmailConnect(userId, origin);
  const url = new URL(start.url);
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("redirect_uri"), `${origin}/api/gmail/callback`);
  const [nonce, boundTo] = start.cookie.split(".");
  assert.equal(url.searchParams.get("state"), nonce);
  assert.ok(nonce.length >= 40);
  assert.equal(boundTo, userId);
  assert.equal(STATE_COOKIE, "rb_gmail_state");
});

function callback(state, extra = {}) {
  return new URLSearchParams({ state, code: "one-time-code", ...extra });
}
const grant = (scope = gmail.GMAIL_SCOPE) => [isToken, () => json(200, { access_token: "access", refresh_token: "refresh-new", scope })];
const profile = [isProfile, () => json(200, { emailAddress: "Me@Gmail.example" })];

test("a completed sign-in stores the mailbox with its refresh token encrypted", async () => {
  const db = database({ email_connections: [] });
  const { cookie } = startGmailConnect(userId, origin);
  const { calls, fetchImpl } = fakeGoogle([grant(), profile, [isRevoke, () => json(200, {})]]);
  const outcome = await finishGmailConnect(db, userId, { origin, params: callback(cookie.split(".")[0]), cookie }, { fetchImpl });
  assert.equal(outcome, "connected");
  const [row] = db.tables.email_connections;
  assert.equal(row.provider, "gmail");
  assert.equal(row.email_address, "me@gmail.example");
  assert.equal(row.app_password, null);
  assert.notEqual(row.oauth_refresh_token, "refresh-new");
  assert.equal(decryptSecret(row.oauth_refresh_token), "refresh-new");
  const exchange = calls.find((c) => isToken(c.url)).body;
  assert.equal(exchange.get("grant_type"), "authorization_code");
  assert.equal(exchange.get("redirect_uri"), `${origin}/api/gmail/callback`);
  assert.equal(calls.filter((c) => isRevoke(c.url)).length, 0);
});

test("signing in with Google over an app-password connection replaces it and drops the password", async () => {
  const db = database({ email_connections: [{ user_id: userId, provider: "imap", imap_host: "imap.gmail.com", imap_port: 993, email_address: "me@gmail.example", app_password: encryptSecret("old-app-password"), oauth_refresh_token: null, is_active: true, auto_sync: true }] });
  const { cookie } = startGmailConnect(userId, origin);
  const { calls, fetchImpl } = fakeGoogle([grant(), profile, [isRevoke, () => json(200, {})]]);
  assert.equal(await finishGmailConnect(db, userId, { origin, params: callback(cookie.split(".")[0]), cookie }, { fetchImpl }), "connected");
  assert.equal(db.tables.email_connections.length, 1);
  const [row] = db.tables.email_connections;
  assert.equal(row.provider, "gmail");
  assert.equal(row.app_password, null);
  assert.equal(row.auto_sync, true, "the daily sync setting is kept");
  assert.equal(decryptSecret(row.oauth_refresh_token), "refresh-new");
  assert.equal(calls.filter((c) => isRevoke(c.url)).length, 0, "nothing to revoke for an app password");
});

test("a callback with a wrong state, another user's state or a denial stores nothing", async () => {
  const db = database({ email_connections: [] });
  const { cookie } = startGmailConnect(userId, origin);
  const nonce = cookie.split(".")[0];
  const { calls, fetchImpl } = fakeGoogle([grant(), profile]);
  assert.equal(await finishGmailConnect(db, userId, { origin, params: callback("forged"), cookie }, { fetchImpl }), "expired");
  assert.equal(await finishGmailConnect(db, otherUser, { origin, params: callback(nonce), cookie }, { fetchImpl }), "expired");
  assert.equal(await finishGmailConnect(db, userId, { origin, params: callback(nonce), cookie: undefined }, { fetchImpl }), "expired");
  assert.equal(await finishGmailConnect(db, userId, { origin, params: new URLSearchParams({ state: nonce, error: "access_denied" }), cookie }, { fetchImpl }), "denied");
  assert.equal(calls.length, 0);
  assert.equal(db.tables.email_connections.length, 0);
});

test("unticking the Gmail permission is reported and the partial grant is revoked", async () => {
  const db = database({ email_connections: [] });
  const { cookie } = startGmailConnect(userId, origin);
  const { calls, fetchImpl } = fakeGoogle([grant("openid email"), [isRevoke, () => json(200, {})]]);
  assert.equal(await finishGmailConnect(db, userId, { origin, params: callback(cookie.split(".")[0]), cookie }, { fetchImpl }), "scope");
  assert.equal(calls.find((c) => isRevoke(c.url)).body.get("token"), "refresh-new");
  assert.equal(db.tables.email_connections.length, 0);
});

test("before migration 023 the sign-in reports the setup step and revokes the token", async () => {
  const db = database({ email_connections: [] });
  db.fail("email_connections", "upsert", { code: "PGRST204", message: "Could not find the 'oauth_refresh_token' column of 'email_connections' in the schema cache" });
  const { cookie } = startGmailConnect(userId, origin);
  const { calls, fetchImpl } = fakeGoogle([grant(), profile, [isRevoke, () => json(200, {})]]);
  assert.equal(await finishGmailConnect(db, userId, { origin, params: callback(cookie.split(".")[0]), cookie }, { fetchImpl }), "setup");
  assert.equal(calls.filter((c) => isRevoke(c.url)).length, 1);
});

// ---------- stored connections ----------

test("before migration 023 an IMAP connection still loads, as IMAP", async () => {
  const db = database({ email_connections: [{ user_id: userId, imap_host: "imap.gmail.com", imap_port: 993, email_address: "qa@example.test", app_password: encryptSecret("pw"), is_active: true }] });
  db.fail("email_connections", "select", { code: "42703", message: "column email_connections.provider does not exist" });
  const row = await connection.getConnection(db, userId);
  assert.equal(row.provider, "imap");
  assert.equal(row.email_address, "qa@example.test");
  assert.equal("app_password" in row || "oauth_refresh_token" in row, false);
  db.fail("email_connections", "select", { code: "42703", message: "column email_connections.provider does not exist" });
  const credentials = await connection.getConnectionCredentials(db, userId);
  assert.equal(credentials.provider, "imap");
  assert.equal(credentials.password, "pw");
});

test("a Gmail connection gives the scan its refresh token, and disconnecting revokes it", async (t) => {
  const db = database({ email_connections: [{ user_id: userId, provider: "gmail", imap_host: "imap.gmail.com", email_address: "me@gmail.example", app_password: null, oauth_refresh_token: encryptSecret("refresh-stored"), is_active: true }] });
  assert.deepEqual(await connection.getConnectionCredentials(db, userId), { provider: "gmail", user: "me@gmail.example", refreshToken: "refresh-stored", needsEncryption: false });
  const publicRow = await connection.getConnection(db, userId);
  assert.equal(publicRow.provider, "gmail");
  assert.equal("oauth_refresh_token" in publicRow, false);
  const revoked = [];
  t.mock.method(globalThis, "fetch", async (url, init) => { revoked.push([String(url), new URLSearchParams(String(init.body)).get("token")]); return json(200, {}); });
  await connection.deleteConnection(db, userId);
  assert.deepEqual(revoked, [["https://oauth2.googleapis.com/revoke", "refresh-stored"]]);
  assert.equal(db.tables.email_connections.length, 0);
});

test("switching from Gmail to an app password revokes the Google access", async (t) => {
  const db = database({ email_connections: [{ user_id: userId, provider: "gmail", imap_host: "imap.gmail.com", email_address: "me@gmail.example", app_password: null, oauth_refresh_token: encryptSecret("refresh-old"), is_active: true }] });
  const revoked = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => { revoked.push(new URLSearchParams(String(init.body)).get("token")); return json(200, {}); });
  const saved = await connection.saveConnection(db, userId, { email_address: "me@gmail.example", app_password: "app-pw" });
  assert.equal(saved.provider, "imap");
  assert.equal(db.tables.email_connections[0].oauth_refresh_token, null);
  assert.deepEqual(revoked, ["refresh-old"]);
});
