# Extension capture and keyword comparison verification

Version0.5.0 fixes the generated-class LinkedIn markup supplied by the user and adds the requested deterministic popup comparison against an owned resume or Master CV. It does not introduce AI scoring, other autofill adapters or application submission automation.

## Capture and attribution

The supplied posting 4484740117 uses metadata anchors for salary, Remote and Full-time, and an expandable description under About the job. The old reader returned no salary and no description in the browser fixture. The updated reader recognizes both direct and search-result link forms without relying on generated classes. In this example, the metadata range is USD 200,000–230,000/year; the description's separate USD 190,000–230,000 text is preserved without replacing the metadata range.

Independent review found a stale SPA-panel hazard: URL B could be paired with description A and cached. Its regression failed before the guard and passes afterward. Generated detail panels must carry matching linked metadata. Incompatible panels return no job until loaded; wrong-ID structured data is rejected. The detector captures settled changes without repeating unchanged writes, skips confirmation-page capture and preserves nonempty cached detail fields. A second review finding identified legacy layout rejection; a matching structured-data/older-description regression failed, then passed after restricting generated-panel binding to the new expandable layout.

Migration018 changes only the generated extension default note, derives site labels from the normalized posting URL, preserves SQL privileges and event fingerprints, and backfills only exact untouched generic notes on extension-sourced records. It was applied transactionally in the configured Supabase project's authenticated SQL editor; the editor reported **Success. No rows returned**. Applied migrations001–018 are immutable; the next migration is 019.

## Comparison

`POST /api/extension/job-score` authenticates the existing extension bearer token and validates a bounded strict body. Every resume, profile and CV-table read scopes the authenticated owner. Only keyword coverage, recognized terms and source identity return to the popup; CV text and resume content do not. It reuses `scoreResume`'s keyword logic, not the combined formatting/quality ATS score. Hidden resume sections are excluded. Master CV entries use the existing resume adapters. Empty sources fail clearly; no recognized job terms returns a null score.

The popup compares only after a click, clears results when the selected source/description changes, and ignores late responses. The worker rejects stale account/token/tab contexts and allows only popup messages. Results are temporary, not stored on the employer page or in extension storage. Compare again after editing the saved source elsewhere. This checker does not determine skill proficiency, actual experience duration, eligibility, document parsing or interview likelihood; its recognized vocabulary is CS-focused and incomplete.

## Evidence

- 221 Node tests pass, including 7 new score service/worker tests and cached-field preservation assertions.
- 38 browser capture/detector checks: supplied structure, regenerated classes, both URL forms, unrelated/hidden metadata, hourly pay, description sanitization, stale panels, delayed loads, confirmation preservation and legacy structured data. Zero page errors or employer submission requests.
- 13 disposable PostgreSQL assertions: four site labels, safe backfill, edited/manual notes preserved, replay identity and function ACLs.
- 18 comparison-popup checks: explicit source selection, pay display, evidence, stale response invalidation, unknown terms, failure recovery and no horizontal overflow at 320/360 px. Screenshot `/tmp/resume-butler-extension-job-score.png` uses fictional data and an intercepted comparison response.
- 16 live local API checks against two existing fictional accounts: real token authentication, owned/foreign resumes, hidden text, input limits, no-store, Master CV, no recognized terms and revoked tokens. Run `a58e0808`; fictional resume 555dc706-b5a4-4062-87cf-fd38b8a03e9d remains in the QA account. All created tokens were revoked.
- 20 existing autofill-popup checks and 14 real unpacked MV3 runtime checks pass. No employer forms submitted.
- Lint and isolated production build pass. Independent review findings above were addressed with regressions.

These checks prove the listed fixtures and API boundaries, not universal compatibility with every LinkedIn layout or a real employer's acceptance. City/region markup was not supplied; the example reliably captures Remote rather than inferring geography. More adapters, Workday, AI assessments and human outcome measurements remain future work.
