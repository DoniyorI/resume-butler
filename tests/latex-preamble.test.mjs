import assert from "node:assert/strict";
import { test } from "node:test";
import { generateCoverLetterLatex, generateLatex } from "@/server/latex";
import { readabilityResume } from "./fixtures/readability-resume.mjs";

const letter = { header: { name: "José Müller" }, recipient: { name: "A", company: "B" }, date: "", paragraphs: ["Hello"] };

test("both documents use T1 fonts so accented letters stay one glyph in the text layer", () => {
  for (const tex of [generateLatex(readabilityResume), generateCoverLetterLatex(letter)]) {
    assert.match(tex, /\\usepackage\[T1\]\{fontenc\}/);
    assert.match(tex, /\\usepackage\{lmodern\}/);
    assert.match(tex, /\\pdfgentounicode=1/);
    assert.ok(tex.indexOf("{fontenc}") < tex.indexOf("\\begin{document}"));
  }
});

test("accents and < > | pass through to the document unchanged", () => {
  const tex = generateCoverLetterLatex({ ...letter, paragraphs: ["é ü ñ ç ø < > |"] });
  assert.ok(tex.includes("José Müller") && tex.includes("é ü ñ ç ø < > |"));
});
