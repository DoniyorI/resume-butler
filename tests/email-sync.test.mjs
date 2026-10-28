import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

let messages = [];
let answers = {};
mock.module("@/server/email/imapClient", { namedExports: { fetchEmails: async () => messages } });
mock.module("@/server/openai", { namedExports: { chatJSON: async ({ user }) => {
  const subject = /Subject: (.*)/.exec(user)?.[1];
  if (!answers[subject]) throw new Error("Synthetic provider outage");
  return typeof answers[subject] === "function" ? answers[subject]() : answers[subject];
} } });
const { syncEmailsForUser } = await import("@/server/email/sync");
const { encryptSecret } = await import("@/server/crypto");
const userId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  messages = [];
  answers = {};
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

function setup() {
  return database({ email_connections: [{ user_id: userId, imap_host: "imap.gmail.com", email_address: "qa@example.test", app_password: encryptSecret("synthetic-password"), is_active: true }] });
}
function message(id, overrides = {}, classification = {}) {
  const email = {
    messageId: id, subject: `Thanks for applying ${id}`, fromName: "Acme Hiring",
    fromAddress: "jobs@acme.example", from: "Acme Hiring <jobs@acme.example>",
    date: new Date(), body: "Thanks for applying to the Backend Engineer role at Acme.", bulk: false,
    ...overrides,
  };
  answers[email.subject] = { category: "application_received", company: "Acme", role: "Backend Engineer", confidence: 0.95, summary: "Application received.", ...classification };
  return email;
}

test("a failed suggestion write stays retryable on the next scan", async () => {
  const db = setup();
  messages = [message("retry-insert")];
  db.fail("application_suggestions", "insert", { code: "XX000", message: "Synthetic temporary write failure" });
  const failed = await syncEmailsForUser(db, userId);
  assert.equal(failed.errors, 1);
  assert.equal(db.tables.processed_emails.length, 0);
  const retried = await syncEmailsForUser(db, userId);
  assert.equal(retried.suggestions, 1);
  assert.equal(db.tables.application_suggestions.length, 1);
});

test("legacy processed rows marked error do not suppress retries", async () => {
  const db = setup();
  messages = [message("legacy-error")];
  db.tables.processed_emails = [{ user_id: userId, message_id: "legacy-error", action_taken: "error" }];
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.suggestions, 1);
});

test("duplicate transport messages produce one suggestion without an error", async () => {
  const db = setup();
  const email = message("duplicate");
  messages = [email, email];
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.errors, 0);
  assert.equal(db.tables.application_suggestions.length, 1);
});

test("email time prevents historical rejection from targeting a newer reapplication", async () => {
  const db = setup();
  db.tables.applications = [{ id: "newer", user_id: userId, company: "Acme", role: "Backend Engineer", status: "Applied", applied_date: "2026-10-20" }];
  messages = [message("historical", { date: new Date("2026-01-15T12:00:00Z") }, { category: "rejection" })];
  await syncEmailsForUser(db, userId, { from: "2026-01-01", to: "2026-10-27" });
  assert.equal(db.tables.application_suggestions[0].kind, "new");
  assert.equal(db.tables.application_suggestions[0].application_id, null);
  assert.equal(db.tables.applications[0].status, "Applied");
});

test("repeated scans are idempotent and never apply a suggestion", async () => {
  const db = setup();
  messages = [message("repeat")];
  await syncEmailsForUser(db, userId);
  const repeated = await syncEmailsForUser(db, userId);
  assert.equal(repeated.suggestions, 0);
  assert.equal(db.tables.application_suggestions.length, 1);
  assert.equal(db.tables.applications.length, 0);
});

test("partial classification failure remains unprocessed while other messages succeed", async () => {
  const db = setup();
  messages = [message("good"), message("provider-failure")];
  delete answers[messages[1].subject];
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.errors, 1);
  assert.deepEqual(db.tables.processed_emails.map((row) => row.message_id), ["good"]);
});

test("processed-email write failure is surfaced and a retry cannot duplicate the suggestion", async () => {
  const db = setup();
  messages = [message("record-failure")];
  db.fail("processed_emails", "upsert", { code: "XX000", message: "Synthetic log write failure" });
  const failed = await syncEmailsForUser(db, userId);
  assert.equal(failed.errors, 1);
  const retry = await syncEmailsForUser(db, userId);
  assert.equal(retry.errors, 0);
  assert.equal(db.tables.application_suggestions.length, 1);
});

