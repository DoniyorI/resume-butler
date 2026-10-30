# Interface and resume import fixes

> **For agentic workers:** Use superpowers:executing-plans inline; get one independent review before completion.

**Goal:** Resolve the supplied dashboard/Documents spacing, header action, education validation and duplicate import reports.

**Architecture:** Preserve current sage/slate UI. Give paired dashboard cards equal height, make the global add action secondary, move document collection links into a clearly clickable row. Normalize optional CV dates consistently. Replace append-only imports with one owned, transactional SQL merge.

**Spec:** User screenshots and uploaded PDF; user explicitly prefers retaining existing work and adding unique bullet points. No original CV rows or bullet text are deleted. Matching is case/whitespace normalized, exact identity plus compatible dates; different roles or conflicting date periods remain separate. Multiple candidates are skipped and reported for review. Repeated imports must not add duplicates. The uploaded PDF is inspected locally; automated model tests use fictional extracted output.

## Constraints and review focus

- Direct main workflow; preserve unrelated LazyCharts 2.jsx.
- Applied migrations001–018 are immutable. New019 is an authenticated, owner-scoped merge RPC; no service-role write access from the browser.
- Atomic merge and per-owner import serialization; failure must roll back all import writes.
- Existing labels, dates, notes and bullet order are preserved; only missing facts are filled.
- Empty optional dates become null. Invalid calendar dates must not be accepted. Unknown dates remain unknown.
- No invented January dates for year-only source dates; the existing month-first-day convention remains for month/year values.
- No autosave toast changes or unrelated roadmap work.
- Automatic approval review reported a usage-limit failure; complete unaffected local work, report any validation/integration actions still blocked without bypassing review.

## Task1: UI fixes

- [x] Align dashboard charts and their loading heights.
- [x] Restyle the global New application action as an outlined secondary control.
- [x] Separate Documents title from clearly outlined collection navigation, preserving responsive wrapping and focus states.
- [x] Inspect desktop/mobile rendered states where browser access permits; keep screenshots.

## Task2: CV date correctness

- [x] Reproduce saving a list containing an unchanged blank end date in an actual saveEducation action test.
- [x] Add shared strict date helpers, normalize optional blank dates at the action boundary, and safely bridge month inputs.
- [x] Test blank/null, leap-day, invalid month/day and imported partial dates.

## Task3: Safe repeated resume import

- [x] Add failing tests for normalized import payload and owned merge RPC behavior.
- [x] Add migration019: exact compatible-date matches, missing-fact fill, normalized bullet/skill deduplication, append order, ambiguous review count, transaction rollback and tenant isolation.
- [x] Make the parser normalize untrusted dates/fields and call the merge RPC; fail clearly before writes when setup is missing. Return truthful added/merged/bullet/review counts.
- [x] Update import UI with actual counts, useful progress and the merge policy. Preserve retries and file input reuse.
- [x] Verify disposable PostgreSQL repeats, distinct roles/periods, ambiguous duplicates, ownership, rollback, preserved facts and bullet order.

## Finish

- [x] Full Node tests, lint, isolated build, available browser checks and fresh independent review.
- [x] Apply019 and verify live initial/repeated/unique-bullet merge assertions with all fictional fixtures rolled back.
- [x] Commit/push and check deployment through the normal approval gate.
- [x] Update evidence/handoff, then stop at this requested scope.


Execution evidence:229 Node tests,23 disposable SQL checks, lint and a production build using the previously cached fonts pass. Actual desktop/mobile component checks completed via IAB ; the later browser-session failure was recovered with a tool reset. Independent review's React18 pending-state issue was fixed and confirmed. Temporary preview removed; real PDF only read locally. Migration019 is APPLIED and the live rolled-back smoke test passed. Next migration020;001–019 are immutable.


Deployment: product commit fa2dedf3ee6647f14deb824e92f635b656386a06 pushed to main; GitHub Checks40979862847 and Vercel87qqqyb4zWRuvXCqK7Zn72y1QTPT both succeeded. Stop here; A7 remains unstarted.
