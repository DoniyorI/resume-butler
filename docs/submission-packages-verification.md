# Frozen submission versions — A4 / RB-02

Verified October 29, 2026. This is a manual recording workflow, not evidence that an employer received a particular file.

## Shipped behavior

- A successful PDF download archives the **same returned bytes**, hash, source content and title. Automatic PDF page-fit checks use their separate endpoint and do not create artifacts. LaTeX downloads/fallbacks do not claim a PDF artifact.
- Application details offer four explicit choices: an app-exported PDF, a user-supplied PDF, a current working-content snapshot without a verified file, or no file. Date, saved job description/identity, known answers and notes are frozen. No PDF is preselected.
- Corrections append a new record pointing to the original. Recording never changes application status or creates another application.
- `/submissions` and its detail pages retrieve preserved PDFs and JSON records after working-resume or application deletion. Documents links to the archive. PDF retrieval verifies stored length and SHA-256 before returning an attachment.
- Service-only writes derive the account from server authentication. SQL checks surviving source ownership; selected snapshots lock the source while copying. An export source can disappear during compilation because the trusted renderer already loaded it with an ownership filter. Ordinary users have own-row reads, with no direct artifact/record mutation grant.
- Per-account locks serialize archive writes. An event UUID and intent fingerprint make retries return the original record, including after source deletion. Changed intent with the same UUID returns409. Uploaded bytes and the record commit atomically.

## Evidence

- Full Node suite: **179 passing tests**, including byte/hash/bounds checks, streamed upload size enforcement, explicit source selection, intent fingerprints, archive failures and exact returned-byte download integration.
- `scripts/qa-submission-packages-sql.mjs`: **29 assertions** against actual migrations001–015 in disposable PGlite. Covers frozen facts, deleted sources/application, replay, changed intent, corrections, legacy SQL-NULL content, own/foreign reads, denied direct mutation and spoofed export calls, quota boundary, upload rollback with no orphan file, and account-cascade cleanup.
- Clean lint and isolated production build with placeholder Supabase configuration; no production secrets needed for the build. Fresh independent review found no actionable issues. A later browser check caught nested page landmarks; both new page wrappers were corrected and the full workflow rerun.
- Live synthetic run `e21374a5`: exact compiled/downloaded/stored/retrieved PDF equality; original JD and file survive a source edit and both source deletions; five concurrent retries after deletion return the original record; five concurrent uploads create one record/file; changed intent409; another signed-in account gets404 for both downloads; cross-origin capture403; desktop/mobile flows, JSON download and zero page errors. Preserved record `f691dec4-deac-491d-ad9a-a43e585e6fec`, artifact `6d066711-fb91-4a3d-acf5-d720b512994d` belong only to the fictional QA account.
- Migration015 applied to project `tlmabncoijnuxymxohgu`. SQL editor contents matched the local file: **11,514 characters, polynomial31 checksum3789110817**. The editor reported **Success. No rows returned**. Never edit this applied migration.
- Local visual evidence: `/tmp/resume-butler-a4-{desktop,mobile,mobile-form,archive}.png`; actual preserved file `/tmp/resume-butler-a4-preserved.pdf`. No actual employer application or private inbox was used.

## Limits and decisions

- Private Postgres `bytea` keeps file bytes and capture metadata atomic and avoids object-store orphan races. Files are limited to3MiB; PDF bytes total200MiB per account. A capacity error preserves existing records and requests operator intervention. This personal-workflow choice consumes database capacity; move unchanged hash-addressed bytes behind a storage adapter if usage grows.
- List queries omit binary data. Capture bodies are streamed with a4MiB bound before multipart parsing, file signatures/tails and size are checked, and SQL independently verifies hashes. This is not a malware scan or complete PDF structural validation.
- Frozen records and exports have no individual deletion control yet. Removing a working resume/application retains them; profile/account removal cascades their metadata and bytes. Privacy disclosure explains this and the operator-removal path. No automatic expiration or silent pruning is performed.
- Source selectors expose the latest100 exports/resumes; older PDFs can be uploaded explicitly. Archive records have50-row pagination. The capture attempt UUID survives retries while the form stays open; it is not an offline queue across page/browser closure.
- Manually entered answers are preserved now. A5 supplies the approved answer library; A6 supplies reviewed autofill. Existing CSV export remains a loaded-row export, not a complete account backup (A10).
- Local verification, applied migration, pushed commit, hosted CI and hosted deployment are separate states. Commit/deployment identifiers are recorded in the continuation checkpoint once available.
