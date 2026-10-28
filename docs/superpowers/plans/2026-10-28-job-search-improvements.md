# Resume Butler Job Search Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this program one milestone at a time. Steps use checkbox (`- [ ]`) syntax for tracking. Each milestone gets its own bounded implementation plan before product code changes.

**Goal:** Streamline the owner's CS/software applications for personal use first: complete practical non-AI workflow work, then add evidence-based pre-application analysis, optional persona review and truthful tailoring.

**Architecture:** Keep the application record central and reuse server services across the app, extension, and email pipeline. Establish reliable opportunity identity before attaching more automation; share a versioned resume/evidence model across editing, scoring, AI, and export. Ship small verified increments instead of replacing the entire app at once.

**Tech Stack:** Existing Next.js App Router, React, JavaScript, Supabase/Postgres/Auth/RLS, OpenAI through `src/server/openai.js`, LaTeX/PDF pipeline, Manifest V3 extension, Node 24 tests, Playwright browser verification.

**Spec:** [User-needs research](../../research/2026-10-28-job-seeker-needs.md), [official competitor capabilities](../../research/2026-10-28-competitor-capabilities.md), and [existing resume/extension/setup proposal](../specs/2026-10-28-resume-quality-and-setup-design.md). The user requested this roadmap on October 28, 2026. Technical choices below are proposals for review, not claims that the features are implemented.

## Global Constraints

- User steering (October 28): personal use first; finish non-AI improvements before new model-based features. Public release and multi-user growth are deferred. Existing AI may keep working, but do not change prompts/models or require new AI to ship Phase A.

- Primarily optimize for the owner's CS/software job search while supporting other backgrounds through flexible content.
- Preserve current unrelated uncommitted work; do not commit, push, merge the framework upgrade, deploy, or change live configuration merely because a planning checkbox mentions rollout.
- Remain on the current framework until its separate upgrade is validated and integrated; do not combine that merge with feature work.
- Every new table uses RLS; every service-role query is scoped to the authenticated account. Add migrations; never rewrite applied migrations 001–011.
- Require missing migrations for integrity-sensitive writes; retain input or queued work with a clear retry path. Do not fall back to a write path that can corrupt identity or history.
- Keep Master CV facts, editable working documents, and submitted artifacts distinct. Never fabricate qualifications, dates, achievements, or metrics.
- Separate saved job, attempted submission, confirmed submission, inferred email event, and user-approved status. A job-fit check never marks a job applied.
- Keep existing review of email changes. Any later automatic mode needs its own explicitly reviewed policy and measured error rates.
- Use `gpt-6-luna` through the existing server boundary by default, with task-specific overrides and bounded costs; no model requests per keystroke.
- Keep source data and tokens out of job-site DOM, logs, analytics, public storage, and error reporting.
- Preserve quiet Saved / Saving / Not saved feedback, meaningful undo, the 73px header, and current real-PDF page checking.
- Use synthetic accounts and fixtures for testing. Do not submit real job applications or send recruiter messages during QA.
- New modules named below are proposed paths; verify the checkout and allocate the next migration number immediately before implementation.

## Review Focus

1. Same company and title but different requisitions must remain separate; address in RB-01 fixtures and concurrent SQL checks.
2. A retry, account switch, or old open extension must not duplicate an application or expose another user's work; address in RB-01 and RB-08.
3. Later edits or renderer changes must not alter the artifact recorded as submitted; address in RB-02 frozen-byte and ownership tests.
4. Hidden/custom/legacy content must survive editing and be scored exactly as exported; address in RB-03, RB-04, RB-06 and RB-07.
5. A model/provider failure, missed email, or silent employer must not create false success, a low fit score, or a rejection; address in RB-06, RB-08 and RB-11.

## Delivery method and status

Use sequential native implementation by default as a recommendation: complete a bounded task, run focused checks, review its changes, then move to the next. Obtain fresh review where required by the applicable implementation skills. A milestone is complete only when its acceptance criteria are demonstrated; writing a plan does not complete a product milestone.

