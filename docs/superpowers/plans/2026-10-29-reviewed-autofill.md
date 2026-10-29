# A6 — Reviewed Lever autofill implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repetitive typing on Lever application forms while keeping the owner in control of every proposed field and the eventual submission.

**Architecture:** A token-authenticated server read exposes only owned contact facts and approved answer choices to the trusted extension popup through its worker. A separate, top-frame Lever adapter inventories visible fields without transmitting existing values; the worker keeps a short-lived review bound to the account, tab, URL and form. Filling requires an explicit popup action, fresh source checks and a second DOM check, and never enters the submission/retry queue.

**Tech stack:** Existing Next.js route handlers, Zod, Supabase, MV3 JavaScript, Node 24 tests and Playwright. No new runtime dependency or migration is expected.

**Spec:** [Personal workflow program](2026-10-28-job-search-improvements.md), RB-10, following [A5](2026-10-29-approved-answers.md). The owner requested uninterrupted inline execution on main; continue within that authorization rather than adding a new design-approval pause.

## Global constraints

- Start with one simple platform: top-level `https://jobs.lever.co/<company>/<posting>/apply`. Other platforms retain capture/tracking only. Workday remains a separate milestone.
- No new AI, inferred employment/eligibility/demographic facts, referral overwrites, automatic employer submission, consent acceptance or file attachment.
- Contact facts come from the Master CV profile, not a guessed current employer or a selected resume's hidden content. The working resume remains an explicitly labeled preparation choice; opening/downloading it is separate from attaching it manually.
- Reuse only owned, currently approved, unarchived answer revisions. Exact question matches may propose a single answer; ambiguous or different questions require an explicit selection and a visible preview.
- Preserve all existing input, including whitespace and corrections made after review. Skip hidden, disabled, readonly, unsupported, changed or detached controls. Never silently truncate an answer.
- Only the popup can request source data or filling. No token, entire profile, answer library or existing typed values go to job-page scripts. Send only explicitly selected values when the user fills.
- Recheck the connected account and active tab after every asynchronous boundary before releasing source data or changing fields. Bind reviews to a unique document/form inventory; expire after five minutes or worker restart. Never persist proposed values or queue autofill for retry.
- Applied migrations001–017 are immutable. No worktree. Preserve unrelated `LazyCharts 2.jsx`.

## Grounding and UI direction

Read-only inspection on 2026-10-29 of a public Lever application confirmed `form#application-form` (POST, no explicit action), `.application-question`, `.application-label`, and names `name`, `email`, `phone`, `urls[LinkedIn]`, `urls[GitHub]`, `urls[Portfolio]`, `cards[uuid][fieldN]`, and `comments`. Custom questions often have no HTML label association, so use the local `.application-label`. `#location-input` includes geocoding state; typing a city alone does not establish a valid location. `org` has no authoritative profile equivalent. `eeo[...]` includes signature inputs that must never inherit the ordinary name mapping. No personal data was entered or submitted.

Keep the extension's existing white/slate/sage identity: white `#ffffff`, text `#0f172a`, secondary `#475569`, muted `#64748b`, border `#e2e8f0`, and a darker accessible action sage `#326f5a`. Use its existing system type stack, sentence-case labels, readable wrapped answer previews and native keyboard-accessible selections. The review is a field checklist, not a percentage score or a promise that an application is complete. A compact summary distinguishes selected fields, preserved values and manual work. A separate manual section names unsupported fields and gives the next action. Inline progress/error states remain visible; no save toasts.

## Review focus

1. Switching account or active job while a fetch is pending must release no source data to a page and fill nothing.
2. A label, control, form action or document changing after review must not redirect a proposed value to a different question.
3. Repeated labels, multiple approved versions for the same question, special widgets and EEO signatures must not be mistaken for safe contact facts.
4. An answer edited, unapproved, archived or deleted after preview must stop reuse until fresh review, without clearing manual form input.
5. Long answers, Unicode, input limits, delayed UI events and browser/clipboard failures must preserve truth and show useful partial/manual outcomes.

## Task 1: Owned source reads and source freshness

**Files:** Create `src/server/extension/autofill.js`, `src/app/api/extension/autofill/route.js`, and `tests/extension-autofill.test.mjs`.

**Interfaces:** `getAutofillContext(admin,userId)` returns normalized contact facts, a stable contact fingerprint and at most100 approved answer metadata choices. `resolveAutofillSources(admin,userId,{profileFingerprint,answerSelections})` returns the unchanged contact facts and at most50 current selected answer bodies or a409/404. Both routes authenticate with `authenticateExtension`; every service-role read filters by the authenticated user. GET and POST are read-only and `no-store`; POST is bounded JSON with unique IDs/revisions.

- [x] RED tests: a foreign profile/answer is never returned; draft/archived answers are unavailable; changed contact facts or answer revisions reject reuse; unrelated CV edits do not change the contact fingerprint; unsafe legacy links and oversized input are not filled.
- [x] Implement explicit profile columns and normalization, strict read schemas, approved metadata choices and current selected-version resolution using A5's service.
- [x] GREEN focused tests plus a live synthetic second-account API check before declaring ownership verified.

