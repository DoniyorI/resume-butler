# Resume Butler Roadmap

Updated October 28, 2026 — personal-workflow revision. Streamline the owner's applications first, complete non-AI work before expanding AI, and implement one bounded task at a time. Public release is not the current objective.

**Direction:** Capture a job, prepare the right truthful resume, apply with less repeated work, preserve the submission, and keep the next action visible. Keep the earlier tracking, extension, resume-building, setup, email and reusable-answer ideas; change their order and scope around personal CS/software use.

**Full scope and acceptance criteria:** [Job-search improvements plan](docs/superpowers/plans/2026-10-28-job-search-improvements.md).
**Research:** [User needs and complaints](docs/research/2026-10-28-job-seeker-needs.md) · [Official competitor capabilities](docs/research/2026-10-28-competitor-capabilities.md).

## Current baseline

The app uses Next.js + Supabase, server-owned auth/data access, a Master CV, resume and cover-letter studios, application tracking, status history, dashboard analytics, email suggestions and a Chrome extension. The architecture is documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- [x] Application search/filter/sort, bulk edits, notes, status history, saved descriptions and linked documents.
- [x] Master CV, resume import/selection, AI suggestions/rewrites, cover letters and PDF export.
- [x] Extension tracking for LinkedIn Easy Apply, Greenhouse, Lever and Ashby; saved pay/workplace/employment details.
- [x] Email review queue and optional daily IMAP scans; locking, retries, hiring-cycle protections and transactional approval implemented locally.
- [x] Supabase migrations 009–012 applied and synthetic concurrency/isolation checks recorded.
- [x] Reliability review: fail-closed AI quotas, conflict/recovery UI, read-only newer documents, CI checks, public processing disclosure and cron backlog visibility. [Evidence and retained tradeoffs](docs/review-follow-up-2026-10-29.md).
- [x] A5: owned answer library, explicit approval, fresh copy checks, revision safety, archive/restore/delete, history export and frozen answer binding. Migrations016–017 applied. [Verification and limits](docs/approved-answers-verification.md).
- [x] A4: preserved PDF bytes, frozen job descriptions/known answers, explicit source labels, corrections and a submission archive; migration 015 applied. [Verification and limits](docs/submission-packages-verification.md).
- [x] A3: custom resume/Master CV sections, heading names, certifications and revision-protected saves; visible custom content exported and scanned. Migration 014 applied.
- [x] A2: saved jobs workspace, corrected extension capture and intended resume selection; saving stays separate from applications. Migration 013 applied.
- [x] RB-01: posting identity, account-bound retry receipts and explicit matching for ambiguous email/extension events. [Verification and limits](docs/application-identity-verification.md).
- [x] Real-PDF overflow checks, honest page-fit feedback and quiet editor saving implemented locally.
- [x] Local/default model updated to GPT-6 Luna; task overrides remain available.
- [x] Job-seeker/competitor research and this delivery roadmap prepared.

Checked items describe existence of the recorded work, **not a claim that every local source change is deployed**. RB-01 verification: 152 tests, clean lint, an isolated production build, 32 disposable PostgreSQL assertions, live RPC concurrency/isolation and desktop/mobile browser checks. CSV currently exports loaded rows, not a complete account backup. The wider scoring, guided onboarding and remaining extension work are planned; flexible sections and saved-job capture are implemented.

## Phase A — Streamline applications without new AI

“Non-AI first” means no new model-based features, prompts, persona calls or scoring engines in Phase A. Existing AI features may continue working. Fixing deterministic matching around the existing email classifier does not require changing that classifier. Work packages are split so an AI dependency cannot block a useful non-AI improvement.

| Order | Deliverable | Existing work-package scope | Completion example |
| --- | --- | --- | --- |
| A0 | Verify the current baseline | RB-00 baseline only | Existing app/editor/extension flows still work; unrelated edits preserved |
| A1 | Keep different openings separate and make retries safe | RB-01 | Same company/title, different posting IDs stays separate; uncertain matches can be resolved |
| A2 | Save jobs before applying from the extension | RB-07A capture only | Save JD/link/pay, choose a working resume, see saved vs applied; capture never marks applied |
| A3 | Make Master CV and resume editing flexible | RB-04A editor/storage/export | Custom sections and certifications survive save/refresh/PDF; current layout remains available |
| A4 | Preserve the actual submission package | RB-02 | Later resume edits leave the submitted PDF/JD/known answers intact |
| A5 | Reuse manually approved answers | RB-09A library only | Copy your saved project story, availability or other answer; no AI generation |
| A6 | Add reviewed deterministic autofill, one site at a time | RB-10A | Fill known facts, preserve corrections, select the right file; Workday follows simpler platforms |
| A7 | Improve tracking and next actions | RB-11A | Contacts, interview rounds, assessment deadlines, follow-ups and reminders in one place |
| A8 | Make email integration and reconciliation easier | RB-08A/B transport and rule-based matching | Clear source evidence, unresolved linking, backlog progress; Gmail connection with existing classification unchanged |
| A9 | Fix rule-based document checks and PDF readability | RB-03 plus deterministic PDF checks | Blank/hidden content cannot inflate checks; show what exported text actually contains |
| A10 | Make records portable and progress understandable | RB-12A/RB-14A | Complete export and descriptive counts/rates, without AI advice or hiring predictions |