`ROADMAP.md` is the status index. This document defines scope, dependencies and acceptance. Detailed milestone plans carry file-level tasks. Record evidence, migration state, and deployment state separately in milestone completion notes. Recheck current source at the start of each milestone; do not blindly execute a stale file list.

## Revised execution order — personal use, non-AI first

This revision supersedes the original numeric order of the RB headings below. Keep their scope/IDs as references; execute the A/B sequence in [ROADMAP.md](../../../ROADMAP.md). The user liked the earlier first six feature areas but clarified that daily personal application efficiency comes first. Public launch is not a current milestone dependency.

**Phase A:** baseline → RB-01 identity → RB-07A capture/save/select → RB-04A editable/exportable sections → RB-02 frozen submissions → RB-09A manual answer library → RB-10A deterministic autofill → RB-11A tasks/contacts/rounds → RB-08 integration/deterministic reconciliation → RB-03 immediate checks/PDF extraction → RB-12A/RB-14A descriptive reporting and complete export.

**Phase B:** RB-06A + RB-07B job analysis/extension meter → RB-15 optional persona review → RB-06B + RB-04B/RB-07C truthful tailoring → RB-09B answer drafts → RB-11B contextual interview prep → RB-12B calibration/outcome feedback.

### Split contracts that remove unnecessary AI dependencies

- **RB-04A** implements section storage/editor/export, certifications and legacy adapters. Existing AI continues through a compatible supported representation; manual new sections must be preserved if an existing AI flow cannot select them yet. **RB-04B** later adds AI selection across all section types. Do not hide/degrade manual content to keep an old prompt convenient.
- **RB-07A** implements job capture/save-for-later, description/identity correction, and manual owned resume choice with no scoring call. Its dependencies are RB-01 and current document ownership, not RB-06. **RB-07B** adds shared analysis/score display, and **RB-07C** adds tailoring handoff. Saved opportunities are excluded from applied counts/history until an actual submission transition.
- **RB-09A** stores user-authored answers/stories, versions and copy actions, with no model call and no dependency on RB-06. **RB-09B** later drafts grounded adaptations using RB-06 provenance.
- **RB-10A** fills deterministic user-confirmed fields/documents and offers copy fallback; it depends on A2/A4/A5, not model-based review. No AI interpretation of sensitive answers. Expand sites one at a time; Workday is its own compatibility deliverable. AI long-form assistance is later, not a requirement for autofill.
- **RB-11A** implements tasks, contacts, rounds and reminders without generated preparation. **RB-11B** later uses the selected/submitted facts for optional interview prep.
- **RB-08A/B** may improve transport, cursor handling, deterministic identity/thread reconciliation and review UX around the existing classifier unchanged. No new classifier prompt, model or automatic approval policy in Phase A. Verify current provider requirements before implementation. If external OAuth work blocks, move to the next dependency-ready non-AI item.
- **RB-03** and explicit PDF text extraction are deterministic document checks, not new LLM review. Keep parsing feedback distinct from resume/job suitability.
- **RB-12A** is descriptive counts/cohorts without recommendations; **RB-12B** later evaluates review quality and outcomes. No causal or interview-probability claims from small personal samples.
- **RB-05**, RB-13, CAPTCHA/public distribution, paid plans and growth onboarding are deferred. Baseline verification remains required; merging the framework upgrade is a separate choice, not a prerequisite for writing every feature.

No split changes existing ownership, truthful-content or test requirements. Future detailed plans must name the specific A/B slice, not accidentally reintroduce the entire RB package.

## RB-00 — Baseline and release readiness

**Purpose:** Start from an understood checkout and preserve the existing completed work.

**Touches:** Existing test suite and scripts, `package.json`, `docs/ARCHITECTURE.md`, separate framework-upgrade checkout, auth forms/actions, optional error instrumentation.

