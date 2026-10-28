import assert from "node:assert/strict";
import { test } from "node:test";
import { readOwnedPages } from "@/server/applications/readOwnedPages";
import { database } from "./helpers/database.mjs";
test("matching sees owned candidates beyond the first API page", async () => {
  const rows = Array.from({ length: 1003 }, (_, id) => ({ id: String(id).padStart(4, "0"), user_id: "owner" }));
  const db = database({ applications: [...rows, { id: "other", user_id: "someone-else" }] });
  const loaded = await readOwnedPages(db, "owner", "applications", "id");
  assert.equal(loaded.length, 1003);
  assert.equal(loaded.at(-1).id, "1002");
  assert.equal(loaded.some(row => row.id === "other"), false);
});
test("legacy metadata fallback keeps the pending-state restriction", async () => {
  const db = database({ application_suggestions: [{ id: "a", user_id: "owner", state: "pending" }, { id: "b", user_id: "owner", state: "approved" }] });
  db.fail("application_suggestions", "select", { code: "42703" });
  const rows = await readOwnedPages(db, "owner", "application_suggestions", "id,match_reason", { pending: true, legacyColumns: "id" });
  assert.deepEqual(rows, [{ id: "a" }]);
});