test("a nearly exhausted route budget defers classification without losing the email", async () => {
  const db = setup();
  messages = [message("budget")];
  const result = await syncEmailsForUser(db, userId, { deadlineAt: Date.now() + 5000 });
  assert.equal(result.suggestions, 0);
  assert.equal(result.errors, 0);
  assert.equal(result.deferred, 1);
  assert.equal(db.tables.processed_emails.length, 0);
});

test("messages beyond the model-call cap are reported as deferred", async () => {
  const db = setup();
  messages = Array.from({ length: 101 }, (_, i) => message(`cap-${i}`));
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.deferred, 1);
  assert.equal(db.tables.processed_emails.length, 100);
});

test("approval during classification cannot consume a later status update", async () => {
  const db = setup();
  const pending = { id: "pending", user_id: userId, message_id: "original", kind: "new", company: "Acme", role: "Backend Engineer", status: "Applied", state: "pending", email_date: new Date().toISOString() };
  db.tables.application_suggestions = [pending];
  messages = [message("later-offer", {}, { category: "offer" })];
  const answer = answers[messages[0].subject];
  answers[messages[0].subject] = () => { pending.state = "approved"; return answer; };
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.errors, 1);
  assert.equal(pending.status, "Applied");
  assert.equal(db.tables.processed_emails.length, 0, "later email must remain retryable");
});

test("a terminal suggestion survives a processed-log failure without endless duplicate errors", async () => {
  const db = setup();
  messages = [message("terminal-retry", {}, { category: "rejection" })];
  db.fail("processed_emails", "upsert", { code: "XX000", message: "Temporary write failure" });
  assert.equal((await syncEmailsForUser(db, userId)).errors, 1);
  db.tables.application_suggestions[0].state = "dismissed";
  const retried = await syncEmailsForUser(db, userId);
  assert.equal(retried.errors, 0);
  assert.equal(db.tables.application_suggestions.length, 1);
  assert.equal(db.tables.processed_emails.length, 1);
});

test("mailbox truncation is visible and prevents a complete-success result", async () => {
  const db = setup();
  messages = [message("mailbox-cap")];
  messages.truncated = 12;
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.truncated, 12);
  assert.equal(result.deferred, 12);
});

test("slow persistence defers remaining classified emails before the route expires", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const db = setup();
  messages = [message("persist-first"), message("persist-later")];
  const original = db.from.bind(db);
  db.from = table => {
    const query = original(table);
    if (table === "processed_emails") {
      const execute = query.execute.bind(query);
      query.execute = () => {
        const result = execute();
        if (query.operation === "upsert") t.mock.timers.tick(48_000);
        return result;
      };
    }
    return query;
  };
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.deferred, 1);
  assert.equal(db.tables.processed_emails.length, 1);
});

test("an ambiguous same-title email stays retryable without a guessed update", async () => {
  const db = setup();
  db.tables.applications = ["one", "two"].map(id => ({ id, user_id: userId, company: "Acme", role: "Backend Engineer", status: "Applied", applied_date: "2026-10-20" }));
  messages = [message("ambiguous", {}, { category: "interview" })];
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.suggestions, 1);
  assert.equal(db.tables.application_suggestions[0].match_reason, "multiple_candidates");
  assert.deepEqual(db.tables.application_suggestions[0].match_candidate_ids, ["one", "two"]);
  assert.ok(db.tables.applications.every(app => app.status === "Applied"));
});
test("ambiguous pending new suggestions are not merged by title alone", async () => {
  const db = setup();
  db.tables.application_suggestions = ["one", "two"].map(id => ({ id, user_id: userId, kind: "new", state: "pending", company: "Acme", role: "Backend Engineer", status: "Applied", email_date: new Date().toISOString() }));
  messages = [message("pending-ambiguous", {}, { category: "interview" })];
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.suggestions, 1);
  assert.ok(db.tables.application_suggestions.filter(item => ["one", "two"].includes(item.id)).every(item => item.status === "Applied"));
  assert.equal(db.tables.application_suggestions[2].match_reason, "pending_candidates");
});

test("an unresolved email stays retryable when identity columns are not installed", async () => {
  const db = setup();
  db.tables.applications = ["one", "two"].map(id => ({ id, user_id: userId, company: "Acme", role: "Backend Engineer", status: "Applied", applied_date: "2026-10-20" }));
  db.fail("application_suggestions", "insert", { code: "42703", message: "Identity migration missing" });
  messages = [message("ambiguous-schema", {}, { category: "interview" })];
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.deferred, 1);
  assert.equal(db.tables.processed_emails.length, 0);
});
