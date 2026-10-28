# RB-01 Application Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep distinct openings separate and make retries and ambiguous email approvals safe across app and extension.

**Architecture:** Normalize supported posting identities in a pure shared contract, use conservative match decisions, and perform application/receipt writes atomically in Postgres. Reuse existing application rows and status history; preserve the extension API response while adding owned unresolved-match resolution.

**Tech Stack:** JavaScript, current Next.js App Router, Zod, Supabase/Postgres RPC/RLS, Manifest V3, Node 24 `node:test`, Playwright and dedicated fictional QA accounts.

**Spec:** [RB-01 design](../specs/2026-10-28-application-identity-design.md). Status: implemented and verified October 28, 2026; see [execution evidence and limits](../../application-identity-verification.md). The detailed checklists below retain the original planned verification scope; the evidence report describes exactly what ran. Part of [the program plan](2026-10-28-job-search-improvements.md).

## Global Constraints

- Preserve existing 120-day cycle and terminal-state protections for choosing a target for a **new event**.
- A replay of an already recorded event returns its prior result even if the row is now closed/older. Replays cannot revive deleted rows.
- Unique `(user_id, source, event_id)` for ingestion receipts; no cross-account identity comparisons or queue replay.
- IDs/namespaces are bounded text (200 characters each), platform is at most 40, URL is at most 2,000.
- Reserve migration `012_application_identity.sql` only if 012 is still the next number at implementation. Never edit applied 011.
- Before migration installation, identity-sensitive writes return a retryable setup error; queued events stay queued. Reading the application list remains available.
- No actual employer submissions, recruiter messages, real inbox use, or unrelated user data in tests.
- Preserve unrelated dirty work. Commits, live SQL application and deployment are separate integration steps; do not automatically perform them from this planning document.
- Frozen submission files are RB-02. Gmail OAuth, thread/requisition extraction and broad autofill are later milestones.

## Review Focus

1. Supported URLs with embedded identity parameters and different board namespaces: Task 1 pins exact equivalence/conflict cases.
2. Identical role names on multiple rows and concurrent candidate changes: Tasks 2 and 3 require unresolved rather than newest-first selection.
3. Retry after status change, Undo/deletion or a changed payload: Task 3 verifies receipt semantics against real Postgres.
4. Legacy extension queues, account switches and concurrent worker events: Task 4 verifies account binding and serialized local persistence.
5. Missing migration, revoked token and stale resolution UI: Tasks 3–5 preserve pending/queued work and enforce fresh ownership/state checks.

## File structure and interfaces

New code paths are proposals; verify they are unused before creation.

| File | Responsibility |
| --- | --- |
| `src/lib/postingIdentity.js` | Pure, bounded supported-URL identity/canonicalization; no network/auth/DB |
| `src/server/applications/matching.js` | Pure fresh-submission candidate decision using existing cycle helpers |
| `src/server/email/matching.js` | Email candidate decision + compatibility wrapper; retains status/cycle helpers |
| `src/server/extension/applications.js` | Input validation, normalized payload, service-only RPC adapter, existing undo contract |
| `supabase/migrations/012_application_identity.sql` | Additive fields, receipt ledger, atomic record/approval/resolution behavior |
| `extension/ingestionQueue.js` | Proposed worker-loaded queue/event helper; preserves UUID/account/date/payload and serializes storage changes |
| `src/features/suggestions/*` | Owned unresolved-match data, action and minimal target picker |
| `src/features/applications/ingestionReview.js`, `ExtensionMatchReview.jsx` | Server-mediated extension-event review and applications-page recovery, keyed by event UUID |
| `tests/posting-identity.test.mjs`, `tests/application-matching.test.mjs` | Normalization and candidate regressions |
| `tests/extension-applications.test.mjs`, `tests/extension-ingestion.test.mjs` | Real server/worker code with external boundaries mocked |
| `scripts/qa-application-identity.mjs` | Explicit synthetic-account real DB/concurrency/permission QA |

`PostingIdentity = { platform: string|null, namespace: string|null, postingId: string|null, urlKey: string }`.

`MatchDecision = { kind: 'matched', applicationId: string, reason: string } | { kind: 'new', reason: string } | { kind: 'ambiguous', candidateIds: string[], reason: string }`.

`QueuedSubmission = { version: 1, eventId: UUID, userId: UUID, job: object, appliedDate: YYYY-MM-DD }`. Hash the normalized semantic payload excluding the transport UUID; retries must not mutate that payload.

