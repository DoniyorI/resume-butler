# Email Sync Reliability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. The user explicitly requested a plan and execution in this chat.

**Goal:** Make application matching and email ingestion conservative, retryable and testable, then validate them with synthetic accounts and browser interactions.

**Architecture:** Keep AI extraction separate from deterministic matching and approval. Exercise the existing services with controlled external dependencies; use real Supabase rows belonging only to dedicated QA accounts for integration tests. Add database transactions and leases where application code alone cannot guarantee atomicity across server instances.

**Tech stack:** Existing Next.js/JavaScript/Supabase app; Node 24's test runner and module hooks; current OpenAI APIs; browser QA.

**Spec:** The user's request in this chat: explain matching and models, investigate reliability, create synthetic test accounts/data, simulate email sync, create a plan and execute it.

## Global constraints

- Preserve existing uncommitted documentation and Inbox changes. Follow the repository's direct-main workflow; keep this work uncommitted for review.
- Never read, alter, scan or classify real users' mail or application rows for testing. Scope every integration query to recorded QA user IDs.
- Use synthetic email fixtures; never send email to real recipients. Create confirmed QA accounts through the configured Supabase admin API when available.
- Keep applications behind explicit suggestion approval. AI confidence does not authorize a mutation.
- Add numbered migrations; never change applied migrations. Prepare SQL before requesting database-editor access. Preserve compatibility before new migrations are applied and document any reduced guarantees.
- Keep model changes opt-in until a bounded synthetic evaluation demonstrates compatibility and usefulness. Never log credentials or full provider error bodies.
- Run builds from a separate snapshot, not over output used by a running preview.

## Review focus

1. Different or ambiguous roles at one company must not silently update the wrong application.
2. Reapplications must survive scan and approval without merging into closed or old cycles.
3. Failed classification/persistence must remain retryable; repeated or overlapping scans must avoid duplicate effects.
4. Stale approval must not undo a newer user decision; concurrent approval needs a database transaction.
5. Time limits, partial AI errors, malformed output and tenant boundaries must remain visible and safe.

## Task 1: Reproducible baseline and synthetic fixtures

**Files:** Create `tests/register.mjs`, `tests/email-matching.test.mjs`, `tests/helpers/*`, synthetic fixtures, and `npm test`.

**Interfaces:** Real matching, classification, sync and approval services; module mocks only at slow/external boundaries.

- [x] Reproduce wrong-role fallback, ambiguous partial roles, missing-role confirmation/new-cycle cases, stale approval and failed-write retries with failing assertions.
- [x] Add passing characterization cases for normalization, exact roles, status progression, independent tenants and repeat scans.
- [x] Run with Node 24; record the baseline failures in the execution ledger.

## Task 2: Matching, ingestion and auto-sync fixes

**Files:** `src/server/email/matching.js`, `sync.js`, `autoSync.js`, `imapClient.js`, and focused tests.

**Interfaces:** Preserve `syncEmailsForUser(supabase, userId, options)` and `runAutoSync(admin)`; matching accepts email time when available.

- [x] Make explicit mismatched roles and ambiguous matches conservative. Apply the same-cycle rule to every confirmation fallback and approval of new suggestions.
- [x] Keep failed writes retryable, handle repeat-message conflicts idempotently, and surface persistence errors.
- [x] Bound classification and IMAP work to the route budget; report deferred work and partial errors. Preserve the successful scan watermark after a failed run.
- [x] Run real-service regression tests, including multi-email and repeated scans, until green.

## Task 3: Cross-instance integrity and approval

**Files:** New numbered Supabase migration, `src/server/email/*`, suggestion approval service/actions and tests.

**Interfaces:** User-scoped expiring scan lease; authenticated transactional suggestion approval; a documented compatibility path while the migration is unapplied.

- [x] Write concurrency/tenant-isolation expectations and unit tests; prepare a real SQL RPC verifier. PostgreSQL execution remains pending migration access.
- [x] Add an expiring database lease for overlapping manual/cron scans and an atomic approval RPC protecting current status and hiring cycles.
- [x] Retain safe compatibility behavior for the existing schema and record its limitations.
- [x] Apply reviewed additive migration 011 and run real RPC checks against QA rows only. After the user signed in, schema metadata confirmed missing 009–011; each was applied in order in its own transaction and verified.

## Task 4: AI model configuration and evaluation

**Files:** `src/server/openai.js`, classification validation, task call sites as needed, AI tests/evaluation script and documentation.

**Interfaces:** Keep `chatJSON`'s object return; add task-specific opt-in model selection and schema/timeout controls.

- [x] Verify current OpenAI documentation and accessible model IDs. Test provider errors, incomplete output, invalid classifications and modern-model request compatibility.
- [x] Add strict classification validation and task-scoped overrides without silently changing all production AI behavior.
- [x] Compare the current model and a current inexpensive candidate on the same synthetic corpus; report accuracy, latency and token usage with sample-size limits.

