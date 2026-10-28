# RB-01: Application identity and safe ingestion

Status: **proposed technical design for roadmap review**, October 28, 2026. The user requested the roadmap and sequential plans; this document does not claim implementation or live migration approval.

## Intent

Prevent two openings with the same company/title from being silently combined, and prevent repeated delivery of one confirmed submission from making duplicates. Apply conservative identity decisions across extension ingestion, email scanning and approval. This is the first milestone of [the job-search program](../plans/2026-10-28-job-search-improvements.md).

## Approaches

1. Patch only the extension's company/title fallback. Small, but leaves SQL approval and retry races inconsistent.
2. Introduce a full event-sourced opportunity system. Flexible, but unnecessary scope for a working personal application.
3. **Recommended:** additive identity fields, a small ingestion receipt ledger and atomic write services; retain existing application rows/status history. Add unresolved-match review where evidence cannot choose safely.

The third approach is the planning recommendation, not a claim that the user chose its internal schema. Preserve the current framework, JavaScript conventions and server ownership boundaries.

## Terms and limits

- An **opening** is a posting identified by platform, employer-board namespace and posting ID, or a conservative canonical URL.
- An **application** is an application attempt/cycle to an opening. A later valid reapplication can be a different row.
- An **ingestion event** is one confirmed-submission report. Its stable event UUID is reused across transport retries; it is not the posting ID.
- An **unresolved match** has plausible candidates but insufficient evidence. It must not silently pick the newest row or masquerade as confirmed new activity.
- Preserve existing 120-day cycle and terminal-state protections for choosing a target for a **new event**. A replay of an already recorded event returns its prior result even if the row is now closed/older. Replays cannot revive deleted rows.
- No AI model may manufacture a posting ID, and no identity comparison is allowed across accounts.

## Identity decisions

Add nullable `posting_platform`, `posting_namespace`, `posting_id`, and `posting_url_key` on applications. Platform values initially cover linkedin, greenhouse, lever and ashby. Namespace comes from the supported URL's board/company identity; LinkedIn uses a fixed global namespace. Validate supplied metadata against supported URLs where an ID can be derived. On disagreement, refuse the input rather than silently choosing one. IDs/namespaces are bounded text (200 characters each), platform is at most 40, URL is at most 2,000.

Canonicalization is explicit per platform: preserve Greenhouse embedded-form `for`/`token` identity, normalize LinkedIn view/currentJobId URLs to the same posting, and normalize Lever/Ashby application suffixes. Strip known tracking parameters/fragments only where safe. Do not strip every query parameter from unfamiliar URLs, case-fold case-sensitive paths, equate different employer boards, follow redirects, or fetch arbitrary URLs on the server.

For a fresh extension event:

1. An exact strong posting identity or canonical posting URL can reuse **one** same-cycle row if neither side has conflicting strong identity.
2. If both reliable identities differ, name/title equality cannot override them. Record distinct postings separately.
3. A legacy weak match requires exactly one eligible normalized company/exact-role candidate, with no conflicting known links/identities. Known different nonempty URLs block a name-only merge.
4. Multiple plausible candidates, or contradictory URL/ID evidence, remain unresolved/refused. Never choose `find()`/newest as a tie-breaker for identity.
5. A confirmed distinct submission may create a new row; this milestone does not auto-merge historical duplicates or fabricate a historical identity.

For emails without stronger evidence, preserve exact-company and whole-role behavior but require **one eligible application**, not merely one distinct title. Two same-title rows are ambiguous. Use an explicit matched/new/ambiguous decision internally; retain `findTargetApplication()` as a compatibility wrapper returning a row only for a matched decision. Future thread/requisition evidence is RB-08A.

## Atomicity and receipt ledger

Add `application_ingest_events`: account, source (`extension`), event UUID, canonical payload hash, nullable application ID, state (`needs_matching`, `recorded`, `deleted`), stored created/reused result, timestamps and deletion/tombstone marker. Unique `(user_id, source, event_id)`. RLS enabled, no direct anon/authenticated access; server ingestion and narrowly scoped authenticated resolution RPCs mediate access. Retain receipts for account lifetime in this first version, remove on account deletion, and minimize resolved payload to identity/result/hash rather than raw descriptions. Only unresolved events temporarily retain the bounded validated record input needed to complete ingestion; erase it upon resolution. Do not expose it through a general table read.

Add service-role-only `record_extension_application(p_user_id uuid, p_event_id uuid, p_payload jsonb)`. Authenticate the extension before calling it. Validate fields and bounds again in SQL; serialize with the same per-user advisory transaction lock used by suggestion approval. Choose/create/fill missing details and persist the receipt atomically. Reusing an event with a different payload hash is a conflict. Replay after Undo/deletion returns a handled conflict, not a new application. Preserve missing-only enrichment and prevent status downgrades.

