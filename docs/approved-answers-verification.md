# Approved answer library — A5 / RB-09A

Verified October 29, 2026. Manual user-authored content only; no AI drafting or employer form submission.

## Behavior

`/answers`, linked from Documents and submission capture, supports drafts, explicit approval, labels/categories/tags, optional user-provided references, search by label and pagination. Saving edits as a draft removes approval. Archive/restore is reversible and restoration requires fresh approval. Copy rechecks the current owned approved revision; clipboard denial offers a manual-copy dialog. Revision conflicts retain local input, with JSON recovery, explicit reload/discard and save-as-new controls. Row actions wait for refreshed revisions after saves.

SQL stores current entries plus immutable revision/command receipts. Account-scoped event fingerprints make retries idempotent; expected revisions prevent overwrite. Deleting an entry removes its history but retains a small deletion-ID tombstone so a delayed create retry cannot resurrect the content. Account removal cascades these IDs too. Existing frozen submission copies stay intact, as disclosed in the UI and privacy page.

Submission capture receives only explicit library IDs/revisions. SQL checks ownership, approval and revision under a shared lock, then copies actual question/text/reference into the record. After409 the form refreshes choices while retaining its attached file and notes; a new revision is unchecked and requires deliberate reselection. Empty selections preserve A4 request fingerprints, including replay after application deletion.

The library export uses one SQL snapshot for current entries and complete history, returning scalar JSON rather than a row-limited table result. HTTP output is streamed in Unicode-safe chunks. The snapshot is still assembled in database/app memory; this is not the full-account export planned in A10. Streaming follows [Vercel’s response-size guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).

## Evidence

- **188 Node tests pass**, including explicit approval, source URL validation, fresh owned copy checks, stale/draft/archived rejection, A4 fingerprint compatibility, Unicode export boundaries, malformed export rejection and auth-provider availability handling.
- **34 disposable SQL assertions** in `scripts/qa-approved-answers-sql.mjs`, across actual migrations001–017: CAS, receipts/replay, ownership, approval invalidation, source binding, archive/restore, deletion/no revival, independent submitted copies and export/history. Existing submission SQL suite:29 assertions passing.
- Synthetic browser run `b91888d4`: draft/approve/copy, clipboard fallback, foreign read/write denial, two-tab revision conflict and focused local JSON recovery, explicit reload, archive/restore-as-draft, six-version export, deletion without revival, frozen answers surviving library deletion, live A4 replay compatibility, desktop/mobile and zero page errors. Frozen record `75572605-28a5-4467-98da-9767b93fdcbf`; retained mobile fixture `7ff1a5a6-a79c-4955-8c1f-4652deb7e9db`. All belong to fictional QA accounts.
- Focused stale-selection run `9c6ade8d` verified409 refresh preserves both typed notes and the actual selected PDF, presents the new revision unchecked, and succeeds only after reselection.
- Live concurrency run `ba232dfc`: five identical creates produce one revision; two different updates from the same revision produce one winner and one conflict.
- Authenticated `frontend-review` harness: **PASS — 0 errors, 0 warnings**, at1440×900 and390×844. Both return200, zero horizontal overflow, one h1 and no unnamed controls. The harness copy adds only QA storage state and the installed Chrome channel. Report `/tmp/resume-butler-a5-ui-review.json`.
- Lint and isolated production build pass with placeholder public Supabase configuration. Independent review found one P2 stale-choice refresh issue; browser RED→GREEN verified its fix.

## Live issues found and fixed

- The initial stale-choice code raised40001, which produced a real Supabase upstream timeout. This matches the [documented PostgREST retry issue](https://github.com/orgs/supabase/discussions/50151). Migration017 changes only that installed function branch to explicit `PT409`; live RPC now returns409 without the timeout. Applied016 was preserved unchanged.
- A long-running local dev process encountered a failed HTTP/2 session. Auth validation previously turned provider outages into signed-out redirects despite locally verified claims. `verifiedUser` now reports503 for transport/provider outages while definitive invalid sessions remain401. The corrected test harness reproduces baseline failure and patched success; request caching itself is not tested by that harness. Only the confirmed main dev server was restarted.
- Early browser harness failures included React import setup and checking deletion before the modal completed. Those were test issues, not claimed product fixes. Successful deletion is now awaited before database assertions.

## Rollout and limits

- Migration016 applied:16,646 characters, polynomial31 checksum1344376388, SQL editor Success.
- Migration017 applied:818 characters, checksum1779668865, SQL editor Success. Its guarded catalog replacement preserves the function’s ownership/grants. Never edit either applied migration.
- Source selectors show the latest100 approved answers; library pages show50 entries. Older/historical wording can be recovered from the export and recorded manually; copy/selection offers current approved versions.
- Revision history is exported but has no separate history-browsing UI yet. Clipboard checks were in Chromium; Safari/Firefox parity is not established. Permanent invalid-session behavior beyond the existing contract was not redesigned.
- No new AI, extension autofill or full-account backup is included. A6 and A10 remain separate milestones. Commit/push/hosted check identifiers are recorded independently in the continuation checkpoint.
