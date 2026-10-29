# A2 — Save jobs and choose a working resume

Implements RB-07A from the approved practical program. Work directly on main as requested.

## Contract

Saved opportunities are an owned collection, separate from applications and their statistics/history. Save the canonical posting identity, full extracted description and pay/details, and an optional owned working resume. Repeated saves update one opportunity; two openings at one company remain separate. Resume choice expresses intent, never proof of an uploaded/submitted PDF. Do not expose resume contents or choices to job-site content scripts.

The popup loads resume titles through its trusted worker, lets the user correct extracted company/title/location/description, and saves explicitly. Failed saves remain editable and visibly unsaved; no false offline success. Submission ingestion retains its existing durable queue. An exact, unique current-cycle posting match links a saved opportunity to the resulting application without creating another application. Weak/ambiguous evidence remains unlinked. Account switches reject stale popup actions.

## Tasks

- [x] Add migration 013: owned opportunity store, bounded save RPC, owned resume validation, identity deduplication, safe exact application linking, RLS and restricted grants. Add disposable SQL assertions covering ownership, repeat saves, distinct requisitions, no application creation, promotion, deletion and missing resume.
- [x] Add shared server save/list/delete and extension endpoints. Fail clearly until migration is installed; page reads degrade to a setup notice. Test input bounds, normalized identity, foreign resume rejection and scoped reads.
- [x] Add Saved jobs workspace linked from Applications: search, detail correction, working resume choice, remove, and applied link. Use existing visual language, 73px header and quiet Saved/error feedback.
- [x] Add trusted popup capture and resume selector; do not forward private document data to content scripts. Test stale-account actions and worker-only access. Bump extension version and update instructions.
- [x] Run focused and full tests, lint, isolated build, disposable SQL and synthetic signed-in desktop/mobile/popup checks. Obtain one independent review, fix material findings, document migration/deployment status accurately, commit/push authorized changes.

## Decisions and ledger

- Separate collection avoids redefining Applied or changing existing statistics. Exact links are navigation, not submitted-file evidence; frozen artifact capture follows in A4.
- No offline saved-job queue in A2: preserve editable popup input on failed requests and tell the user to retry. Existing confirmed-submission queue remains unchanged.
- Existing app resumes are selected by ID/title only; Master CV is the default preparation source, not a file that can be submitted.
- Final review: two Important issues reproduced RED→GREEN: contradictory stored requisition versus edited URL now prevents linking (SQL fixture); a stalled resume lookup no longer blocks the existing submission button (VM popup fixture). Full suite 157/157; SQL 22 assertions.
- Final: minor (deferred): deleting one of multiple identical applications leaves the saved job unlinked until it is saved again. This is conservative; it cannot choose the wrong application.
- Ruling: retain links to exact historical rejected/withdrawn applications within the 120-day window — the link is navigation to an actual application, not an assertion it remains active — cost if wrong: a user may prefer to save a reapplication as a fresh opening, which will need an explicit cycle choice later.

Completion: migration013 installed; localhost desktop/mobile and popup checks pass with0pageerrors; live5-request concurrency/isolation/submission-link checks pass (run789a58f6, temporarytokenrevoked). Evidence: docs/saved-jobs-verification.md. Commit/push recorded separately.