- [ ] Inventory current edits and separate earlier implemented changes from planned features; record current app/extension versions and database migration level.
- [ ] Verify the present baseline with Node 24 tests, lint, an isolated production build and the synthetic-account browser flows relevant to the first change. The previous 90-test result is historical evidence, not a fresh pass.
- [ ] Before a public rollout, finish the framework-upgrade signed-in checks and calendar regression separately; integrate only a verified upgrade and update instructions.
- [ ] Before a public rollout, add error monitoring with resume/email/token redaction and useful section error boundaries. Configure CAPTCHA only after login, signup and recovery forms supply tokens, then verify all flows.

**Done when:** The implementation baseline is reproducible and failures are recorded. Framework integration, CAPTCHA and monitoring are public-release gates, not reasons to block local feature development indefinitely.

## RB-01 — Reliable application identity

**Depends on:** RB-00 baseline. **Detailed plan:** [application identity](2026-10-28-application-identity.md).

**Touches:** `src/server/extension/applications.js`, `src/server/email/matching.js`, `src/server/email/sync.js`, `src/features/suggestions/actions.js`, extension worker/readers, additive SQL migration and existing/new regression tests.

- [ ] Persist validated platform/posting identity and preserve canonical posting URLs without deleting identity-bearing query parameters.
- [ ] Prefer strong posting evidence; prevent name/title fallback when reliable identities conflict. Treat indistinguishable candidates as unresolved.
- [ ] Make confirmed-submission retries idempotent and concurrent records safe. Scope extension queue entries to their originating account.
- [ ] Apply the same ambiguity protections during email scanning and transactional approval; preserve terminal-state and hiring-cycle protections.
- [ ] Keep old input readable and protect missing-migration rollout; do not bulk merge existing application rows.

**Done when:** Two simultaneous same-title openings remain separate; repeat deliveries produce one result; ambiguous emails never pick the newest row arbitrarily; concurrent extension recording and email approval remain isolated and correct.

## RB-02 — Frozen submission packages

**Depends on:** RB-01. **Touches:** Application detail/editor and linked documents, `src/features/resumes/actions.js`, resume rendering/download services, new `src/server/applications/submissions.js`, owned submission metadata/private artifact storage and download endpoint.

- [ ] Introduce append-only submission records containing submission time, original posting text/identity, source/provenance, selected document content/schema version, known answers, and confirmation evidence.
- [ ] Preserve exact PDF bytes when the app generated/uploaded the selected artifact, with a private object key and hash. Regenerating later is not proof of the originally submitted file.
- [ ] Let manual applications attach an actual file or explicitly record an unverified selected version; never claim the extension observed uploaded bytes when it did not.
- [ ] Keep a working linked document editable; provide a separate submitted-version preview/download. Record corrections as a new event/version.
- [ ] Test edit-after-submit, deleted source resume, repeated confirmation, failed upload/transaction, unauthorized reads and renderer changes. Define account deletion and orphan cleanup.

**Done when:** Editing or deleting a working resume leaves the recorded submitted artifact intact, and the UI distinguishes observed, user-confirmed and unknown submission details.

## RB-03 — Correct immediate resume checks

**Depends on:** RB-00; can land before RB-02 if an isolated fix is needed. **Touches:** `src/server/ats/*`, `src/features/ats/*`, studio/application callers and tests.

- [ ] Correct blank/hidden-content scoring, inconsistent callers, missing meaningful requirements, misleading phrase matches and mandatory Projects bias.
- [ ] Share visible-content traversal with export; keep document/writing guidance distinct from job-fit arithmetic.
- [ ] Add labeled CS counterexamples for Java/JavaScript, React/React Native, keyword stuffing and insufficient job text.

**Done when:** Empty visible content cannot earn a positive fit score; all callers agree; unsupported requirements are clearly unknown or missing; no universal ATS pass claim appears.

## RB-04 — Flexible Master CV and resume sections

