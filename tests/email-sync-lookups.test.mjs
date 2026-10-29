import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { database } from "./helpers/database.mjs";

let messages = [];
mock.module("@/server/email/imapClient", { namedExports: { fetchEmails: async () => messages } });
mock.module("@/server/openai", { namedExports: { chatJSON: async () => { throw new Error("Processed messages must not reach AI"); } } });
const { syncEmailsForUser } = await import("@/server/email/sync");
const { encryptSecret } = await import("@/server/crypto");
const userId = "00000000-0000-4000-8000-000000000010";

function fixture(ids) {
  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  messages = ids.map(messageId => ({ messageId, subject: "Thanks for applying", from: "jobs@example.test", fromAddress: "jobs@example.test", body: "Application received", date: new Date() }));
  const rows = ids.map((message_id, i) => ({ id: String(i).padStart(6, "0"), user_id: userId, message_id, action_taken: "suggested" }));
  const db = database({
    email_connections: [{ user_id: userId, imap_host: "imap.gmail.com", email_address: "qa@example.test", app_password: encryptSecret("synthetic-password"), is_active: true }],
    processed_emails: rows,
  });
  const requests = [];
  const client = createClient("https://database.example.test", "fictional-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(input);
      requests.push(url);
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
      // Exercise the actual Supabase URL serializer, including percent encoding.
      if (Buffer.byteLength(url.href) > 6000) {
        return Response.json({ message: "TypeError: fetch failed", code: "UND_ERR_HEADERS_OVERFLOW" }, { status: 502 });
      }
      let selected = db.tables.processed_emails.filter(row => row.user_id === userId).sort((a, b) => a.id.localeCompare(b.id));
      const filter = url.searchParams.get("message_id");
      if (filter) {
        const values = filter.slice(4, -1).split(",").map(value => value.replace(/^"|"$/g, ""));
        selected = selected.filter(row => values.includes(row.message_id));
      }
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 1000);
      return Response.json(selected.slice(offset, offset + limit));
    } },
  });
  const from = db.from.bind(db);
  db.from = table => {
    const query = from(table);
    if (table === "processed_emails") query.select = columns => client.from(table).select(columns);
    return query;
  };
  return { db, requests };
}

test("a full mailbox uses bounded processed-ID queries and skips every processed email", async () => {
  const ids = Array.from({ length: 300 }, (_, i) => `<${i}.${"long-message-id-".repeat(5)}@mail.example.test>`);
  const { db, requests } = fixture(ids);
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.candidates, 0);
  assert.equal(result.errors, 0);
  assert.ok(requests.length > 1);
  assert.ok(requests.every(url => Buffer.byteLength(url.href) <= 6000));
});

test("encoded Unicode and unusually long message IDs cannot overflow lookup URLs", async () => {
  const ids = Array.from({ length: 35 }, (_, i) => `<${i}.${"履歴 @".repeat(35)}@mail.test>`);
  ids.push(`<${"long".repeat(4000)}@mail.test>`);
  const { db, requests } = fixture(ids);
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.candidates, 0);
  assert.equal(result.errors, 0);
  assert.ok(requests.every(url => Buffer.byteLength(url.href) <= 6000));
});


test("an oversized ID beyond the first history page is still recognized", async () => {
  const id = `<${"long".repeat(4000)}@mail.test>`;
  const { db, requests } = fixture([id]);
  db.tables.processed_emails[0].id = "999999";
  for (let i = 0; i < 1000; i++) {
    db.tables.processed_emails.push({ id: String(i).padStart(6, "0"), user_id: userId, message_id: `old-${i}`, action_taken: "suggested" });
  }
  const result = await syncEmailsForUser(db, userId);
  assert.equal(result.candidates, 0);
  assert.equal(result.errors, 0);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get("offset"), "1000");
});

test("a failed later lookup batch aborts without marking new messages processed", async () => {
  const ids = Array.from({ length: 100 }, (_, i) => `<${i}.${"long-message-id-".repeat(5)}@mail.example.test>`);
  const { db } = fixture(ids);
  const from = db.from.bind(db);
  let queries = 0;
  db.from = table => {
    const query = from(table);
    if (table === "processed_emails" && ++queries === 2) {
      query.select = () => ({ eq: () => ({ in: async () => ({ data: null, error: { code: "XX000", message: "Synthetic batch failure" } }) }) });
    }
    return query;
  };
  await assert.rejects(syncEmailsForUser(db, userId), error => error.code === "XX000");
  assert.equal(db.tables.processed_emails.length, 100);
  assert.equal(db.tables.application_suggestions.length, 0);
  assert.equal(db.tables.email_connections[0].last_scan_at, undefined);
});