Keep existing extension successful HTTP body `{ application, created }` and 201/200 meanings. Return safe 409 for ambiguity, event mismatch or deleted replay target, 401 for invalid connection and retryable 503 for required schema absence. Ambiguity is returned as `{error,code:'needs_matching',eventId}` only after the unresolved receipt commits. Other error codes distinguish event mismatch/deleted target without exposing other users' information.

## Task 1: Pure posting identity and candidate contract

**Files:** Create `src/lib/postingIdentity.js`, `src/server/applications/matching.js`, `tests/posting-identity.test.mjs`, `tests/application-matching.test.mjs`.

**Interfaces:** Produce `normalizePostingIdentity({url, platform?, postingId?}): PostingIdentity` and `matchSubmittedOpening(applications, {identity, company, role, now}): MatchDecision`. Consume existing `normalizeCompany`, `normalizeRole` and `isSameCycle` from email matching; do not redefine the 120-day rule.

- [ ] Write failing tests with fixed `now`: LinkedIn `/jobs/view/123` equals search `currentJobId=123`; Greenhouse token/board identity survives normalization; same numeric ID on different boards differs; Lever/Ashby apply suffixes normalize; tracker parameters do not split a known posting; unknown identity-bearing query parameters are retained; unsafe/malformed URLs and metadata disagreement fail safely.
- [ ] Add candidate tests: distinct strong IDs/URLs with equal company/title produce `new`; one equivalent current posting produces `matched`; conflicting ID and URL evidence never merges; multiple plausible legacy rows produce `ambiguous`; a closed/old row starts a new event/cycle; unrelated company names remain distinct.
- [ ] Run `node --import ./tests/register.mjs --experimental-test-module-mocks --test tests/posting-identity.test.mjs tests/application-matching.test.mjs` under Node 24; confirm the new assertions fail before implementation.
- [ ] Implement the two interfaces with explicit supported-host parsing and no redirect/network requests. Do not canonicalize every query string globally.
- [ ] Run the focused tests; expect all pass. Review the helper diff and confirm existing matching tests still pass. Record the task evidence before proceeding.

## Task 2: Conservative email decisions, including pending suggestions

**Files:** Modify `src/server/email/matching.js`, `src/server/email/sync.js`, `src/features/suggestions/actions.js`; extend `tests/email-matching.test.mjs`, `tests/email-sync.test.mjs`, `tests/suggestion-approval.test.mjs`.

**Interfaces:** Add `decideEmailApplication(applications, {company, role, category, emailDate, now}): MatchDecision`; preserve `findTargetApplication(applications, event)` returning the row only when matched. Export `decideEmailApplication` for `sync.js`; use `kind: 'ambiguous'` plus owned candidates internally rather than overloading null as “certainly new.”

- [ ] Write failing cases for two exact-title rows, partial matches spanning two same-title rows, role-less ambiguity, historical email/newer application, and ambiguous pending suggestions. Assert no status writes or name-only pending merge occurs.
- [ ] Add a fallback approval regression proving two eligible same-title rows cannot silently choose one before the new RPC is installed; require a setup/review error instead of unsafe fallback.
- [ ] Run the three named test files with the same Node 24 loader; verify these counterexamples fail.
- [ ] Implement explicit matched/new/ambiguous decisions without changing exact-company, category, event-time or status progression protections. Retain compatibility for readers/callers while keeping ambiguous information through suggestion planning.
- [ ] Define the transitional behavior before new suggestion fields exist: leave ambiguous mail retryable and surface deferred work rather than marking it successfully processed or inserting a misleading ordinary new suggestion. Task 3 activates persistence for unresolved review.
- [ ] Run focused and existing email tests; expect no arbitrary match and no loss of retryability. Record decisions and compatibility behavior.

## Task 3: Additive schema and atomic ingestion/approval

**Files:** Create the next numbered `application_identity` migration (expected 012), `tests/extension-applications.test.mjs`, `scripts/qa-application-identity.mjs`; modify `src/server/extension/applications.js`, extension record route, suggestion actions and data reads, and email suggestion persistence.