A1–A5 are implemented and verified locally; A6 reviewed deterministic autofill is next. A5 evidence: [approved answer verification](docs/approved-answers-verification.md). Migrations016–017 are installed; hosted integration state is recorded separately. A4 evidence: [submission package verification](docs/submission-packages-verification.md). Migration 015 is installed; hosted integration state is recorded separately. A3 evidence: [flexible document verification](docs/flexible-documents-verification.md). Migration 014 is installed. A2 evidence and limits: [saved jobs verification](docs/saved-jobs-verification.md). Migration 013 is installed; extension 0.3.0 requires an unpacked reload. Other items get bounded plans when reached. A3's existing AI compatibility is maintained through adapters, but new custom-section AI selection belongs in Phase B. A2 selects a working resume before applying; A4 preserves exact file bytes and user-reported submission details without claiming employer receipt. External Gmail setup waits do not block A9/A10. Optional small fixes can move earlier when they unblock daily use; record the reason here.

## Phase B — Analyze before applying, then improve the application

| Order | Deliverable | Scope | Completion example |
| --- | --- | --- | --- |
| B1 | Evidence-based job analysis and job-post fit meter | RB-06A + RB-07B | Compare Master CV vs selected resume, show requirements/evidence/gaps and your constraints; same result in app and extension |
| B2 | Optional multi-perspective resume review | New RB-15 | ATS/document checks, recruiter, hiring manager and staff engineer; optional CEO, rival and bar-raiser lenses |
| B3 | Job-specific tailoring from verified facts | RB-06B + RB-04B/RB-07C | Review a diff, choose relevant sections/bullets, answer missing-fact questions, re-check the exported document |
| B4 | Contextual application-answer and follow-up drafts | RB-09B + optional RB-08C | Draft from approved facts/stories; review and send/submit yourself |
| B5 | Interview preparation from the submitted package | RB-11B | Technical topics, credible stories and questions tied to this exact JD/resume |
| B6 | Evaluate whether the analysis helps your search | RB-12B | Compare reviews with labeled examples and observed application outcomes; expose counts/uncertainty, not promises |

The intended sequence is **scan the job before applying → decide whether it is worth your time → review/tailor → verify → apply → track**. A score is decision support, not the probability of an interview. Persona agreement is not independent hiring evidence.

References and proposed panel behavior are in [Career Ops and local persona review notes](docs/research/2026-10-28-career-ops-and-persona-review.md). The existing rules-plus-grounded-AI direction remains; seven free-form scores will not replace the shared rubric.

## Later — Only when useful

Guided first-login onboarding for other users (RB-05), target-company alerts (RB-13), broader career/mobile polish, public launch, Chrome Web Store distribution, CAPTCHA and commercial billing are retained as later work. Basic ownership, privacy and data integrity apply from the start. Public rollout work does not lead the personal-use queue.

Statuses: RB-01 / A1, RB-07A / A2, RB-04A / A3, RB-02 / A4 and RB-09A / A5 are verified locally; other Phase A/B product work is **planned** unless specifically recorded as verified in the baseline above. A prepared design is not an implemented feature. Stable RB identifiers are retained for cross-references; the A/B tables above supersede their former numeric execution order.

## Completed first milestone: RB-01

[Design and exact behavior](docs/superpowers/specs/2026-10-28-application-identity-design.md) · [Five-task implementation plan](docs/superpowers/plans/2026-10-28-application-identity.md).

- [x] 1. Normalize posting identity and prove different openings remain separate.
- [x] 2. Make ambiguous email/pending matches explicit instead of selecting a same-title row.
- [x] 3. Add atomic ingestion receipts, safe approval and explicit resolution through a new migration.
- [x] 4. Preserve stable event IDs and account-bound extension queues across retries.
- [x] 5. Add minimal match recovery, run synthetic browser/SQL checks and record review evidence.

**Acceptance:** same company/title with different posting IDs stays separate; retries do not duplicate or revive deleted applications; ambiguous emails require a decision; concurrent writes and account changes remain safe. Next is A2 extension capture/save-for-later; exact submitted PDF preservation follows in A4 (RB-02).

## Deferred public-release checklist

- [ ] Verify and integrate the separate Next.js 16.4 / React 19 upgrade after signed-in checks and the known calendar regression are resolved; do not combine it with a feature milestone.
- [ ] Add monitoring and useful error boundaries with private-data redaction.
- [ ] Wire CAPTCHA tokens through login/signup/recovery before enabling Supabase protection; verify all flows.
- [ ] Review current Google consent/scopes/verification requirements before releasing Gmail access.
- [ ] Apply each new migration in order, record its result, then verify the deployed app/extension compatibility. Do not edit already applied migrations.
- [ ] Publish the extension only after supported-platform, account-isolation and disclosure checks.
- [ ] Verify actual production configuration and model overrides; local defaults do not establish hosted settings.

Proposed feature name: **Application Updates**, retaining the current `/email-sync` route until deliberately changed. The existing local Inbox copy is not treated as a completed naming migration.

## Working rules

Complete Phase A before beginning new AI features unless the user changes that priority. Implement and verify one bounded task at a time. Before each milestone, refresh its detailed plan against the current source. Keep synthetic tests separate from real job applications and private inboxes. Review material findings before marking complete. Record local code, applied database migrations and deployed behavior separately. Keep commits/pushes/deployments within the user's authorized integration scope.

## Later decisions

Commercial billing/trial/refund implementation is conditional on a commercialization request; transparent value and data access are already covered by RB-14. Unattended mass apply, a broad job marketplace, a generic chatbot, a coding-practice platform and claims of detecting employer intent remain deferred.

The [original 2024 roadmap](docs/archive/roadmap-2024.md) is preserved as historical context. Its proposals and unchecked boxes are not the current status or delivery order.
