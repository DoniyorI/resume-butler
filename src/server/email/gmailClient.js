import "server-only";
import { HttpError } from "@/server/http";
import { bodyText, gmailSearch, htmlToText, isBulkMail } from "@/server/email/messageText";

// Gmail over Google's OAuth and the Gmail API, read-only. Only these fixed Google hosts are called;
// nothing here builds a URL from user input or from a response.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

const DEFAULT_MAX_MESSAGES = 300;
const SCAN_TIMEOUT_MS = 25_000;
const PAGE_SIZE = 100;
const FETCH_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 10_000;

const RECONNECT = "Google access to your Gmail has expired or was removed. Reconnect Gmail in Inbox.";

// The OAuth client from the environment, or null when Gmail sign-in isn't set up
export function gmailOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const isGmailConfigured = () => gmailOAuthConfig() !== null;

function requireConfig() {
  const config = gmailOAuthConfig();
  if (!config) throw new HttpError(503, "Gmail sign-in is not set up on this server.");
  return config;
}

// Google's consent page. access_type=offline and prompt=consent make Google return a refresh token
// every time, so a reconnect always replaces the stored one.
export function gmailAuthUrl({ state, redirectUri }) {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function request(fetchImpl, url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

/**
 * A failed Google call as a user-safe HttpError. Never includes a token or the response text.
 * invalid_grant (revoked, expired or password changed) and 401/403 mean the user must reconnect.
 */
export function gmailError({ status, body }) {
  const code = body?.error?.status || body?.error;
  if (code === "invalid_grant" || status === 401 || status === 403) return new HttpError(400, RECONNECT);
  if (status === 429) return new HttpError(503, "Gmail is limiting requests right now. Try again in a few minutes.");
  return new HttpError(502, "Gmail could not be read. Please try again shortly.");
}

function tokenBody(fields) {
  const { clientId, clientSecret } = requireConfig();
  return new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields });
}

const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

