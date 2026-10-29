# Extension capture and keyword comparison implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement each task inline, then request an independent review.

**Goal:** Capture the supplied LinkedIn layout accurately, identify the application source in notes, and compare a posting against an owned resume or Master CV using the existing rules.

**Architecture:** Keep extraction local and deterministic. Use stable posting identity, semantic headings and test IDs rather than generated classes. A bearer-authenticated endpoint loads owned resume data and returns keyword coverage only. The popup never receives full CV/resume contents.

**Tech stack:** Existing MV3 JavaScript extension, Next route handlers, Supabase, existing ATS scorer, Playwright fixtures and disposable PGlite.

**Spec:** User-supplied LinkedIn salary/workplace/employment chips and About the job HTML; user selected the existing rule-based checker. Salary chips take priority over conflicting description ranges. Missing geographic data stays unknown; Remote is a workplace, not an invented city. The score is explicitly unweighted keyword coverage, not interview likelihood or a complete ATS assessment. Add a popup comparison panel using the current working-resume selection; no AI, auto-apply, new permissions or dependencies.

## Global constraints

- Work directly on main; preserve unrelated changes.
- Applied migrations001–017 are immutable. Add018 for source notes, keeping event payload/replay identity unchanged.
- Preserve existing user notes, descriptions and application values. No employer submission during testing.
- Scope every service-role read by authenticated user ID. Return no-store responses and bounded results.
- No recognized keywords means no numeric score; insufficient CV or description means an actionable message.

## Review focus

- A search page contains other postings: their salary/description must not leak into the current job.
- Generated classes change; direct and search-result URLs must both work.
- A confirmation page loses details; cached posting values must remain available.
- Foreign resumes, disconnects, late responses and changed inputs must not display a stale/private result.
- Source-note migration must preserve privileges, replay behavior and edited comments.

## Task1: Capture and source notes

- [x] Write a browser fixture from the provided markup with both link variants; run against old reader and observe missing salary/description.
- [x] Add bounded, current-job semantic detail extraction; retain structured-data and older-site fallbacks. Strip UI/script content from descriptions.
- [x] Cover regenerated classes, unrelated jobs, hidden text, absent fields and detail retention through confirmation.
- [x] Add migration018 replacing only the extension's generic default note with a label derived from the normalized posting URL. Backfill only untouched generic extension notes.
- [x] Verify migration on disposable Postgres, including notes, ownership, replay and preservation; apply to configured Supabase if authenticated dashboard remains available.

## Task2: Keyword comparison

- [x] Write server tests for owned resume/Master CV, visible content, empty sources, unknown keywords and cross-user denial; observe failure before implementation.
- [x] Add `POST /api/extension/job-score` with strict `{jobDescription,resumeId}` input and a dedicated service. Reuse `scoreResume` and existing CV adapters. Return keyword coverage, matched/missing terms and source identity only.
- [x] Add a popup-only worker message with account/token checks before and after the request; never expose CV text to the posting page.
- [x] Add a compact comparison panel with explicit action, selected-source label, accessible meter, matched/missing terms and limitations. Invalidate changed inputs and ignore stale requests.
- [x] Test browser popup states, current-tab changes and transport failures; ensure save/capture remains usable.

## Finish

- [x] Run all Node tests, capture/popup browser checks, lint, disposable SQL checks and isolated production build. Request independent review and address material findings.
- [x] Update extension version/docs, commit and push, check deployment, report reload instructions and any remaining limitations. Stop after this requested scope.


Execution record: existing Node tests and new server/worker coverage pass (221 total), capture/detector browser38, comparison popup18, live API16, disposable SQL13, prior autofill popup20 and native MV3 runtime14. Lint and isolated build pass. Independent review found a stale SPA-panel issue and a legacy-layout regression; both were fixed with failing-then-passing browser cases and the reviewer confirmed no remaining material findings. Migration018 applied successfully in the authenticated Supabase SQL editor. See the verification document for limits and fixture identity.
