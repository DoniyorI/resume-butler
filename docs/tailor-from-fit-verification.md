# Tailoring from fit: verification

November 13, 2026. Covers roadmap milestone M5 (formerly B3).

## What changed

The editor's Tailor tab has a new card, **Fit for this job**. It turns the fit result into a tailored page without writing anything for the user.

- **What the page is missing.** "This page shows N of M requirements your Master CV backs", then one row per requirement the Master CV backs and the page leaves out, with the user's own line quoted.
- **One click to add it.** Each row adds exactly what the Master CV contains: the whole entry, the one bullet (when the entry is already on the page), or the one skill. Every add can be undone.
- **What the Master CV lacks is asked about.** A requirement the Master CV does not back has a single control, "I have this". It adds the skill to the Master CV, after which it can be added to the page like any other. There is no control that puts such a term on the page directly.
- **Pick the best CV entries** now ranks entries by the requirements their own text backs and states the reason for each ("Backs python and postgresql"). The current role is always kept. It no longer calls AI.
- **Job match** no longer offers one-click additions of missing keywords to Skills.

`POST /api/resume-fit` returns the fit, the plan and the gaps. It calls no model, so it has no rate limit and costs nothing per use.

## The rule this milestone keeps

Nothing reaches the resume page from this card that is not the user's own Master CV text. Entries and bullets are copied verbatim; skills come from the Master CV's skill rows; a missing requirement must be claimed by the user in the Master CV first. AI rewrites of bullets remain a separate, guarded feature.

## Evidence

- **Tests:** 435 pass with `npm test` on Node 26.3.0, and on Node 24 in the `Checks` workflow. New tests cover the ranking (score, recency, caps, the current role, never empty), each kind of addable row, same-titled roles, a skills-only term, a degree (never addable), a missing term with alternatives, the route (401, 400, and a response without raw CV rows), and the AI picker's fallback.
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree.
- **Signed-in browser flow:** `scripts/qa-tailor-from-fit.mjs` passed every step on a disposable account: the card reads "0 of 4" on an empty page; "Add entry" puts an experience on the page with all its bullets and clears both requirements it backs; "Add to Skills" adds one skill; the card then says the page shows everything the Master CV backs; "I have this" creates exactly one Master CV skill even when clicked twice at once, and the term returns as an addable skill; "Pick the best CV entries" previews picks with reasons and applies them; a resume that has the entry but not the bullet is offered "Add bullet", which appends exactly the seeded text, and undo removes it; an entry in a hidden section is shown again instead of duplicated; no page errors; no AI endpoint called. `scripts/qa-saved-job-flow.mjs` and `scripts/qa-saved-job-fit.mjs` still pass.
- **Review:** an independent review confirmed that a missing requirement cannot reach the page without going through the Master CV and that the editor's undo is intact. Its nine findings were fixed, including duplicates from hidden sections, two roles with the same title being treated as one, and a double submit on "I have this".

## Known limits

- **It inherits the fit engine's limits** ([docs/fit-verification.md](fit-verification.md)): a fixed skill list, matching by name, importance from headings.
- **"I have this" is the user's word.** The product records the skill in the Master CV; it does not check the claim. The form says to add only what could be discussed in an interview.
- **Adds are whole units.** An entry comes with all its bullets; trimming is the user's edit or the existing AI suggestions.
- **Certifications and custom sections** back requirements in the fit result but are not offered as one-click adds here, and "Pick the best CV entries" leaves those sections as they are.
- **Terms are shown in lower case** ("postgresql"), as the engine names them.
- **Two roles with the same company, title and start date** are still treated as one.
- **The AI picker** (`/api/tailor-resume`) remains on the server and is no longer used by the editor.