On ambiguity, **commit** a `needs_matching` receipt with the event UUID, bounded input, reason and owned candidate IDs. Return an RPC result `{status:'needs_matching',eventId}`; the HTTP adapter translates it to 409 `needs_matching` after commit. Do not raise a SQL exception that would roll back the review item. Repeat deliveries of the same event return the same unresolved result.

An authenticated `list_unresolved_extension_events()` RPC exposes only the current user's bounded review metadata. `resolve_extension_application_event(p_event_id uuid,p_target_application_id uuid,p_create_new boolean)` looks up the event through `auth.uid()`, locks/revalidates its state and candidate decision, then links an explicitly chosen eligible application or creates the explicitly confirmed separate application from the retained input. It completes that **same receipt** with application/result and clears temporary input in the transaction. Concurrent resolution is idempotent; a later transport retry returns the completed result. An incompatible known posting identity cannot be overwritten even by this picker. Deleted replay targets become tombstoned conflicts.

Replace the existing `approve_application_suggestion` definition in a **new** migration, preserving its current public four-argument interface and adding a separate owned resolution action/RPC if necessary. Count distinct eligible rows and reject an ambiguous approval until the user explicitly chooses a target or confirms a separate application. Use current ownership/state/status guards inside the transaction. Extension recording and approval share the lock; neither can slip a duplicate between the other's read and write.

Reserve migration `012_application_identity.sql` only if 012 is still the next number at implementation. Never edit applied 011. Before migration installation, identity-sensitive writes return a retryable setup error; queued events stay queued. Reading the application list remains available. Do not silently invoke pre-011 approval fallback after this new safety contract is enabled.

## Extension compatibility and account isolation

Add stable `userId` to `/api/extension/me`. Store account identity with the connection and each new queued event. Generate `eventId` once when the confirmed event is recorded, before first transport; retry the same captured date, payload and UUID. Associate duplicate detector notifications for the same observed submission with that event until receipt is known. Serialize queue modifications so overlapping storage read/write cycles do not lose entries.

Never replay account A's queue under account B's token. Unscoped legacy queued entries require an explicit user decision rather than automatic reassignment. A `needs_matching` response keeps the entry account-bound and shows a review action without repeated toasts; bounded retry/polling can discover the completed receipt after resolution. Older clients without event UUIDs are accepted through conservative URL/identity matching and a server-generated event ID, with weaker replay guarantees documented; support can require an extension update for ambiguous events. Do not invent a deterministic UUID solely from company/title/date, which would collapse real same-day submissions.

## Review and correction

Persist bounded `match_reason` and candidate identifiers for an ambiguous suggestion in a backward-compatible field set. Show **Needs matching**, source email summary, company/role/date/link distinctions, and an owned target picker. Permit linking to an existing application or explicitly confirming a distinct new application. Recompute eligible candidates on the server; client candidate IDs are untrusted. Pending suggestions do not automatically merge with each other solely because two titles match.

Show extension unresolved events in a separate **Needs matching** section on the applications page, using their event UUIDs and extension resolution RPC rather than pretending they have email suggestion IDs. The same picker presentation can be reused, but source-specific actions preserve their own transactions. Minimal resolution for both sources is part of RB-01 so ambiguous items have a recovery path; richer thread evidence, corrections history and bulk workflow belong in RB-08A. Keep routine save feedback quiet and preserve explicit review/undo affordances.

## Acceptance and rollout

- Same company/title + two posting IDs/URLs creates separate rows.
- Equivalent supported URLs identify the same opening; different board namespaces remain separate.
- Multiple same-title candidate rows never get an arbitrary email target, including during approval after a concurrent insert.
- Replayed event UUID returns its original application; conflicting payload, deleted target or another user's event cannot recreate/mutate it.
- New reapplication events obey existing cycle/terminal rules without invalidating replay behavior.
- Two concurrent deliveries and extension-versus-email approval produce the intended row count and history under real Postgres transaction semantics.
- Account switch, service-worker restart, offline retry and missing migration preserve work without writing to another account.
- An ambiguous extension event survives refresh/restart, resolves through its original UUID, and subsequently replays as the completed result without another application.
- Existing rows load without backfill. Old and new extension payloads are validated and tested.

Tests include pure identity cases, server/API integration, real Postgres permission/concurrency checks and synthetic browser/extension fixtures. Do not submit actual employer applications. Keep local code completion, SQL application and deployment as separate recorded states. Frozen submission artifacts are RB-02, not a side effect of this identity migration.