**Interfaces:** Produce service-only `record_extension_application(p_user_id uuid, p_event_id uuid, p_payload jsonb)` returning either `{application,created}` or committed `{status:'needs_matching',eventId}`. Add authenticated `list_unresolved_extension_events()` and `resolve_extension_application_event(p_event_id uuid,p_target_application_id uuid,p_create_new boolean)` constrained by `auth.uid()`. Preserve `approve_application_suggestion(uuid,text,text,text)` while rejecting ambiguous name-only dedupe. Add `resolve_application_suggestion(p_suggestion_id uuid,p_target_application_id uuid,p_create_new boolean,p_company text,p_role text,p_status text)` for authenticated owned explicit resolution; exactly one of target or create-new must be chosen. Internal SQL normalization must match Task 1 fixtures.

- [ ] Add server tests for input bounds, canonicalized payload, old payload compatibility, RPC errors, UUID validation, duplicate UUID with differing payload, missing schema 503 and no unsafe write fallback. Mock RPC/network boundaries, not the decision logic.
- [ ] Prepare SQL QA scenarios against only two dedicated synthetic account IDs: simultaneous same event, distinct postings with equal names, replay after status change, replay after deletion, new reapplication event, ambiguous email approval, and extension-versus-email approval under the shared per-user lock. Verify permission denial for anon/authenticated direct ledger access and record RPC; verify authenticated resolution cannot target another account.
- [ ] Run server tests to establish red evidence. Do not claim the in-memory test double validates SQL locks or RLS.
- [ ] Implement nullable identity fields/indexes, RLS-protected minimal receipt ledger and tombstones, shared transaction lock, atomic missing-only record/enrichment, and current status/ownership validation. Validate payload field lengths/known values in SQL as well as Zod.
- [ ] Add committed unresolved receipts retaining bounded input only until resolved; do not raise an exception that rolls back the receipt. Test refresh/replay, owned listing, target selection/create-new, concurrent resolution and replay after resolution. Completion updates the original event result and erases temporary payload; conflicting known identities remain protected.
- [ ] Update approval by a new migration, preserving terminal/hiring-cycle safeguards, idempotent already-approved handling and rejecting multiple eligible candidates. Explicit resolution must re-read pending state and target ownership inside its transaction and retain a bounded resolution reason/audit record.
- [ ] Update `recordApplication()` to call the RPC and preserve current route success shape. Record calls without an event UUID receive a server UUID and use conservative matching; document their weaker replay contract.
- [ ] Persist ambiguous suggestion metadata only when the new schema is available; on absent schema, fail/retry as specified. Load all required candidates with pagination or bounded targeted queries; do not silently rely on Supabase's default 1,000-row cap.
- [ ] Test migration in an authorized disposable/local database when available. Apply live only through the existing explicitly reviewed migration workflow. Run the prepared real SQL QA and record actual results, schema level and cleanup scope; otherwise mark live verification outstanding.
- [ ] Run full regression suite under Node 24; expect all tests pass and no unscoped service writes. Review SQL privileges, lock order, ledger retention/account deletion, tombstones and old clients before connecting the worker.

## Task 4: Stable extension events and account-scoped queue

**Files:** Modify `src/app/api/extension/me/route.js`, `extension/background.js`, `extension/content/job-reader.js`, `extension/popup/popup.js`, `extension/popup/popup.html`, `extension/README.md`, `extension/manifest.json`; create worker-loaded `extension/ingestionQueue.js` and `tests/extension-ingestion.test.mjs`.

**Interfaces:** `/api/extension/me` adds `userId` without removing name/email. `toPayload` adds event UUID and posting identity. Queue helper exposes `prepareSubmission({userId,job,eventId?}): QueuedSubmission`, `enqueueSubmission(entry): Promise<void>`, and `takeAccountQueue(userId): Promise<QueuedSubmission[]>`; use a serialized storage mutation path, preserving pending entries until acknowledged rather than clearing the entire queue before transport.