/** Exchange the consent page's one-time code. Returns { refreshToken, accessToken, scopes }. */
export async function exchangeGmailCode(code, redirectUri, { fetchImpl = fetch } = {}) {
  const result = await request(fetchImpl, TOKEN_URL, {
    method: "POST",
    headers: FORM,
    body: tokenBody({ code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!result.ok) throw gmailError(result);
  return {
    refreshToken: result.body?.refresh_token || null,
    accessToken: result.body?.access_token || null,
    scopes: String(result.body?.scope || "").split(/\s+/).filter(Boolean),
  };
}

export async function refreshGmailAccess(refreshToken, { fetchImpl = fetch } = {}) {
  const result = await request(fetchImpl, TOKEN_URL, {
    method: "POST",
    headers: FORM,
    body: tokenBody({ refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!result.ok || !result.body?.access_token) throw gmailError(result);
  return result.body.access_token;
}

// Best effort: a token Google already dropped is fine, and a failure is only logged
export async function revokeGmailToken(token, { fetchImpl = fetch } = {}) {
  if (!token) return;
  try {
    await request(fetchImpl, REVOKE_URL, { method: "POST", headers: FORM, body: new URLSearchParams({ token }) });
  } catch (error) {
    console.warn("Could not revoke the Gmail token:", error?.name || "error");
  }
}

const authorized = (accessToken) => ({ headers: { Authorization: `Bearer ${accessToken}` } });

// The address of the mailbox the user granted (gmail.readonly covers the profile)
export async function gmailProfileEmail(accessToken, { fetchImpl = fetch } = {}) {
  const result = await request(fetchImpl, `${API_URL}/profile`, authorized(accessToken));
  if (!result.ok) throw gmailError(result);
  const address = String(result.body?.emailAddress || "").trim().toLowerCase();
  if (!address) throw new HttpError(502, "Gmail did not say which address was connected. Please try again.");
  return address;
}

// ---------- reading messages ----------

function decodePart(data, charset) {
  if (!data) return "";
  const bytes = Buffer.from(data, "base64url");
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const headerMap = (headers = []) => {
  const map = new Map();
  for (const { name, value } of headers) {
    const key = String(name || "").toLowerCase();
    if (!map.has(key)) map.set(key, String(value ?? ""));
  }
  return map;
};

function charsetOf(part) {
  const type = headerMap(part.headers).get("content-type") || "";
  return /charset="?([^";\s]+)"?/i.exec(type)?.[1];
}

// The first text/plain and text/html bodies, skipping attachments
function collectText(part, found = { plain: "", html: "" }) {
  if (!part) return found;
  const isAttachment = Boolean(part.filename) || Boolean(part.body?.attachmentId);
  if (!isAttachment && part.mimeType === "text/plain" && !found.plain) found.plain = decodePart(part.body?.data, charsetOf(part));
  if (!isAttachment && part.mimeType === "text/html" && !found.html) found.html = decodePart(part.body?.data, charsetOf(part));
  for (const child of part.parts || []) collectText(child, found);
  return found;
}

// "Acme Hiring <jobs@acme.example>" or "jobs@acme.example"
function parseSender(value) {
  const text = String(value || "").trim();
  const angled = /^(.*)<([^>]+)>\s*$/.exec(text);
  if (angled) return { name: angled[1].trim().replace(/^"|"$/g, "").trim(), address: angled[2].trim() };
  return { name: "", address: text };
}

/**
 * A Gmail API message (format=full) in the shape the scan expects, matching the IMAP reader:
 * { messageId, subject, fromName, fromAddress, from, date, body, bulk }. The Message-ID header is
 * kept, so emails already processed over IMAP are not processed again.
 */
export function parseGmailMessage(message) {
  const headers = headerMap(message?.payload?.headers);
  const sender = parseSender(headers.get("from"));
  const { plain, html } = collectText(message?.payload);
  const dateHeader = headers.get("date");
  const parsedDate = dateHeader ? new Date(dateHeader) : null;
  const internal = Number(message?.internalDate);
  const date = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate
    : Number.isFinite(internal) && internal > 0 ? new Date(internal) : null;
  return {
    messageId: (headers.get("message-id") || "").trim(),
    subject: headers.get("subject") || "",
    fromName: sender.name,
    fromAddress: sender.address.toLowerCase(),
    from: headers.get("from") || "",
    date,
    body: bodyText(plain || (html ? htmlToText(html) : "")),
    bulk: isBulkMail({
      has: (name) => (name === "list" ? [...headers.keys()].some((key) => key.startsWith("list-")) : headers.has(name)),
      get: (name) => headers.get(name),
    }),
  };
}

async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Read inbox messages received in [since, before), newest first, read-only. Same contract as
 * imapClient's fetchEmails: an array of parsed emails, with `truncated` counting what the cap left
 * out (at least 1 when Gmail had more pages). Throws HttpError with a user-safe message.
 */
export async function fetchGmailEmails(
  { refreshToken },
  { since, before, maxMessages = DEFAULT_MAX_MESSAGES, timeoutMs = SCAN_TIMEOUT_MS, fetchImpl = fetch }
) {
  const deadline = Date.now() + Math.max(1, Math.min(timeoutMs, SCAN_TIMEOUT_MS));
  const remaining = () => {
    const left = deadline - Date.now();
    if (left <= 0) throw new HttpError(503, "Reading Gmail timed out. Please retry, or use a shorter date range.");
    return Math.min(left, REQUEST_TIMEOUT_MS);
  };
  const call = async (url, init) => {
    try {
      return await request(fetchImpl, url, init, remaining());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw new HttpError(503, "Reading Gmail timed out. Please retry, or use a shorter date range.");
      }
      throw new HttpError(503, "Gmail could not be reached. Check the connection and try again shortly.");
    }
  };

  const accessToken = await refreshGmailAccess(refreshToken, {
    fetchImpl: (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(remaining()) }),
  }).catch((error) => {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Gmail could not be reached. Check the connection and try again shortly.");
  });
  const auth = authorized(accessToken);
  const q = `in:inbox ${gmailSearch({ since, before })}`;

  const ids = [];
  let pageToken = null;
  let more = false;
  let estimate = 0;
  do {
    const params = new URLSearchParams({ q, maxResults: String(Math.min(PAGE_SIZE, maxMessages - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await call(`${API_URL}/messages?${params}`, auth);
    if (!page.ok) throw gmailError(page);
    for (const { id } of page.body?.messages || []) if (typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id)) ids.push(id);
    estimate = Number(page.body?.resultSizeEstimate) || estimate;
    pageToken = typeof page.body?.nextPageToken === "string" ? page.body.nextPageToken : null;
    more = Boolean(pageToken);
  } while (pageToken && ids.length < maxMessages);

  const messages = await mapLimited(ids.slice(0, maxMessages), FETCH_CONCURRENCY, async (id) => {
    const result = await call(`${API_URL}/messages/${id}?format=full`, auth);
    if (result.status === 404) return null; // deleted between the list and the read
    if (!result.ok) throw gmailError(result);
    return parseGmailMessage(result.body);
  });

  const emails = messages.filter((email) => email && email.messageId && email.fromAddress);
  emails.truncated = more ? Math.max(1, estimate - ids.length) : 0;
  return emails;
}
