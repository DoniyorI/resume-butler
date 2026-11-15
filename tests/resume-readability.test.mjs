import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkReadability, expectedLines } from "@/server/resume/readability";
import { extractPdfPages, extractPdfText } from "@/server/resume/pdfText";
import { readabilityResume } from "./fixtures/readability-resume.mjs";

const resume = {
  header: { name: "Alex Example", email: "alex@example.test", phone: "555-0100" },
  experience: [{
    companyName: "Northwind Labs", position: "Engineer", startDate: "2021-01-01", endDate: "2022-03-01",
    description: ["Built an efficient scheduling service", "Cut load time by 50%"],
  }],
  order: [{ id: "experience", title: "Experience" }],
};
const read = [
  "Alex Example", "alex@example.test", "555-0100", "Experience",
  "Northwind Labs    Remote", "Engineer    January 2021 - March 2022",
  "Built an efficient scheduling service", "Cut load time by 50%",
].join("\n");

test("every printed line found in a faithful extraction", () => {
  const result = checkReadability(resume, read, { pages: 1 });
  assert.equal(result.status, "ok");
  assert.equal(result.found, result.expected);
  assert.deepEqual(result.missing, []);
  assert.equal(result.headingsInOrder, true);
  assert.deepEqual(result.contact.map((c) => c.found), [true, true]);
  assert.equal(result.pages, 1);
});

test("ligature glyphs are split by NFKC, but a word the extractor spaced apart is missing", () => {
  assert.equal(checkReadability(resume, read.replace("efficient", "eﬃcient")).missing.length, 0);
  const spaced = checkReadability(resume, read.replace("efficient", "ef ficient"));
  assert.deepEqual(spaced.missing.map((m) => m.text), ["Built an efficient scheduling service"]);
});

test("curly quotes, en dashes and case do not matter", () => {
  const quoted = { ...resume, experience: [{ ...resume.experience[0], description: ["Led the \"platform\" team's rollout"] }] };
  const text = read.replace("Built an efficient scheduling service", "Led the “platform” team’s rollout").replace("January 2021 - March 2022", "JANUARY 2021 – MARCH 2022");
  assert.equal(checkReadability(quoted, text).missing.length, 0);
});

test("a word hyphenated across a line break is joined, and a real hyphen is kept", () => {
  const hyphen = { ...resume, experience: [{ ...resume.experience[0], description: ["Built an efficient scheduling service", "Moved to event-driven services"] }] };
  const broken = read.replace("Cut load time by 50%", "Moved to event-\ndriven services").replace("efficient", "effi-\ncient");
  assert.equal(checkReadability(hyphen, broken).missing.length, 0);
});

const longBullet = "Led the migration of a monolithic workflow engine to event-driven services across four teams and two time zones with no downtime";
const longResume = { ...resume, experience: [{ ...resume.experience[0], description: [longBullet] }] };

test("a long bullet wrapped over lines is found, even with other text between the lines", () => {
  const wrapped = "Led the migration of a monolithic workflow engine to event-driven\nservices across four teams and two time zones with no downtime";
  assert.equal(checkReadability(longResume, `${read}\n${wrapped}`).missing.length, 0);
  const interleaved = "Led the migration of a monolithic workflow engine to event-driven\nSome other line\nservices across four teams and two time zones with no downtime";
  assert.equal(checkReadability(longResume, `${read}\n${interleaved}`).missing.length, 0);
  const lost = "Led the migration of a monolithic workflow engine to event-driven\nservices across four";
  assert.equal(checkReadability(longResume, `${read}\n${lost}`).missing.length, 1);
});

test("a missing bullet is named under its section, verbatim", () => {
  const result = checkReadability(resume, read.replace("Cut load time by 50%", ""));
  assert.deepEqual(result.missing, [{ section: "Experience", text: "Cut load time by 50%" }]);
  assert.equal(result.found, result.expected - 1);
});

test("headings read in a different order are reported", () => {
  const two = { ...resume, education: [{ school: "Fixture University", endDate: "2018-05-01" }],
    order: [{ id: "experience", title: "Experience" }, { id: "education", title: "Education" }] };
  const body = `${read}\nFixture University\nMay 2018`;
  assert.equal(checkReadability(two, body.replace("Experience", "Education").replace("Fixture University", "Experience")).headingsInOrder, false);
  const swapped = checkReadability(two, ["Education", "Fixture University", "May 2018", read].join("\n"));
  assert.equal(swapped.headingsInOrder, false);
  assert.deepEqual(swapped.headingOrder, ["Education", "Experience"]);
  assert.equal(checkReadability(two, body).headingsInOrder, true);
});

test("an image-only PDF has no text and an empty resume has nothing to read", () => {
  assert.equal(checkReadability(resume, " \n ").status, "no-text");
  const none = checkReadability(resume, "");
  assert.equal(none.found, 0);
  assert.ok(none.missing.length > 0);
  assert.equal(checkReadability({}, read).status, "empty-resume");
  assert.equal(checkReadability({ header: {}, order: [{ id: "experience", title: "Experience" }] }, "").status, "empty-resume");
});

test("hidden sections and entries that are not printed are not expected", () => {
  const hidden = { ...resume, order: [{ id: "experience", title: "Experience", hidden: true }, { id: "education", title: "Education", hidden: true }],
    education: [{ school: "Fixture University" }] };
  const lines = expectedLines(hidden).map((l) => l.text);
  assert.ok(!lines.includes("Northwind Labs") && !lines.includes("Fixture University") && !lines.includes("Experience"));
  const noDate = expectedLines({ ...resume, experience: [{ companyName: "A", position: "B", endDate: "2020-01-01" }] }).map((l) => l.text);
  assert.ok(!noDate.some((t) => t.includes("2020")), "a date range prints only with a start date");
});

test("custom sections print their lines and the pdf2json page marker is not part of the text", () => {
  const custom = { header: { name: "Alex Example" }, customSections: [{ id: "custom:00000000-0000-4000-8000-000000000001", type: "list", title: "Awards", items: [{ id: "a", text: "Dean's list" }] }] };
  assert.deepEqual(expectedLines(custom).map((l) => l.text), ["Alex Example", "Awards", "Dean's list"]);
});

test("the PDF compiled from a synthetic resume reads back, except an accented word", async () => {
  const buffer = await readFile(new URL("./fixtures/readability-resume.pdf", import.meta.url));
  const pages = await extractPdfPages(buffer);
  const text = await extractPdfText(buffer);
  assert.ok(!/Page \(\d+\) Break/.test(text));
  const result = checkReadability(readabilityResume, text, { pages: pages.length });
  assert.equal(result.status, "ok");
  assert.equal(result.pages, 1);
  assert.equal(result.headingsInOrder, true);
  assert.deepEqual(result.headingOrder, ["Experience", "Education", "Projects", "Technical Skills", "Certifications"]);
  assert.ok(result.contact.every((c) => c.found), "every contact value is read");
  // pdflatex draws the accent in "résumé" as a separate mark, so the extractor reads "r ́esum ́e"
  assert.deepEqual(result.missing, [{ section: "Projects", text: "Published a command-line tool that checks résumé files for formatting problems" }]);
  assert.equal(result.found, result.expected - 1);
});
