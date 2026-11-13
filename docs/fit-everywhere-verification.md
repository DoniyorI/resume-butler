# Fit everywhere: verification

November 13, 2026. Covers roadmap milestone M6.

## What changed

- **Application page.** An application with a saved job description shows "Fit for this job": the same band, reason and evidence panel as Saved jobs, computed from the saved description, the Master CV and the linked resume.
- **Today.** A new suggestion names saved jobs that are a strong or good fit and not yet applied to (at most two, strongest first). Such a job no longer also gets the generic "decide" suggestion.
- **Extension popup (0.6.0).** The compare panel is now Fit: the band and reason, what the Master CV lacks, what is only listed, what the selected resume leaves out, the years and degree comparison, and the lines only the user can judge. The keyword percentage is gone from this mode.
- **Readable skill names.** PostgreSQL, CI/CD, Node.js and the rest are shown by their proper names wherever fit appears, including pick reasons.
- **Fix.** The popup no longer hides a freshly captured description when the stored one is an empty string.

## What the extension is sent

`/api/extension/job-score` keeps its existing fields and adds `fit`, trimmed by `fitSummary`: band, reason, counts, requirement names, and quotes taken from the posting. **It never carries text from the user's CV** (no evidence quotes, entry titles or skill rows), because the extension runs alongside pages the user does not control. A test serialises the response and checks for seeded CV text.

The popup falls back to keyword coverage when the server sends no `fit`, so an old popup against the new server and a new popup against an old server both keep working.

## Evidence

- **Tests:** 457 pass with `npm test` on Node 26.3.0, and on Node 24 in the `Checks` workflow. New tests cover skill labels, the fit summary and its caps, a response with no CV text, `fit: null` when the engine throws, the new suggestion rule with its cap and suppression, and the popup's rendering for every band, both fallbacks, and markup in a quote rendered as text.
- **Lint and build:** clean; the production build ran on an isolated copy of the committed tree.
- **Signed-in browser flows:** `scripts/qa-saved-job-flow.mjs` passed including the new step that finds the fit band and "Based on the saved job description." on the application page. `scripts/qa-saved-job-fit.mjs`, `scripts/qa-tailor-from-fit.mjs` and `scripts/qa-next-steps.mjs` (pre-migration path) pass with the labels. Each run uses and removes one disposable account.
- **Popup fixture run:** `scripts/qa-extension-job-score-popup.mjs` loads the real popup files in Chrome at 360px with a stubbed extension API: 18 checks, no page errors.

## Not verified

- **The popup inside the installed extension on a live job site.** The fixture run uses the real popup files but a stubbed `chrome` API. After reloading the unpacked extension, open a posting and press "Check fit" once.
- **The new Today suggestion in a browser.** It is unit-tested, and the dashboard loads with the new code, but no browser run seeded a strong-fit saved job and looked for the sentence.

## To get the new popup

Open `chrome://extensions` and press reload on the unpacked Resume Butler card. Open job tabs are re-injected; no page reload is needed.

## Known limits

- **Fit on an application uses the saved description.** Editing the description in the form does not update the card until it is saved.
- **The dashboard computes fit for the 20 newest unapplied saved jobs** on each load.
- **The popup shows names, not evidence.** The quotes that back each requirement are in the app.