## Task 5: Real QA accounts, browser proof and final checks

**Files:** Reusable synthetic integration harness and an evidence/report document; temporary credentials and screenshots outside Git.

**Interfaces:** Existing UI and actual application services; fake transport returns synthetic email, while database and approved model calls are real.

- [x] Provision isolated QA accounts and applications. Verify that a second account cannot see or change their data.
- [x] Run confirmation, interview, rejection, reapplication, wrong-role, duplicate and partial-failure scenarios; assert both suggestions and saved applications.
- [x] Use the browser to sign in, review suggestions, approve one new application and one existing update, and verify the tracker/timeline. Keep live cron restricted to QA fixtures.
- [x] Run the complete test suite, lint and an isolated production build. Obtain one fresh code review, fix material findings with regression tests, and update the architecture/operating notes.
- [x] Report exactly what was simulated, what used real services, what remains blocked, and how to rerun the checks.

## Execution ledger

- Investigation: configured model is `gpt-4o-mini`; configured Supabase admin access is valid. No existing-user rows were read. Migration 010 job-detail columns are not applied to the connected database.
- Investigation: OpenAI access includes `gpt-4o-mini`, `gpt-6-luna`, and `gpt-6.1-sol`.
- Ruling: Implement and test in the current checkout to preserve the user's in-progress Inbox UI and follow repository workflow. No pushes or unrelated upgrade changes are part of this task.
- Ruling: Evaluate newer models with synthetic data before recommending a default change. No production model configuration will be silently changed.

- Matching baseline: 5 concrete failures reproduced, then 12/12 matching tests passed after conservative role and email-date fixes.
- Ingestion/auto-sync baseline: failed-write retries, legacy error rows, historical email targeting, partial-scan success reporting and successful-watermark advancement reproduced and fixed.
- Approval baseline: 4 failures reproduced (closed/old cycles, stale status overwrite, deleted-target recreation); fixed with same-cycle matching and conditional status writes. Full suite currently 28 tests.
- QA provisioned: run `0bd32703df`, two accounts under `example.test`, four primary-account applications plus a second-tenant fixture. Credentials are in a private temporary session file, never Git. The synthetic email connection has auto_sync=false.
- Matching, sync, approval, model-boundary, IMAP and lease tests: 60 passing under Node 24. Focused regressions were observed failing before fixes; existing behavior characterization remains green.
- Real Supabase + OpenAI replay (only IMAP faked): ten emails, seven suggestions; exact updates, independent roles, new hiring cycles, merged offer and injection fixture matched expectations. Repeat scan had zero candidates; applications remained unchanged until approval. Second-account RLS reads/writes were denied as expected.
- Playwright: real login and Add/Update controls approved the backend interview and Northstar reapplication. Five saved applications include both old rejected and new Applied Northstar cycles; backend history contains Applied and Interviewed. Invalid Badge-in-paragraph markup was exposed by browser hydration errors and fixed; final run has zero page errors.
- QA-only auto-sync orchestration: injected model outage preserved success watermark and counted failure; real model retry recovered and cleared the error. Live scheduler was never invoked; connection stays auto_sync=false.
- Model evaluation: gpt-4o-mini and gpt-6-luna each scored 10/10 synthetic cases (nine real calls each). Estimated cost $0.000902 vs $0.000676; defaults unchanged. Larger email and writing/import evaluations remain recommended.
- Fresh independent review found approval/scan race, resolved-suggestion duplicate-key retry loop, silent transport truncation and missing persistence deadline checks. All four were reproduced/fixed with regression coverage. SQL source review found no concrete tenant/syntax defect, but execution remains pending.
- Migration 011 prepared, not applied. An authenticated QA verifier for leases and concurrent approval is ready. No database SQL access is available; migration 010 is also missing on the configured project.
- ESLint clean; isolated production build passed. Build output used by running previews was preserved. Report: docs/email-sync-reliability.md.
- Database rollout completed after user sign-in: schema metadata confirmed 009–011 missing; all three migrations applied in order through SQL Editor, each in a transaction with success verified. Metadata now confirms all relevant objects present.
- Real PostgreSQL RPC verification passed: lease contention, matching-token release, cross-tenant denial, simultaneous idempotent approval, retained old hiring cycle, stale rejection rollback. Anonymous RPC/direct-table and service-only auth-limit access denials were checked. QA-only changes; no real-user application rows read or mutated for tests.
- Post-migration Playwright approval of the Orbit offer passed through the real transactional RPC; seven QA applications include both Atlas and Northstar hiring cycles. Browser has zero page errors. Source changes remain uncommitted/undeployed.
- User-requested model switch: source fallback and local OPENAI_MODEL changed to gpt-6-luna globally. Task overrides still take precedence. New default-routing regression reproduced red, then full suite passed 61 tests. Small synthetic real API checks exercised all four AI task routes. Hosted environment and deployment remain unchanged.