- [ ] Write worker tests using fake Chrome/storage/fetch boundaries: first failure then retry sends the same UUID/date/payload; duplicate confirmation notifications reuse the pending event; distinct actual events differ; worker restart preserves work; concurrent enqueues lose nothing; A's queue never sends under B; unscoped legacy entries pause for confirmation; revoked token retains clearly account-bound pending work.
- [ ] Run `tests/extension-ingestion.test.mjs`; confirm red evidence before implementation.
- [ ] Implement one-time event preparation, immutable payload retry, account binding and serialized queue changes. Send existing `jobId` and site information rather than dropping them. Validate server URL-derived identity; don't trust arbitrary page-supplied IDs.
- [ ] Handle 503 with retry; retain account-bound `needs_matching` entries with a review/open-app action and no repeated toast. Bounded retry uses the same event UUID to discover completion after app resolution. Handle event mismatch/deleted-replay conflicts without infinite retry or recreation. Preserve current successful detection and undo behavior.
- [ ] Add a clear legacy-queue resolution path and connected account display. Update supported-site copy to include LinkedIn and increment the extension version only with the actual shipped code change.
- [ ] Run worker/server tests and synthetic extension fixture flows for offline/restart/account-switch. No real employer forms are submitted. Verify new and legacy payloads against the server.

## Task 5: Minimal unresolved-match recovery and end-to-end verification

**Files:** Modify `src/features/suggestions/data.js`, `actions.js`, `SuggestionsReview.jsx`, `src/app/(app)/applications/page.jsx`; create `src/features/suggestions/MatchTargetPicker.jsx`, `src/features/applications/ingestionReview.js`, `src/features/applications/ExtensionMatchReview.jsx` and focused action tests; extend `scripts/qa-application-identity.mjs` with browser fixture verification. Update `docs/ARCHITECTURE.md`, `docs/email-sync-reliability.md`, `docs/chrome-extension-plan.md` and `ROADMAP.md` when behavior is actually verified.

**Interfaces:** Add `resolveSuggestion(id, {applicationId: UUID|null, createNew: boolean, company, role, status})` as a validated Server Action using the Task 3 RPC. In `ingestionReview.js`, export server-only `getUnresolvedExtensionEvents()` and Server Action `resolveExtensionEvent(eventId,{applicationId:UUID|null,createNew:boolean})` using the corresponding Task 3 RPCs (split actions into a separate `"use server"` file if required by Next export rules). Query candidate metadata server-side by owned candidate IDs; never accept a client-supplied user ID. Return the existing action envelope `{ok,data|error}`. Source-specific review actions must not interchange event UUIDs and email suggestion IDs.

- [ ] Write failing action tests: wrong-owner target, forged candidate, deleted target, handled suggestion, status advanced since scan, explicit create-new, selected existing target and duplicate concurrent resolve. A stale decision must leave the suggestion pending or clearly already handled, never partially committed.
- [ ] Run the action tests, confirm failures, then implement the owned transactional action and minimal picker. Show company/role, date, posting/requisition distinction and “Needs matching”; do not silently preselect a same-title candidate.
- [ ] Browser-test two fictional identical-title openings: an ambiguous email requires a choice; selecting one changes only that row. Refresh shows the same result. Explicit separate creation works; source email context remains visible. Keyboard/focus and error recovery work without routine-save toast spam.
- [ ] Browser/worker-test an ambiguous extension submission through its separate applications-page review section: refresh retains it, choosing a valid target or confirming new completes the same event, queued retry returns that result and removes only the acknowledged queue entry. Test wrong-account event IDs and stale/concurrent resolution.
- [ ] Verify all milestone acceptance cases against real SQL where authorized, including missing-schema recovery, account switching, simultaneous approval/ingest and delete/replay. Record remaining gaps precisely instead of marking all done from unit tests.
- [ ] Run Node 24 full tests, current lint command and `git diff --check`; create an isolated production build away from running `.next` output. Browser-check existing application tracking and editor saves for regressions.
- [ ] Obtain fresh review required by the active workflow, address material issues, then record task/milestone evidence and local/migrated/deployed state. Follow the revised personal-use sequence: A2/RB-07A extension capture/save-for-later is next; RB-02 submission packages are A4. Do not expand into frozen PDFs in this change.

## Self-review coverage

Identity equivalence/conflict and cycle rules map to Task 1; email ambiguity and pending merge behavior to Task 2; atomicity/RLS/receipt replay and missing migrations to Task 3; account ownership/retry/legacy client behavior to Task 4; user recovery/staleness and full verification to Task 5. The same `MatchDecision` names are used across tasks. Exact PDF artifacts and thread-based email matching remain explicitly assigned to later milestones.

A fresh builder check identified the need for a persisted extension-specific unresolved event and completion path. Tasks 3–5 now implement committed review receipts, source-specific authenticated resolution, temporary-input cleanup and replay of the resolved original UUID. Final review found seven material edge cases; each was corrected with regression evidence recorded in the verification report.
