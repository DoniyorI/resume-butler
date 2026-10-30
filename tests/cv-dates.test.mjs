import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";
import { fromMonthInput, toMonthInput } from "@/features/profile/format";
let db;
const owner = "00000000-0000-4000-8000-000000000001";
const first = "00000000-0000-4000-8000-000000000010", second = "00000000-0000-4000-8000-000000000011";
mock.module("@/server/auth", { namedExports: { requireUser: async () => ({ supabase: db, user: { id: owner } }) } });
mock.module("next/cache", { namedExports: { revalidatePath() {} } });
const { saveEducation } = await import("@/features/cv/actions");
const entry = (id, overrides = {}) => ({ id, school: "Fixture University", degreeType: "Bachelor", major: "Computer Science", location: "", gpa: "", startDate: "", endDate: "", ...overrides });

test("editing education saves when another unchanged row has blank optional dates", async () => {
  db = database({ cv_education: [{ id: first, user_id: owner }, { id: second, user_id: owner }] });
  const result = await saveEducation([entry(first, { startDate: "2024-09-01" }), entry(second)]);
  assert.equal(result.ok, true, result.error);
  assert.equal(db.tables.cv_education[0].start_date, "2024-09-01");
  assert.equal(db.tables.cv_education[1].end_date, null);
});

test("invalid calendar dates fail before education writes", async () => {
  for (const value of ["2025-02-29", "2024-02-30", "2024-13-01", "2024-00-01", "2024-01-00"]) {
    db = database({ cv_education: [{ id: first, user_id: owner, school: "Original" }] });
    const result = await saveEducation([entry(first, { startDate: null, endDate: value })]);
    assert.equal(result.ok, false, value);
    assert.equal(db.tables.cv_education[0].school, "Original");
  }
});

test("month fields handle blank, full and partial dates without malformed submissions", () => {
  assert.equal(toMonthInput("2024-02-29"), "2024-02");
  assert.equal(toMonthInput("2024-02"), "2024-02");
  assert.equal(toMonthInput("2024-99-01"), "");
  assert.equal(toMonthInput("2016"), "");
  assert.equal(fromMonthInput("2024-02"), "2024-02-01");
  assert.equal(fromMonthInput(""), null);
  assert.equal(fromMonthInput("2024-99"), null);
});
