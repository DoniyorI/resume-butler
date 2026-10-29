# A5 — Approved reusable answers

Continue the approved personal-workflow program inline on main after A4. No AI drafting or employer submission automation. A6 will consume this library from the trusted extension UI.

## Contract

- A private `/answers` library stores user-authored labels, questions, answer text, optional categories/tags and a source note/reference. Start empty; provide question prompts, never invented facts, salary, authorization or demographic defaults.
- Saving a draft and explicitly approving a version are distinct actions. Editing an approved answer requires fresh approval before reuse. Archive/restore are reversible; restored answers are drafts. Users can delete their own library entry/history and export their library; frozen submission copies remain independent and this is disclosed.
- Maintain a current row and immutable owned revision snapshots. Saves use expected revisions and per-attempt event UUID/fingerprint receipts; stale writes return409, input remains available, and reload/discard is explicit. Retries return the accepted revision without overwriting later changes.
- Copy only a current, owned, approved, unarchived version. Recheck its revision on the server before copying; show an inline copied/error state and a manual selection fallback if clipboard access fails. Draft recovery is labeled separately from reuse.
- Application submission capture can explicitly select approved library answers, alongside manual answers. SQL checks ownership/approval/expected revision under a shared lock and copies the actual text into the immutable submission record. Later library edits/deletion do not change prior packages.
- Preserve A4 retry compatibility: adding an empty answer-selection field must not change the previous request fingerprint. Replay happens before library/source validation, so successful old events still replay after source deletion.
- Migration016 adds the library, revisions and safe owned save/delete/read interfaces; update capture through a new migration, never edit015. Session-derived ownership, RLS and bounded fields apply independently of the UI. No public full-answer endpoint or content-script data access.

## Tasks and verification

- [x] RED tests for draft/approval/version changes, owned copy/reuse, stale revision handling, retry receipts and A4 fingerprint compatibility.
- [x] Migrations016–017 and shared services: owned library/version storage, explicit approval/invalidation, archive/restore/delete and complete export. Disposable SQL tests cover ownership, CAS, replay, frozen binding, deletion independence and history.
- [x] Responsive library with create/edit/review, source/category labels, copy controls, archive/recovery, safe delete and export. Link from Documents and submitted-version form; preserve input on failure/conflict.
- [x] Submission metadata-only approved choices and explicit selection; SQL resolves and freezes selected text/version. No silent inclusion or re-approval.
- [x] Synthetic browser checks, real concurrency, second-account isolation, stale changes, clipboard fallback, recovery, submission freeze/removal and desktop/mobile. Full tests/lint/isolated build, independent review and material fixes. [Evidence](../../approved-answers-verification.md).
- [x] Apply016 once and follow-up017 without editing applied SQL. Record exact text/checksum and Success.
- [ ] Commit/push and record hosted CI/deployment separately. Continue A6 without waiting for another instruction.

Decisions: complete export uses a single SQL snapshot/scalar JSON to avoid row limits and inconsistent history, followed by Unicode-safe HTTP streaming. It is assembled in memory, not a full-account paged exporter. Live provider testing required PT409 rather than reserved40001 for business conflicts;017 makes only that guarded replacement. The post-save list waits for fresh revisions before enabling actions. Temporary auth outages return503; verified/invalid-session behavior remains fail-closed.

Acceptance: the owner can write, approve and quickly reuse a truthful answer, identify its version/source, and preserve the answer actually recorded with an application. A stale or unapproved version cannot be silently offered as approved reuse.
