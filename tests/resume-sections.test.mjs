import assert from "node:assert/strict";
import { test } from "node:test";
import * as document from "../src/features/resumes/resumeDocument.js";
import { generateLatex } from "../src/server/latex.js";
import { resumeToText } from "../src/server/ats/resumeText.js";
import { printableResumeKey } from "../src/features/resumes/pdfContentKey.js";
import { scoreResume } from "../src/server/ats/score.js";
import { resumeContentSchema } from "../src/features/resumes/documentSchema.js";

const customId = "custom:11111111-1111-4111-8111-111111111111";
const custom = { id: customId, title: "Research & service", type: "entries", items: [{ id: "22222222-2222-4222-8222-222222222222", title: "Compiler research", subtitle: "Fictional lab", date: "2025", description: ["Published a parser benchmark."] }] };
const content = () => ({ customSections: [structuredClone(custom)], certifications: [{ title: "Cloud credential", subtitle: "Fictional issuer", date: "2024" }], order: [{ id: customId, title: "Research & service" }] });

test("custom sections and certifications survive legacy-compatible normalization and JSON round trips", () => {
  const normalized = document.normalizeResumeContent(content());
  assert.equal(normalized.schemaVersion, 2);
  assert.deepEqual(normalized.customSections, [custom]);
  assert.equal(normalized.certifications[0].title, "Cloud credential");
  assert.equal(normalized.order[0].id, customId);
  assert.deepEqual(document.normalizeResumeContent(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.deepEqual(document.normalizeResumeContent({ experience: [{ companyName: "Legacy" }] }).experience, [{ companyName: "Legacy" }]);
  assert.throws(() => document.normalizeResumeContent({ schemaVersion: 99 }), /version/i);
});

test("save validation defaults do not invalidate PDF checks for certifications", () => {
  const doc = document.normalizeResumeContent(content());
  const saved = resumeContentSchema.parse(doc);
  assert.equal(printableResumeKey(doc), printableResumeKey(saved));
});

test("switching a custom section layout gives no scan credit for retained unprinted fields", () => {
  const doc = document.normalizeResumeContent(content());
  doc.customSections[0] = { ...doc.customSections[0], type: "text", items: [{ ...doc.customSections[0].items[0], text: "Visible statement" }] };
  doc.order[0].type = "text";
  assert.match(resumeToText(doc), /Visible statement/);
  assert.doesNotMatch(resumeToText(doc), /Compiler research|parser benchmark/);
  assert.doesNotMatch(generateLatex(doc), /Compiler research|parser benchmark/);
  const changed = structuredClone(doc);
  changed.customSections[0].items[0].description = ["Invisible changed fact"];
  assert.equal(printableResumeKey(doc), printableResumeKey(changed));
});

test("application scans give hidden sections no section or bullet credit", () => {
  const doc = document.normalizeResumeContent({ experience: [{ companyName: "Hidden employer", position: "Engineer", description: ["Java systems and PostgreSQL data."] }], order: [{ id: "experience", title: "Experience", hidden: true }] });
  const result = scoreResume("Java PostgreSQL engineer", doc);
  assert.equal(result.sectionScore, 0);
  assert.deepEqual(result.bulletFeedback, []);
  assert.equal(result.keywordScore, 0);
});

test("unsupported newer documents are recoverable in a read-only editor without reinterpreting them", () => {
  const original = { schemaVersion: 99, revision: 7, newSections: [{ title: "Preserve me", facts: ["Original fact"] }] };
  const view = document.readResumeForEditing(original);
  assert.equal(view.readOnly, true);
  assert.equal(view.content, null);
  assert.deepEqual(view.rawContent, original);
  assert.match(view.reason, /newer|unsupported/i);
  assert.equal(document.readResumeForEditing({ experience: [] }).readOnly, false);
});

test("custom IDs require UUID groups rather than an arbitrary run of hyphens", () => {
  const malformed = content();
  malformed.customSections[0].id = "custom:" + "-".repeat(36);
  malformed.order[0].id = malformed.customSections[0].id;
  assert.throws(() => document.normalizeResumeContent(malformed), /custom section/i);
});

test("custom section edits are immutable and do not change Master CV source copies", () => {
  const source = document.normalizeResumeContent(content());
  const changed = document.withSectionItems(source, customId, [{ ...custom.items[0], title: "Edited research" }]);
  assert.equal(document.sectionItems(changed, customId)[0].title, "Edited research");
  assert.equal(source.customSections[0].items[0].title, "Compiler research");
});

test("custom and certification exports escape headings and exclude hidden text from scan and PDF freshness", () => {
  const visible = document.normalizeResumeContent(content());
  const latex = generateLatex(visible);
  assert.match(latex, /Research \\& service/);
  assert.match(latex, /Compiler research/);
  assert.match(latex, /Cloud credential/);
  const unsafe = structuredClone(visible);
  unsafe.customSections[0].items[0].url = "javascript:alert(1)";
  assert.doesNotMatch(generateLatex(unsafe), /javascript:/);
  assert.match(resumeToText(visible), /parser benchmark/);
  const hidden = { ...visible, order: visible.order.map(s => ({ ...s, hidden: s.id === customId })) };
  assert.doesNotMatch(generateLatex(hidden), /Compiler research/);
  assert.doesNotMatch(resumeToText(hidden), /parser benchmark/);
  const changedHidden = structuredClone(hidden);
  changedHidden.customSections[0].items[0].title = "Secret replacement";
  assert.equal(printableResumeKey(hidden), printableResumeKey(changedHidden));
  assert.notEqual(printableResumeKey(visible), printableResumeKey(hidden));
});

test("appendBullet adds a Master CV bullet to the matching entry only, once", () => {
  const items = [
    { companyName: "Harbor Ledger", position: "Software Engineer", description: ["Built services in Python"] },
    { companyName: "Tallow Freight", position: "Junior Developer", description: "Packaged jobs with Docker" },
  ];
  const added = document.appendBullet("experience", items, { companyName: " harbor ledger", position: "Software Engineer" }, "Tuned PostgreSQL queries");
  assert.deepEqual(added[0].description, ["Built services in Python", "Tuned PostgreSQL queries"]);
  assert.equal(added[1], items[1]);
  assert.deepEqual(items[0].description, ["Built services in Python"]);
  assert.equal(document.appendBullet("experience", added, { companyName: "Harbor Ledger", position: "Software Engineer" }, "Tuned PostgreSQL queries"), null);
  assert.equal(document.appendBullet("experience", items, { companyName: "Nowhere", position: "Software Engineer" }, "x"), null);
  assert.deepEqual(document.appendBullet("experience", items, { companyName: "Tallow Freight", position: "Junior Developer" }, "More")[1].description, ["Packaged jobs with Docker", "More"]);
  const projects = [{ projectName: "Ledger CLI", description: [] }];
  assert.deepEqual(document.appendBullet("projects", projects, { projectName: "ledger cli" }, "Wrote a parser")[0].description, ["Wrote a parser"]);
  assert.equal(document.appendBullet("skills", items, {}, "x"), null);
});

test("findResumeItem and appendBullet tell same-titled roles apart by start date, and fall back without dates", () => {
  const items = [
    { companyName: "Harbor Ledger", position: "Engineer", startDate: "2019-01-01", description: ["first"] },
    { companyName: "Harbor Ledger", position: "Engineer", startDate: "2022-01-01", description: ["second"] },
  ];
  const second = { company: "Harbor Ledger", position: "Engineer", startDate: "2022-01-01" };
  assert.equal(document.findResumeItem.experience(second, items), items[1]);
  assert.equal(document.findResumeItem.experience({ ...second, startDate: "2020-05-01" }, items), undefined);
  assert.equal(document.findResumeItem.experience({ ...second, startDate: "" }, items), items[0]);
  const undated = [{ ...items[0], startDate: "" }];
  assert.equal(document.findResumeItem.experience(second, undated), undated[0]);
  const added = document.appendBullet("experience", items, { companyName: "Harbor Ledger", position: "Engineer", startDate: "2022-01-01" }, "extra");
  assert.deepEqual(added[0].description, ["first"]);
  assert.deepEqual(added[1].description, ["second", "extra"]);
  const projects = [{ projectName: "Atlas", startDate: "2020-01-01" }, { projectName: "Atlas", startDate: "2023-01-01" }];
  assert.equal(document.findResumeItem.projects({ name: "atlas", startDate: "2023-01-01" }, projects), projects[1]);
});
