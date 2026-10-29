# A4 — Frozen submission packages

Execute inline on main after A3 and the review reliability fixes. Scope: RB-02; no AI or employer submission automation.

## Contract and storage

- Preserve exact PDF bytes from app downloads as private immutable artifacts, with SHA-256, creation time, title and the rendered content snapshot. Recording a later submission selects that actual export rather than recompiling it.
- Allow an uploaded PDF reported by the user, an unverified selected working version, or an explicit no-file record. Export provenance proves which bytes the app exported, not what the employer received. Display this distinction.
- Freeze the application's description/identity and selected document/known answers at recording time. Corrections append a new package linked to the earlier one. Later document edits/deletion and application deletion cannot change the frozen package.
- Use owned Postgres artifact rows with bounded private `bytea` (3MiB/file), not public URLs. This keeps upload/package metadata atomic, avoids object-storage orphan races, and makes profile/account cascade cleanup include bytes. List reads explicitly exclude binary data. The personal-workflow tradeoff is database space; a later storage adapter can move unchanged hash-addressed bytes without changing provenance.
- Service-only artifact/package write RPCs enforce the authenticated account passed by trusted server code and independently validate source ownership. User sessions can read only their records under RLS. No direct update/delete grant for frozen records; account lifecycle uses the owning profile cascade.
- Package capture has an account-bound event UUID and request fingerprint. Retries return the original result; changed intent with the same event rejects. Missing migration blocks new capture with an explicit retry path.

## Tasks

- [x] Migration015: private export/upload artifacts and append-only packages, ownership checks, idempotency, source deletion independence, RLS/grants and bounded data. Disposable SQL assertions.
- [x] Shared server artifact/package services: actual-byte validation/hash, owned list/detail/download, safe missing-migration/error mapping. Tests for PDF bounds, bytes/hash preservation, foreign sources and replay behavior.
- [x] PDF download captures the exact returned bytes before responding. Preserve metadata headers and existing LaTeX fallback; do not archive a different recompiled file as the original.
- [x] Application detail package capture/review UI: explicit source selection, recorded date, optional correction note, uploaded file and honest source labels. Separate frozen versions from editable linked documents.
- [x] Read-only package/archive page with frozen JD and original file download, including packages whose application was deleted. Link from Documents. Freeze known answers where available; A5 will supply the manual library.
- [x] Synthetic exported-byte equality, edit/delete-after-capture, upload/retry/ownership/concurrency, desktop/mobile and actual-file checks. Full tests/lint/isolated build; fresh independent review/material fixes; migration applied. See [evidence](../../submission-packages-verification.md).
- [ ] Commit/push and record hosted CI/deployment in the continuation checkpoint.

Storage decision: private bounded Postgres bytes rather than object keys keep upload and package creation atomic. Enforce3MiB/file and200MiB PDF bytes/account, with an explicit capacity error. Individual frozen-record deletion is not implemented; profile/account cascade includes bytes and privacy disclosure explains operator removal. The trusted export RPC may retain an already owned render snapshot if its source disappears during compilation; any surviving foreign source is rejected. Capture from selected working content independently checks and locks the owned row.

Acceptance: the user can retrieve the exact recorded file and JD after changing or deleting the working resume. Unknown files remain visibly unknown. Recording a package never silently marks another job applied or replaces a prior package.