## Task 2: Bound form inventory and safe writes

**Files:** Create `extension/content/autofill.js` and a sanitized `tests/fixtures/lever-application.html`; modify `extension/manifest.json`; add a Playwright autofill fixture check under `scripts/`.

**Interfaces:** Worker-to-top-frame messages `autofill:scan` and `autofill:apply`. Scan returns `{inventoryId,url,fields,manual}` with ephemeral field IDs, labels, supported source kinds, emptiness and input limits, never existing values. Apply consumes that inventory and selected `{fieldId,value}` pairs and returns per-field outcomes/counts. Recheck URL, form identity/action, field identity/name/type/label, visibility, enabled/editable state and exact empty value before each write. Use the native value setter and bubbling input/change events; no clicks, submit, requestSubmit, file writes or follow-up network requests.

- [x] RED browser fixtures for blank contact fields and approved custom text, existing/manual corrections, hidden/readonly/disabled fields, EEO signatures, referral questions, geocoded location, duplicate labels and oversized text.
- [x] Implement one top-frame Lever adapter with document-local inventory and no access to profile/library/token. Reinjection has one listener and invalidates stale inventories.
- [x] GREEN: detached/replaced inputs, changed form action/name/label, navigation and late manual edits cause no wrong-field writes; Unicode and valid multiline answers survive exactly. Count filled/preserved/manual outcomes in fixtures, and verify no form submission or file attachment.

## Task 3: Trusted worker review lifecycle

**Files:** Create `extension/autofillReview.js`; modify `extension/background.js`; create `tests/extension-autofill-review.test.mjs`; extend actual worker boundary tests as needed.

**Interfaces:** `createAutofillReview({api,connectedAccount,activeTab,sendToTab,now,randomId})` supplies popup-only `prepare`, `selectAnswer`, and `fill` handlers. Reviews are in-memory, bounded, five-minute, one-shot for writes and scoped to a connection identity and a top-frame inventory. Worker responses contain review data only for the popup. The job page receives only scan commands and explicitly selected field/value pairs; answers are re-resolved before filling. Failed checks require fresh review rather than a background retry.

- [x] RED tests: an exact single question proposes a current approved answer; ambiguity requires choice; selecting another answer previews that current version; content senders cannot access any of these handlers.
- [x] RED concurrency tests pause API calls, switch account/tab/URL, then resolve; no fill or stale source response. Expired/restarted/duplicate/invalid plans and concurrent fill/select actions do not write.
- [x] Implement lifecycle helpers and register only in `popupHandlers`; keep capture/tracking behavior independent.
- [x] GREEN tests with real lifecycle code and the Chrome boundary, including a source changed between review and fill.

## Task 4: Professional popup review and manual fallback

**Files:** Create `extension/popup/autofill.js`; modify `popup.html`, `popup.css` and `popup.js`; add browser popup checks.

**Interfaces:** Review fields → per-field checkbox/value/source preview and approved-answer selection → explicit “Fill selected fields”. Show actual filled/preserved/skipped outcomes, source-refresh errors and a fresh-review action. Copy fallback uses reviewed values and inline success/manual selection if the clipboard is unavailable. Link to edit Master CV/answer library and open the chosen working resume for manual upload; explain current location still needs a suggestion selection.

- [x] RED fixture checks for review/selection, pending/error/empty states, text-only rendering of hostile labels/answers, keyboard labels/focus, overflow and capture remaining usable during an autofill outage.
- [x] Implement a bounded review panel, accessible source/value previews, manual steps and current resume link. Do not show private answer content before explicit review; do not clear manual inputs or claim upload/submission.
- [x] GREEN narrow and full fixture flows; screenshots at the real popup width and a narrow viewport, with descriptive completion/correction/wrong-field counts.

## Task 5: Integration, independent review and deployment

**Files:** Update `extension/README.md`, `docs/chrome-extension-plan.md`, `docs/ARCHITECTURE.md`, `ROADMAP.md`, privacy disclosure and new `docs/reviewed-autofill-verification.md`.

- [x] Run live synthetic token-auth reads for the two existing QA accounts, stale/unapproved answer checks, disconnected-token checks and manual input preservation; never fill or submit a real employer form with personal data.
- [x] Prefer a real unpacked-extension runtime if available; distinguish actual runtime verification from mocked Chrome API fixture checks. No new browser permissions beyond the existing host scope.
- [x] Run all Node tests, lint, an isolated production build and relevant browser flows. Obtain the skill-required independent review and fix material findings with regression evidence.
- [x] Record supported fields/platforms, fixture outcomes and limits. Feature9988a20 is pushed to main and passed [CI](https://github.com/DoniyorI/resume-butler/actions/runs/40942835690) and [deployment](https://vercel.com/doniyoris-projects/resume-butler/BA341dYHYS4iBRPE5iFFeRrVAYLA). The owner's latest instruction is to stop after A6; do not startA7.