**Depends on:** Stable document traversal; immediate RB-03 defects may be fixed independently. Phase A does not depend on the AI engine. **Touches:** `resumeDocument.js`, resume save validation, studio/section components, `src/features/cv/*`, profile sections, AI selection/generation, `src/server/latex.js`, versioned adapters and owned custom-section storage.

- [ ] Support stable-ID entry, text and list sections; add/rename/reorder/hide/remove with undo while keeping the current starter.
- [ ] Carry certifications and custom sections from Master CV through selection, editor, saved content, scoring, preview and PDF.
- [ ] Read legacy four-list documents, preserve their content, and reject old-client writes that would discard newer sections.
- [ ] Preserve manually added resume content and separate it from source CV facts.
- [ ] Verify round trips, arbitrary heading text, escaping, stale saves, unknown schema versions and frozen submission compatibility.

**Done when:** A custom certification/research/volunteering section survives selection, editing, refresh, review and PDF export without changing another document.

## RB-05 — Guided profile setup

**Depends on:** RB-04 core model; optional copy/checklist work may be prepared sooner. **Touches:** profile page/strength components, auth destination routing, new welcome route and onboarding state migration.

- [ ] Offer import, manual entry and skip; explain how detailed truthful Master CV content supports tailored resumes.
- [ ] Persist started/completed/skipped and allow resume later; make completion explicit rather than forcing 100% completeness.
- [ ] Preserve safe deep links, extension connect, Google/email/password flows and recovery. Existing users bypass forced first-login setup.
- [ ] Remove universal Projects/GitHub expectations and support varied education/credential histories.

**Done when:** A new user can complete or skip setup without loops, returning users are uninterrupted, and the original destination survives authentication.

## RB-06 — Evidence-based fit and truthful AI improvements

**Depends on:** RB-03 and RB-04. **Touches:** shared new review service under `src/server/ats/`, existing OpenAI boundary, review endpoints/UI, resume guardrails, owned review cache and benchmark fixtures.

- [ ] Extract quoted required/preferred/responsibility groups and alternatives; validate requirement/evidence IDs and quoted text.
- [ ] Compute scores in code; expose supported/partial/not-evidenced/confirmation states and critical gaps. Calibrate the proposed rubric on labeled CS examples before publishing thresholds.
- [ ] Separate full-background fit, selected visible resume match, document readability and writing feedback; keep personal constraints separate.
- [ ] Add claim provenance to suggestions, before/after review, and questions for missing facts. Reject unsupported credentials, technology substitutions and invented metrics.
- [ ] Cache by account, source/job hashes, model/prompt/schema/rubric versions; invalidate visibly after edits. Failures retain instant checks without manufacturing a low score.
- [ ] Check actual exported-PDF text separately from structured content and pagination. Compare expected content/reading order; do not claim vendor ATS certification.

**Done when:** A user can see evidence behind every supported requirement, reproduce a saved review, understand an omitted CV fact, and safely recover from stale responses/provider failures.

## RB-07 — Extension score, select and tailor

**Depends on:** RB-07A capture only requires RB-01/current owned document reads. RB-07B scoring requires RB-06; bind submitted artifacts through RB-02. **Touches:** popup HTML/CSS/JS, background trusted UI handlers, job extraction, revocable-token endpoints and document selector.

- [ ] Add Master CV/owned resume selection and an explicit review action on supported postings.
- [ ] Show the shared engine's strengths, critical gaps and omitted evidence; open tailoring with the same job/source.
- [ ] Add a saved/wishlist opportunity state distinct from applied, without converting older applications or counting saves in application statistics.
- [ ] Preserve job/source identity through in-page navigation, requests and submission. Clear account-specific choices on disconnect; never expose full CV data to content scripts.
- [ ] Verify missing descriptions, LinkedIn in-page job changes, changed source, account switching, revoked token and out-of-order results.

**Done when:** The extension and app agree on the same inputs/review version, the selected resume is explicit, and scoring/saving never falsely records an application.

## RB-08A — Application Updates and ambiguity resolution

