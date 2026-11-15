import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const reads = [];
let gmailFailure = null;
mock.module("@/server/email/imapClient", { namedExports: { fetchEmails: async () => { reads.push("imap"); return []; } } });
mock.module("@/server/email/gmailClient", { namedExports: {
  fetchGmailEmails: async (credentials, window) => {
    reads.push(["gmail", credentials.refreshToken, window.since instanceof Date]);
    if (gmailFailure) throw gmailFailure;
    return [];
  },
  revokeGmailToken: async () => {},
} });
const { syncEmailsForUser } = await import("@/server/email/sync");
const { encryptSecret } = await import("@/server/crypto");
const { HttpError } = await import("@/server/http");
const userId = "00000000-0000-4000-8000-000000000031";

beforeEach(() => {
  reads.length = 0;
  gmailFailure = null;
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
