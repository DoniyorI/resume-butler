import assert from "node:assert/strict";
import { test } from "node:test";
import { printableResumeKey, hashPdfContentKey } from "@/features/resumes/pdfContentKey";

const source = () => ({ header: { name: "Alex", email: "alex@example.test" }, experience: [], projects: [], education: [], skills: [{ header: "Languages", skills: "Python" }], order: [{ id: "skills", title: "Skills" }] });
test("PDF fingerprints survive database object-key reordering", async () => {
  const a = source();
  const b = { ...a, header: { email: a.header.email, name: a.header.name } };
  assert.equal(await hashPdfContentKey(printableResumeKey(a)), await hashPdfContentKey(printableResumeKey(b)));
});
test("visible titles and ordering are part of the PDF identity", () => {
  const a = source(), b = source();
  b.order[0].title = "Technical Skills";
  assert.notEqual(printableResumeKey(a), printableResumeKey(b));
});
test("targeting metadata cannot invalidate a page-count result", () => {
  const a = source(), b = source();
  b.target = { jobDescription: "Different job" };
  assert.equal(printableResumeKey(a), printableResumeKey(b));
});
test("editing content hidden from the PDF cannot trigger another compilation", () => {
  const a = source(), b = source();
  a.order[0].hidden = b.order[0].hidden = true;
  b.skills[0].skills = "Python, SQL, Java";
  assert.equal(printableResumeKey(a), printableResumeKey(b));
});

test("absent and empty contact fields describe the same printed header", () => {
  const a = source(), b = source();
  b.header = { ...b.header, phone: "", linkedin: "", github: "", location: "Not printed" };
  assert.equal(printableResumeKey(a), printableResumeKey(b));
});