**Depends on:** RB-01 and RB-02. **Touches:** existing email services/review UI, IMAP reader metadata, new owned message-to-application links and sync progress metadata.

- [ ] Persist relevant Message-ID/In-Reply-To/References evidence and validated requisition/posting links; distinguish thread binding from company-name guesses.
- [ ] Add “Link to existing application” and “Create new application” resolution with audit history. Revalidate ownership/current state on approval; prevent correction races.
- [ ] Show match reason, uncertainty, source email, scan freshness, failures, retry/backlog progress and unresolved count.
- [ ] Make large-mailbox progress incremental and bounded so repeatedly scanning the newest cap cannot starve older messages.
- [ ] Test forwarded/quoted mail, shared recruiter threads, multiple roles, old cycles, delayed rejection, malicious instructions and partial provider failure.

**Done when:** Users can correct a mistaken match and continue safely, ambiguous evidence stays unresolved, and a large backlog can make measurable progress without skipping mail.

## RB-08B — Gmail connection

**Depends on:** RB-08A provider-neutral reconciliation. **Touches:** connection/settings UI, new server Gmail adapter/OAuth callback, encrypted token storage, cron and setup documentation.

- [ ] Design and verify OAuth state/PKCE, account binding, least necessary scopes, encryption, refresh/revocation and disconnect/delete behavior against current official Google requirements.
- [ ] Keep Google account login separate from granting mailbox access. Do not assume `gmail.metadata` supports body-based classification or the same search behavior.
- [ ] Share the existing reconciliation pipeline; implement history cursor recovery, initial bounded import, expired history and reconnect. Start with the existing cron; add push only if justified.
- [ ] Provide manual/paste/import or forwarding alternatives where appropriate; preserve IMAP during rollout rather than forcing a switch prematurely.
- [ ] Prepare consent screen and applicable Google verification requirements before public release; verify actual requirements at implementation time.

**Done when:** A synthetic/test mailbox can connect, import, incrementally reconcile, revoke and disconnect without loss or cross-account access. Public eligibility is a separate release gate.

## RB-09 — Approved answer library

**Depends on:** RB-09A manual library uses owned user-authored facts; RB-09B AI drafts depend on RB-04 facts and RB-06 provenance. **Touches:** new answer feature and owned store, profile/editor integration, shared drafting service and extension trusted UI.

- [ ] Store approved reusable facts and accomplishment stories with source references, categories and editable versions.
- [ ] Support common questions and contextual drafts; distinguish a factual stored answer from a job-specific adaptation.
- [ ] Keep salary, authorization, relocation and demographic answers user-controlled, optional and never guessed.
- [ ] Offer copy buttons first, before broad form automation; include approved answers in submission packages where known.

**Done when:** Repeated questions can be answered from approved material without invented claims, stale answers are identifiable, and users can edit/delete/export their library.

## RB-10 — Reviewed autofill and platform expansion

**Depends on:** RB-07A, RB-09A and RB-02 for deterministic filling; AI additions use their Phase B counterparts. **Touches:** per-platform form adapters, worker/UI, document binding and extension fixture/browser tests.

- [ ] Add filling one platform at a time, starting with a supported simple ATS. Separate fill, review and submit; leave submission to the user.
- [ ] Show filled/uncertain/unsupported fields, preserve manual overrides, bind the intended resume, and provide copy fallback. Never overwrite referral attribution without a deliberate choice.
- [ ] Measure completion plus correction time and wrong-field incidents before expanding. Add Workday as a dedicated milestone with multi-step/employer-specific fixtures.
- [ ] Add optional site permissions and graceful generic capture; fix signed-out overlays, performance and account/queue isolation. Update popup support copy and version.
- [ ] Prepare Chrome Web Store listing, privacy disclosures and reproducible compatibility checks once release gates pass.

**Done when:** On each claimed platform, reviewed filling saves time including corrections and cannot silently restore an older resume or overwrite a corrected answer. Unsupported forms are labeled honestly.

