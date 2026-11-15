# PDF readability check: verification

November 14, 2026. Covers roadmap milestone M13 (the rest of A9). No migration, no AI.

## What it does

In the resume editor, Download → "Check PDF text" saves pending edits and compiles the resume through the same LaTeX pipeline as the download. It then reads the PDF's text back with `pdf2json`, the extractor resume upload already uses (`src/server/resume/pdfText.js`). The dialog shows:

- "Read back N of M lines from your PDF", and the page count read;
- every line of the user's own resume that was not found, quoted and grouped by section;
- each contact detail as found or not found;
- whether the section headings were read in the order they are printed;
- the full extracted text, as plain text.

`checkReadability` (`src/server/resume/readability.js`) is pure. It lists what `generateLatex` prints, only visible sections and entries. It normalizes both sides the same way: NFKC, quotes and dashes, whitespace, words hyphenated across lines, and case. Long bullets also match when wrapped across lines. A PDF with almost no text is reported as unreadable, and an empty resume as having nothing to check.

There is no score. The dialog says it shows what a PDF text extractor reads, that applicant tracking systems use different readers, and that it is a check, not a guarantee.

`POST /api/resume-readability` needs a sign-in and counts against the `download-resume` hourly limit, like the page count. A resume that belongs to someone else returns 404 with no text.

## Evidence

- **Tests:** 642 pass with `npm test`, and on Node 24 in the `Checks` workflow. Unit tests cover ligatures, curly quotes, dashes in dates, hyphenation, wrapped bullets, a missing bullet, headings out of order, an unreadable PDF, an empty resume and hidden sections not being expected. A real PDF compiled by the production pipeline from a synthetic resume (`tests/fixtures/readability-resume.pdf`, rebuilt by `scripts/build-readability-fixture.mjs`) reads back 35 of 36 lines. The test asserts exactly that one miss, described below.
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree.
- **Signed-in browser flow:** `scripts/qa-resume-readability.mjs` signs in a disposable user and seeds a resume, then opens the editor and runs the check. It confirms "Read back 36 of 36", the name and a bullet in the extracted text, the dialog at 375px without overflow, another user's resume answering 404 with no text, and no page errors. The user was removed afterwards.

## What it found

- **Accented letters (fixed the same day):** pdflatex in the default OT1 encoding drew an accented letter as a letter plus a separate mark, so "résumé" was extracted as "r ́esum ́e". OT1 also misprinted `<`, `>` and `|`.
  - **The change:** both preambles now load `\usepackage[T1]{fontenc}` and `\usepackage{lmodern}` (Latin Modern keeps the Computer Modern metrics).
  - **Re-measured by compiling the same documents before and after:**

    | Document | Page count | Line breaks | Largest vertical drift |
    |---|---|---|---|
    | Fixture resume | Unchanged | Identical | 0.11 pt |
    | Two-page resume | Unchanged | Identical | 0.11 pt |
    | Cover letter | Unchanged | Identical | 0.18 pt |

    So the editor CSS was left as it was.
  - **The fixture now reads back every line,** including "résumé", "José Müller" and `< 200 ms | handled > 5k`. `tests/latex-preamble.test.mjs` keeps T1 in both preambles.
  - **The dialog's accent note remains** for the rare case it is still needed.
- **Contact icons** come out as stray characters between contact values; the values themselves are read correctly.

## Known limits

- It checks one extractor. Other parsers may read a PDF differently.
- Uploaded PDFs, as opposed to resumes built in the editor, are not checked.
- Cover letters are not checked.
