# Saved jobs / A2 verification

Verified October 28, 2026. Scope: RB-07A, without a model call or fit meter.

## Behavior

Applications → Saved jobs opens a paginated searchable shortlist. Save manually or from extension 0.3.0; correct company/title/location/description and choose an owned working resume. Canonical posting identity, full description and extracted pay/workplace/employment details survive saves. Saving never creates an application, status history or submission receipt. Resume choice expresses preparation intent, not proof of the uploaded PDF; frozen submissions remain A4.

A unique exact posting within120days links to its application. Multiple candidates and contradictory stored requisition/URL evidence stay unlinked. Historical rejected/withdrawn applications can retain navigation links; the link does not imply an active application. Popup-only worker handlers return resume ID/title metadata; job-site content scripts receive no resume/CV data. Stale account actions and responses reject. Stalled resume lookup does not block submission capture.

## Checks

- 157 Node tests pass: normalization, input limits, owned resume selection, metadata-only reads, migration safety, stale-account/content-script boundaries and stalled metadata regression.
- `scripts/qa-opportunities-sql.mjs`: 22 disposable PostgreSQL/PGlite assertions across real migrations001–013. RLS/grants, equivalent posting dedup, different requisitions, no application on save, exact/ambiguous/conflicting links, deleted resume behavior.
- Live Supabase QA run `789a58f6`: five simultaneous HTTP saves returned one opportunity; applied count unchanged; another account could not read/spoof owner; resume choice restored; confirmed extension submission linked the saved job. Temporary QA extension token revoked afterward.
- Playwright localhost:3000: fictional-account save, actual resume selection, refresh, search, edit, desktop1440px/mobile390px, zero page errors. Missing-migration notice checked before installation. Explicit field labels corrected during verification.
- Popup UI with fictional Chrome API boundary: detail correction, resume choice, saved/unsaved feedback, failed-save preservation/retry; zero page errors. Worker and real HTTP boundaries checked separately. No employer application submitted.
- Lint clean; isolated production build succeeds without overwriting running `.next`.
- Local screenshots: `/tmp/resume-butler-saved-{desktop,mobile,popup,pending}.png`.

## Review and rollout

Fresh independent review found two Important issues: conflicting stored identity versus manually edited link, and resume lookup blocking the existing submission handler. Both reproduced RED→GREEN with real SQL/VM fixtures; full suite green afterward.

Migration013 applied to project `tlmabncoijnuxymxohgu`. SQL editor text matched local file (6,786 characters; checksum2572355650) before execution, then reported Success. Applied migrations were not edited. Reload unpacked extension0.3.0. Local verification, push and hosted deployment are distinct states.

## Limits

- Deleting one of several identical applications leaves its saved job unlinked until re-save recalculates. Conservative unlinked state cannot select the wrong application.
- No offline saved-job queue: failed edits remain only while popup stays open. Confirmed submissions retain their durable queue.
- Reusing the same posting in a later hiring cycle needs an explicit cycle choice; saving alone never creates a submission.
- Custom sections, frozen files, autofill, complete export and remaining practical milestones are unfinished.