## RB-11 — Next actions, contacts and interview workspace

**Depends on:** RB-02; reuse RB-08 evidence and RB-09 stories when available. **Touches:** application detail, dashboard follow-ups, new contacts/tasks/interview-round features and owned schema, optional calendar export/reminder delivery.

- [ ] Add dated tasks/reminders, contact/referral records, multiple interview rounds, assessment links/deadlines and notes per round.
- [ ] Show a useful daily queue with clear due/snoozed/done states and timezone-safe reminders; separate preference-controlled notifications from automatic recruiter messages.
- [ ] Build contextual prep from the exact submitted materials and JD: relevant true stories, likely technical topics, questions to ask and a short briefing. Generated questions are suggestions, not leaked employer questions.
- [ ] Keep stage semantics stable while allowing friendlier labels; represent aging/no response as a derived indicator, not a rejection. Late replies can restore attention.

**Done when:** An interview invite leads to the right original materials and actionable preparation, and due dates work across refresh, timezone/DST boundaries and notification retries.

## RB-12 — Useful outcome feedback

**Depends on:** RB-01, RB-02 and reliable response/stage data. **Touches:** dashboard data/charts, application source/referral metadata and versioned review/submission links.

- [ ] Separate saved/applied/attempted/confirmed and interview stages; define response types and denominators explicitly.
- [ ] Compare observed screens/interviews by source, role family, resume version and application cohort with counts and observation windows.
- [ ] Distinguish pending/unobserved outcomes from rejections; suppress confident advice from tiny samples. Do not claim correlation establishes causation.
- [ ] Allow source/referral tagging and exports of the underlying records; keep goals supportive rather than rewarding blind volume.

**Done when:** Every displayed rate can be reconciled to underlying records, sparse cohorts are clearly limited, and a user can identify useful next experiments without promised outcomes.

## RB-13 — Target-company discovery and freshness

**Depends on:** RB-01 identities and RB-06 fit. **Touches:** new watchlist/provider adapters, bounded scheduled checks, saved opportunities and preference controls.

- [ ] Let users follow selected companies and role criteria rather than building a general marketplace first.
- [ ] Prefer official feeds/public ATS interfaces where available; verify current provider terms/limits. Persist employer link, first seen, last checked, posting identity and observed changes.
- [ ] Deduplicate location variants carefully, remember dismissals, expose remote-location constraints and notify only for relevant changes.
- [ ] Label unavailable/stale/unknown observations honestly; never claim to detect employer hiring intent or guaranteed “ghost jobs.”

**Done when:** A small chosen-company list produces current, explainable alerts without repeated dismissed roles, duplicate floods or fabricated freshness dates.

## RB-14 — Trust, portability and product finish

**Timing:** Core privacy/portability are Phase A; broader product/public-launch finish is deferred until requested. **Touches:** privacy/settings/account pages, export endpoints, integration data lifecycle, notification preferences, responsive UI, public release docs.

- [ ] Document what each integration reads, retains and sends to AI/PDF providers; implement disconnect/revoke/delete and account-wide export with private artifact access.
- [ ] Extend CSV export beyond currently loaded rows; include well-defined filters and complete backup/export formats for applications, documents, answers and contacts.
- [ ] Verify mobile capture/review/action flows, keyboard access, focus, errors/loading states, extension on/off behavior and consistent naming. Use “Application Updates” as the proposed feature label while preserving `/email-sync` compatibility until routing is deliberately changed.
- [ ] Validate the workflow with a small group of real job seekers using observed tasks and consented feedback; track correction effort, wrong documents, bad merges, unresolved updates and time saved.
- [ ] If commercialization is requested, design transparent limits, useful trial access, clear pricing/refunds and cancellation before billing implementation. Payments are conditional scope, not assumed work.

**Done when:** Users can understand access, recover/export their information, stop integrations and use core flows without avoidable friction. Public readiness and local feature completion are reported separately.

