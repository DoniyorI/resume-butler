import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const user = "11111111-1111-4111-8111-111111111111";
const id = "00000000-0000-4000-8000-0000000000aa";
const state = { db: null };
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: state.db, user: { id: user } }) } });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });
mock.module("next/navigation", { namedExports: { redirect() {} } });
const { updateApplication } = await import("@/features/applications/actions");

const fresh = () => {
  state.db = database({ applications: [{ id, user_id: user, company: "Acme", role: "Eng", status: "Applied", applied_date: "2026-10-01" }] });
  return state.db;
};

test("updating an application with a blank applied date keeps the stored date", async () => {
  const db = fresh();
  for (const blank of ["", null, undefined]) {
    const result = await updateApplication(id, { company: "Acme", role: "Eng", status: "Applied", appliedDate: blank });
    assert.equal(result.ok, true);
    assert.equal(db.tables.applications[0].applied_date, "2026-10-01");
  }
  const changed = await updateApplication(id, { company: "Acme", role: "Eng", status: "Applied", appliedDate: "2026-10-05" });
  assert.equal(changed.ok, true);
  assert.equal(db.tables.applications[0].applied_date, "2026-10-05");
});
