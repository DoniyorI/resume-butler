import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const reads = [];
let gmailFailure = null;
let gmailEmails = [];
let lastWindow = null;
mock.module("@/server/email/imapClient", { namedExports: { fetchEmails: async () => { reads.push("imap"); return []; } } });
mock.module("@/server/email/gmailClient", { namedExports: {
  fetchGmailEmails: async (credentials, window) => {
    reads.push(["gmail", credentials.refreshToken, window.since instanceof Date]);
    lastWindow = window;
    if (gmailFailure) throw gmailFailure;
    return gmailEmails;
  },
  revokeGmailToken: async () => {},
} });
// The model call: "Not a job" for most mail, a failure for subjects saying so
mock.module("@/server/openai", { namedExports: {
  chatJSON: async ({ user }) => {
    if (/model fails/.test(user)) throw new Error("synthetic model failure");
    return { category: "not_job", company: "", role: "", confidence: 0.9, summary: "Not about an application." };
  },
} });
const { syncEmailsForUser } = await import("@/server/email/sync");
const { encryptSecret } = await import("@/server/crypto");
const { HttpError } = await import("@/server/http");
const userId = "00000000-0000-4000-8000-000000000031";

beforeEach(() => {
  reads.length = 0;
  gmailFailure = null;
  gmailEmails = [];
  lastWindow = null;
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
});

const gmailRow = () => database({ email_connections: [{
  user_id: userId, provider: "gmail", imap_host: "imap.gmail.com", email_address: "me@gmail.example",
  app_password: null, oauth_refresh_token: encryptSecret("refresh-stored"), is_active: true,
}] });

test("a Gmail connection scans through the Gmail API, not IMAP", async () => {
  const result = await syncEmailsForUser(gmailRow(), userId);
  assert.deepEqual(reads, [["gmail", "refresh-stored", true]]);
  assert.equal(result.suggestions, 0);
});

test("a Gmail reconnect message reaches the user unchanged", async (t) => {
  t.mock.method(console, "error", () => {});
  gmailFailure = new HttpError(400, "Google access to your Gmail has expired or was removed. Reconnect Gmail in Inbox.");
  await assert.rejects(syncEmailsForUser(gmailRow(), userId), (error) => error.status === 400 && /Reconnect Gmail/.test(error.message));
});

test("an IMAP connection still scans over IMAP", async () => {
  const db = database({ email_connections: [{ user_id: userId, provider: "imap", imap_host: "imap.gmail.com", email_address: "qa@example.test", app_password: encryptSecret("pw"), is_active: true }] });
  await syncEmailsForUser(db, userId);
  assert.deepEqual(reads, ["imap"]);
});

const mail = (gmailId, subject, extra = {}) => ({
  gmailId, messageId: `<${gmailId}@mail.example>`, subject, fromName: "Sender", fromAddress: "someone@example.test",
  from: "Sender <someone@example.test>", date: new Date("2026-11-10T10:00:00Z"), body: subject, bulk: false, ...extra,
});

test("a Gmail scan remembers the messages it finished and passes them to the next read", async (t) => {
  t.mock.method(console, "error", () => {});
  const db = gmailRow();
  db.tables.email_connections[0].gmail_seen_ids = ["old"];
  db.tables.processed_emails = [{ user_id: userId, message_id: "<done@mail.example>", classification: {} }];
  gmailEmails = Object.assign([
    mail("done", "Your application was received"), // already processed over IMAP
    mail("news", "Weekly digest"), // never a candidate
    mail("thanks", "Thank you for applying to Acme"), // classified and recorded
    mail("broken", "Thank you for applying, model fails"), // classification failed: read again next time
  ], { truncated: 0, alreadySeen: 1, unusableIds: ["blank"] });
  const result = await syncEmailsForUser(db, userId);
  assert.ok(lastWindow.seenIds instanceof Set && lastWindow.seenIds.has("old"));
  const saved = db.tables.email_connections[0].gmail_seen_ids;
  assert.deepEqual(new Set(saved), new Set(["done", "news", "thanks", "blank", "old"]));
  assert.ok(!saved.includes("broken"));
  assert.equal(saved.at(-1), "old");
  assert.equal(result.already_read, 1);
});

test("an IMAP scan stores no Gmail ids", async () => {
  const db = database({ email_connections: [{ user_id: userId, provider: "imap", imap_host: "imap.gmail.com", email_address: "qa@example.test", app_password: encryptSecret("pw"), is_active: true }] });
  await syncEmailsForUser(db, userId);
  assert.equal(db.tables.email_connections[0].gmail_seen_ids, undefined);
});