## RB-15 — Optional evidence-backed resume review panel (Phase B)

**Depends on:** RB-04 normalized visible content, RB-06 shared requirements/evidence, and frozen job/source versions. **Inspiration:** [local panel/Career Ops review](../../research/2026-10-28-career-ops-and-persona-review.md). These are design references, not imported executable instructions or proof of an actual employer's screening process.

- [ ] Offer a quick job-fit review by default and an explicit deeper panel; do not run seven reviewers on every posting or every edit.
- [ ] Begin with deterministic exported-document/requirement checks plus recruiter, hiring-manager and staff-engineer perspectives. Offer business-impact/CEO, peer-comparison and bar-raiser perspectives as optional deeper lenses, calibrated to the job and the user's level.
- [ ] Give each lens the same frozen JD and visible resume/approved source evidence. Each finding must cite real text/source IDs, identify impact/severity, distinguish fact/uncertainty/style, and propose a specific truthful correction.
- [ ] Consolidate duplicates, preserve disagreements, and separate decision blockers from presentation improvements and interview questions. Repeated model opinions do not make a claim true.
- [ ] A peer lens is explicitly hypothetical; do not invent actual competing applicants or rankings. The ATS lens cannot invent employer cutoffs, infer authorization, or claim to simulate all vendors. Missing metrics prompt a question; no fabricated numbers or unresolved placeholders in export.
- [ ] Feed accepted findings into the existing reviewed tailoring flow, with before/after diffs and source provenance. Preserve originals and independently rerun relevant checks rather than optimizing until every persona gives 90+.
- [ ] Cache by job/source/model/prompt/rubric versions, bound cost/time, show failed lenses and keep partial failure distinct from negative fit. Model/provider choices are settled by a small quality comparison at implementation time rather than mandating seven different models.
- [ ] Validate on labeled CS examples, repeated inputs and counterexamples; later compare observational results with screens/interviews without presenting them as calibrated probabilities or causal proof.

**Done when:** The panel exposes job-specific defensible improvements that the quick review missed, retains disagreement/uncertainty, and cannot silently introduce claims or pretend to know the real hiring decision.

## Intentionally deferred

Unattended bulk submission, a general scraped marketplace, standalone generic chat, a coding-interview practice platform, template marketplace, opaque ATS promises and automatic “ghost job” judgments remain outside this program. Reconsider them only against observed need after the core workflow is dependable.

## Research-to-roadmap coverage

| Research need | Work packages |
| --- | --- |
| Repetitive input and net time saved | RB-09, RB-10 |
| Correct selected resume / exact submitted package | RB-01, RB-02, RB-07, RB-10 |
| Explainable, consistent matching / multiple resumes | RB-03, RB-06, RB-07; optional panel RB-15 |
| Truthful writing and answers | RB-04, RB-06, RB-09 |
| Automatic tracking / ambiguous emails / freshness | RB-01, RB-08A, RB-08B |
| Job constraints, stale listings, company alerts | RB-06, RB-13 |
| Flexible sections, education, onboarding | RB-04, RB-05 |
| Contacts, reminders, interview context and emotional friction | RB-11, RB-12 |
| Privacy, portability, fair paid value and compatibility | RB-00, RB-14; platform work in RB-10 |

## Completion protocol for every milestone

1. Re-read the relevant current code, dependencies and accepted design; record any changed assumptions.
2. Write or refresh its bounded implementation plan with exact files, interfaces and failure cases. Settle material product choices before coding.
3. Implement one testable task at a time, with regression evidence for integrity-critical behavior.
4. Run focused tests, then the full relevant checks once stable; use synthetic signed-in browser/PDF/extension checks where applicable and isolated builds.
5. Review, fix material findings, and record evidence. Update `ROADMAP.md`; distinguish local, migrated and deployed.
6. Follow the revised Phase A/B order; begin the next dependency-ready milestone only after the current one meets its criteria or an explicit blocker is documented. Do not silently leave an incomplete milestone marked complete.
