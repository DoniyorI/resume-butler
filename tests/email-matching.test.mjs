import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findTargetApplication,
  isSameCycle,
  normalizeCompany,
  shouldUpdateStatus,
} from "@/server/email/matching";

const now = Date.parse("2026-10-27T12:00:00Z");
const application = (overrides = {}) => ({
  id: "app-backend",
  company: "Acme, Inc.",
  role: "Backend Engineer",
  status: "Applied",
  applied_date: "2026-10-20",
  created_at: "2026-10-20T12:00:00Z",
  ...overrides,
});
const match = (applications, overrides = {}) =>
  findTargetApplication(applications, {
    company: "acme",
    role: "Backend Engineer",
    category: "interview",
    now,
    ...overrides,
  });

test("normalization keeps unrelated company names separate", () => {
  assert.equal(normalizeCompany("Acme, Inc."), "acme");
  assert.equal(match([application({ company: "Acme Labs" })]), null);
  assert.equal(normalizeCompany("Meta") === normalizeCompany("Metabase"), false);
});

test("an unusable company name cannot match another unknown company", () => {
  assert.equal(match([application({ company: "Unknown" })], { company: "" }), null);
});

test("an exact role wins over another open role at the same company", () => {
  const backend = application();
  assert.equal(match([application({ id: "other", role: "Frontend Engineer" }), backend]), backend);
});

test("an explicitly different role never updates the only open application", () => {
  assert.equal(match([application()], { role: "Product Designer", category: "rejection" }), null);
});

test("an ambiguous partial role never picks an arbitrary application", () => {
  assert.equal(
    match([application(), application({ id: "frontend", role: "Frontend Engineer" })], { role: "Engineer" }),
    null
  );
});

test("partial role matches use whole words rather than parts of a word", () => {
  assert.equal(match([application({ role: "Engineering Manager" })], { role: "Engineer" }), null);
});

test("a missing role can match a company's single open application", () => {
  const backend = application();
  assert.equal(match([backend], { role: "", category: "rejection" }), backend);
});

test("a role-less confirmation never revives an old hiring cycle", () => {
  assert.equal(
    match([application({ applied_date: "2025-01-01" })], { role: "", category: "application_received" }),
    null
  );
});

test("a confirmation after rejection is a new application", () => {
  assert.equal(match([application({ status: "Rejected" })], { category: "application_received" }), null);
});

test("a confirmation after the 120-day window is a new application", () => {
  assert.equal(
    match([application({ applied_date: "2026-01-01" })], { category: "application_received" }),
    null
  );
});

test("an old email cannot update an application submitted after that email", () => {
  assert.equal(match([application()], { emailDate: "2026-01-15T10:00:00Z" }), null);
});

test("new suggestions only merge into an open recent hiring cycle at approval", () => {
  assert.equal(match([application({ status: "Rejected" })], { category: "application_received" }), null);
  assert.equal(isSameCycle(application({ applied_date: "2026-01-01" }), now), false);
});

test("email status changes preserve terminal states and accepted offers", () => {
  assert.equal(shouldUpdateStatus("Rejected", "Interviewed"), false);
  assert.equal(shouldUpdateStatus("Withdrew", "Applied"), false);
  assert.equal(shouldUpdateStatus("Offered", "Rejected"), false);
  assert.equal(shouldUpdateStatus("Interviewed", "Applied"), false);
  assert.equal(shouldUpdateStatus("Applied", "Interviewed"), true);
  assert.equal(shouldUpdateStatus("Interviewed", "Rejected"), true);
});
