# Application identity — October 28, 2026

RB-01 / Phase A1 adds deterministic posting matching and recovery around the existing email classifier. No model, prompt, persona or fit score changes are included.

## Behavior

- LinkedIn, Greenhouse, Lever and Ashby identities include platform, employer namespace and posting ID. Different reliable postings remain separate even with identical company/title.
- Extension recording commits an application and receipt atomically. Repeated account/event UUIDs return the recorded result; changed payloads or deleted application replays fail safely.
- Queues capture UUID, payload and date before transport and remain scoped to account plus app origin. Account switches, reconnects, worker restarts and explicit legacy assignment are covered by queue/worker tests.
- Ambiguous extension events appear in Applications. Ambiguous emails remain suggestions. Neither picker preselects a target. The user may choose an eligible existing record or explicitly create a separate application.
- Email approval recomputes current candidates under the per-user lock. An ordinary approval that becomes ambiguous commits matching metadata and returns null, which the action treats as review-needed rather than success. Refresh displays the picker. Explicit resolution rejects candidates whose current role/date/cycle no longer qualifies.
- Missing migration 012 fails identity-sensitive writes closed with retryable setup errors; no unsafe direct-write approval fallback remains. Application reads remain available.

## Evidence

- 152 Node tests pass, including regression reproductions for employer-local ID collisions, stale legacy assignment, reconnect retry scheduling and captured-payload retries.
- All migrations 001–012 execute in disposable PostgreSQL via PGlite with 32 assertions covering replay, tombstones, ambiguity, ownership, permissions and approval-time candidate changes. This engine uses one connection; it is not the concurrency evidence.
- Migration 012 was applied through the authenticated Supabase SQL Editor to project `tlmabncoijnuxymxohgu`; the staged SQL matched the repository's 26,795-character file and the editor reported success.
- `scripts/qa-application-identity.mjs` uses only the existing fictional `@example.test` accounts. Independent live RPC requests verified duplicate ingestion, simultaneous email approval/ingestion, concurrent resolution and cross-account isolation. Playwright verified desktop/mobile matching, disabled/unselected initial state, refresh persistence and changing only the selected application's status, with zero page errors.
- ESLint and an isolated production build passed. The build did not overwrite the running dev server's output.

Fixtures are labeled synthetic and retained inside the dedicated QA accounts for inspection. No real employer form was submitted and no real inbox was scanned. Private session credentials remain outside Git.

## Limits

This verifies the named scenarios, not every possible race with manual edits or third-party markup changes. Worker tests use real worker code with mocked Chrome/network boundaries; the updated unpacked extension still needs a reload and a normal personal application smoke check. Permanent invalid-payload conflicts remain retained/blocked; item-level repair/discard is future work. Posting/thread/requisition extraction from email, Gmail OAuth, saved-before-applied capture, frozen submitted files and AI scoring remain separate roadmap items.

An independent review found seven material issues; each was addressed with regression evidence. A second review attempt could not run because that review agent reached its usage limit; no second independent approval is claimed.
