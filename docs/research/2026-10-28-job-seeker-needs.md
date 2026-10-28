# What would make Resume Butler more useful in a job search?

Research date: **October 28, 2026**. This is qualitative product research and a proposed priority order, not an approved implementation specification. No product behavior was changed for this investigation.

## Recommendation

Build a dependable workflow around each opportunity: **assess the job → select and improve the right resume → review and apply → preserve the submission → reconcile replies → take the next action**.

For the current owner, who primarily targets CS/software jobs, this is a better initial investment than a broad job marketplace or unattended mass application agent. That is a product judgment based on the overlap between public feedback and this repository's existing capabilities, not proof of higher interview rates.

The proposed promise is: **Know which jobs fit, apply with accurate information, and always know what you sent and what to do next.**

## How to interpret the evidence

I searched public Reddit discussions, Simplify's first-party feedback board and help center, customer reviews on Trustpilot, and official competitor product/privacy documentation. I inspected the current checkout's tracking, extension, email matching, scoring, resume model, guardrails, and dashboard. The companion [competitor capabilities note](2026-10-28-competitor-capabilities.md) separates official offerings from user experiences.

This was a purposive sample, not a representative survey, a census of reviews, or a hands-on reliability test of paid competitor accounts. Some posts have only one or two votes. Vendor-hosted communities can be moderated; public review sites select for people willing to post. Threads also contain competitor advertising. I excluded promotional replies from evidence of demand and did not count repeated complaints by one person as independent reports.

Older feature requests demonstrate a need at the time, not a currently missing competitor feature. In particular, Simplify now documents Gmail integration even where its feedback board still displays an older request as in progress. No claims about ATS rejection, spam detection, fabricated job listings, or interview lift are accepted merely because a commenter makes them. Relative timestamps differ between indexed results and opened pages; the observation date above is the research anchor.

## What users are asking for

### 1. Save time without creating another checking job

Simplify users praise the time saved by autofill, while others describe incorrect education, work experience, contact details, and awkward multi-step forms. These are compatible observations: useful automation can still be unreliable on particular forms. [Long-running user discussion](https://www.reddit.com/r/csMajors/comments/14flfp9/is_simplify_legit/), [founder AMA with specific user reports](https://www.reddit.com/r/simplify/comments/1hvbnri/im_michael_founder_ceo_of_simplify_ask_me_anything/).

**Opportunity:** start with reliable contact/history filling and a reusable answer library. Show what was filled and what needs attention, preserve manual corrections, and provide copy buttons when a form cannot be handled. Prove net time saved including corrections. Workday merits its own compatibility effort rather than an assumption that a generic filler will work everywhere.

### 2. Use the resume I chose, and remember exactly what I submitted

A Simplify user reports the extension repeatedly uploading an older resume despite selecting a different version. A separate first-party bug report says the default document was used instead of the optimized one. These are reports, not independently reproduced defects. [User report](https://www.reddit.com/r/simplify/comments/1xcpgfu/attaching_wrong_resume_to_all_applications/), [Simplify feedback](https://simplifyjobs.featurebase.app/p/optimized-resume-does-not-auto-fill-for-created-job).

Applicants also describe keeping company folders, copies of job descriptions, and per-company CVs to reconstruct an application when an interview arrives. [Workflow discussion](https://www.reddit.com/r/jobsearchhacks/comments/1wpv1h8/applied_forgot_got_an_email_panicked/), [tracker feature request](https://simplifyjobs.featurebase.app/p/job-tracker-4).

**Opportunity:** distinguish an editable working resume from a frozen submitted version. Preserve the document, original job description, submission date/source, chosen answers, and confirmation evidence per application. Show the selected document's name and preview before upload; never silently replace it after a manual correction.

### 3. Explain whether a job fits my background and whether this resume demonstrates it

A recent Jobright feature request asks for matching across several resumes rather than only a primary resume; a support response acknowledges the primary-resume/profile behavior. This directly supports explicit resume selection, though one thread does not establish market-wide demand. [Request and response](https://www.reddit.com/r/jobright/comments/1wz5gqp/job_fit_score_feature_request/).

A separate user describes a tailored resume receiving very different scores after re-upload. Another reports difficulty recognizing equivalent terminology. These motivate reproducibility and explanations; they do not establish the underlying competitor implementation. [Score-consistency report](https://www.reddit.com/r/jobright/comments/1u0uifw/ai_resume_customization_is_fraudulent_dont_bother/), [terminology complaint](https://www.reddit.com/r/CustomerSuccess/comments/1w3h71l/senior_csm_with_10_years_of_experience_47/).

**Opportunity:** separate **background fit** (Master CV and confirmed preferences) from **resume match** (only the selected document's visible content). Display requirement → supporting evidence → gap/uncertainty → proposed action. Version/cache reviews so the same inputs produce a stable saved result, and explain changes after edits. Do not label a score as an interview probability or an employer's actual ATS rank. Simplify itself documents that distinction. [Official scoring explanation](https://simplifyjobs.featurebase.app/help/articles/2175778-understand-resume-score-and-keyword-matching).

### 4. Improve my writing without inventing my career

One paying Jobright user reports an answer inventing team leadership and conference recognition, alongside resume-length problems. This is a specific severe anecdote, not a measured hallucination rate. [Original report](https://www.reddit.com/r/recruitinghell/comments/1pex53h/jobright_agent_sucks/).

**Opportunity:** trace proposed claims to Master CV entries or user-confirmed answers. Show edits as a diff and explain why a bullet was selected. Ask for missing facts or numbers; do not generate them. Store approved stories for reuse in resumes, application answers, and interview prep. A prompt saying “do not invent” is insufficient as a product guarantee.

### 5. Keep the tracker current and retain control of uncertain matches

Simplify's email feature request describes losing interview and rejection mail in a crowded inbox. Its current help article documents matched conversations and approved status suggestions, explicitly warning about several roles at one company. Email tracking is validated demand and existing competition, not an exclusive new idea. [Original request](https://help.simplify.jobs/p/email-integration-for-application-tracking), [current feature](https://help.simplify.jobs/help/articles/0236686-email-integration).

**Opportunity:** make status evidence, target application, ambiguity, sync freshness, and failures visible. Add a way to link an uncertain email to an existing application rather than only treating it as a new record. Corrections should improve subsequent thread matching. Preserve review for ambiguous or consequential changes. Consider optional automatic handling of narrowly proven events only after measuring false matches; never equate a model's extraction confidence with confidence in the selected application.

### 6. Help me avoid jobs that do not meet basic constraints

Users report mismatches between listings and employer career pages, as well as roles reappearing after dismissal. These reports do not prove listings are fake. [Original discussion](https://www.reddit.com/r/cscareeradvice/comments/1ponvy7/how_legit_is_jobright/).

**Opportunity:** keep employer URLs and posting IDs, expose last verification time, remember dismissals, and separate preferences/eligibility from keyword coverage. Location, remote restrictions, seniority, employment type, compensation, and user-confirmed work authorization can matter before wording changes. A listing still being reachable does not prove active hiring; an unavailable page does not prove the application was rejected.

### 7. Accommodate real backgrounds and reduce search stress

Simplify's public request board includes multiple resume profiles, recruiter details, separate certifications, eligibility filtering, flexible education data, custom answers, company alerts, and less discouraging status labels. Its visible vote counts are small, self-selected signals, not market share. [First-party requests](https://simplifyjobs.featurebase.app/).

**Opportunity:** finish flexible sections and certifications end to end; offer role-specific resume variants and contact/reminder fields. Display “No response in 21 days” as an aging indicator rather than inventing a rejection or verified ghosting event. Keep progress feedback useful and avoid implying the user's effort guarantees a job.

### 8. Make paid value and data access understandable

Recent Simplify Trustpilot reviewers complain about perceived paid value, refunds, and subscription handling. These are customer accounts, not an adjudication of billing disputes. [Customer reviews](https://www.trustpilot.com/review/simplify.jobs).

**Opportunity:** if commercialized, let people experience core value before payment, show limits/costs before AI actions, and keep export/disconnect/delete straightforward. For a personal tool, integration transparency and data portability still matter. The companion note contains the official policy comparison; no competitor job-seeker pricing is inferred from an employer pricing page.

## What Resume Butler actually has today

Verified against the uncommitted main checkout, not the separately running framework-upgrade preview. Existence in source does not mean a feature has been deployed.

| Area | Present | Important missing piece |
| --- | --- | --- |
| Applications | Search/filter/sort, statuses, bulk edits, duplicate, notes, history, editable saved JD, linked documents, pay/workplace/job type | Explicit opportunity identity, submission snapshots, structured contacts/interview rounds/deadlines, next action |
| Export | CSV download | Current handler exports loaded page rows; do not mistake this for a complete account backup |
| Dashboard | Goals, recent applications, status flow, response-time calculations, 14-day waiting follow-ups | User-scheduled reminders, actionable daily queue, source/resume cohort comparisons |
| Extension | LinkedIn, Greenhouse, Lever, Ashby readers/detection; queue/retry; manual record and undo | Job scoring, resume selection/tailoring, answer bank/autofill, Workday; popup wording also omits LinkedIn |
| Email | IMAP/app-password connection, manual/daily scans, AI extraction, approval suggestions, recent locking/atomic-approval hardening | Gmail OAuth, thread/requisition-based matching, manual target correction, clear unresolved queue/backlog progress |
| Resume AI | Import, selection from CV, bullet suggestions/rewrites, cover letters, technical/fact-preservation heuristics | Claim provenance and broad validation, guided missing-fact capture, submitted-version continuity |
| Resume editor | Rename/reorder/hide four built-in sections; PDF export; recent real-PDF page check and quiet saving | Arbitrary typed sections, certifications in the resume pipeline, version history |
| Job feedback | Deterministic keyword/section/quality heuristic | Evidence-based requirements, visibility consistency, blank-score correction, eligibility, actual exported-text validation |
| Setup | Profile/Master CV and resume import | Guided, resumable first-login setup that explains why detailed accurate source data helps |

Code anchors: `src/features/applications/data.js`, `ApplicationTable.jsx`, `actions.js`; `src/features/dashboard/data.js`; `extension/content/sites.js`, `extension/popup/popup.html`; `src/server/extension/applications.js`; `src/server/email/matching.js`; `src/server/ats/score.js`; `src/server/resume/guardrails.js`; `src/features/resumes/resumeDocument.js`. Earlier concrete scoring findings are in [the ATS review](../ats-resume-onboarding-review.md).

Important identity gap: the extension extracts platform job IDs locally, but its record API payload does not persist a dedicated posting/requisition ID. Its duplicate fallback can combine recent applications with the same company and title even if their nonempty URLs differ. Email matching uses company/role/dates, not thread or requisition identity. Therefore, multiple openings with identical titles remain a risk despite the recent different-role matching fixes.

## Proposed order for this project

These are relative priorities and scope judgments, not delivery estimates or approved engineering tickets.

| Order | Deliverable | Why now | Evidence strength / effort |
| --- | --- | --- | --- |
| 1 | **Application identity and submission record**: platform+posting ID, requisition/thread evidence, distinct openings, frozen submitted document/JD, reversible corrections | Everything else relies on attaching information to the right opportunity | Repeated record/version pain + direct code gap / medium–large |
| 2 | **Trustworthy fit review shared with extension**: Master CV vs selected resume, evidence, hard constraints, reproducible review, quick truthful improvements | Helps choose where to spend effort and matches the owner's request | Multiple feedback themes + direct request / large |
| 3 | **Reliable Application Updates**: Gmail connection path, unresolved linking, source evidence, freshness/errors, measured matching, manual alternatives | Removes tracker maintenance and strengthens existing investment | Direct feature demand; competitor parity exists / large |
| 4 | **Answer library and reviewed autofill**: reusable user-approved facts/stories, copy fallback, field review, correct resume binding | Repetition is a strongly supported pain; scoped filling limits maintenance | Repeated praise and complaints / medium for library, large for broad autofill |
| 5 | **Next actions and interview workspace**: due dates, named contacts, rounds, reminders, original JD/submitted resume, contextual prep | Makes the tracker useful after submission | Contact/context demand; prep package is a hypothesis / medium |
| 6 | **Outcome feedback**: screening/interview rates by source, role family, resume version, date cohort | Shows where the user's time is going | Plausible extension of tracking; needs validation / medium |
| Later | Target-company watchlist and freshness checks; broader platforms/mobile/career coverage | Useful discovery without immediately building a huge index | Explicit company-alert demand; larger operational burden |

Run guided Master CV setup and flexible sections alongside the resume work, rather than launching a long mandatory questionnaire first. Keep the current software starter; let users add certifications, research, volunteering, publications, or other sections as needed.

The earlier [resume/extension/setup design](../superpowers/specs/2026-10-28-resume-quality-and-setup-design.md) already covers much of item 2 and the editor/setup work. This research reinforces parts of that proposal; it neither approves it nor supersedes its technical decisions. Item 1 deserves an explicit design because merely adding more AI to ambiguous application records magnifies mistakes.

## Concrete proposed experience

On a supported posting, open Resume Butler and choose **Master CV**, **Backend resume**, or **Full-stack resume**. See requirements with evidence and constraints, not only a percentage. If relevant evidence exists in the Master CV but is absent from the chosen resume, offer a reviewed addition. If it exists nowhere, ask rather than invent.

Save the opportunity before applying. Fill known fields or copy approved answers. Verify the selected document and form. On a confirmed submission, preserve a frozen record. A later email proposes an update with the exact evidence and chosen application; an ambiguous message asks the user to link it. An interview then opens the original JD, submitted document, contacts, preparation notes, and due tasks.

This is a proposed workflow, not a claim about the current extension's functionality.

## Features to postpone

- A general chatbot tab without application context: overlaps existing AI tools without solving the handoffs.
- Unattended bulk submissions: expands the reliability surface before identity, truthful answers, and document selection are dependable.
- A giant scraped job index or a “ghost job detector”: costly and cannot establish employer intent from page availability.
- More opaque scores, decorative dashboards, or automatic rejection labels after a timeout.
- A coding-interview practice platform: first offer contextual prep and links; do not recreate a separate learning product.
- Aggressive keyword insertion or fabricated metrics to improve a score.

These are sequencing decisions for a personal CS-first app, not claims that nobody wants those products.

## Validate before expanding

Recruit a small discovery group (for example 5–8 people, a proposed practical starting point) spanning CS new grads and experienced software applicants. Observe actual workflows and compare against their existing tools. A small group identifies problems; it does not estimate population prevalence.

Ask people to show the last time they used the wrong resume, lost the original JD, corrected autofill, missed a reply, or stopped maintaining a tracker. Ask what they do today and how long recovery takes. Avoid only asking whether a hypothetical feature sounds useful.

Use synthetic fixtures for correctness: same company/different roles; same title/different requisitions; old/new hiring cycles; forwarded mail; unrelated recruiter outreach; duplicate confirmation; late rejection after offer; failed scan/retry; selecting one resume then correcting it manually; edits after submission; hidden sections; missing mandatory evidence; model-generated unsupported numbers and claims.

Measure total application time **including corrections**, wrong-document incidents, false merges and duplicates, incorrect approved status changes, unresolved emails, time to recover the submitted package, and whether reminders lead to completed actions. Record sync coverage and review latency separately from extraction accuracy. Only add automatic updates once error costs and correction behavior are understood.

For hiring outcomes, show interview/screen counts with application counts, date cohorts, and observation windows. Small nonrandom samples cannot establish that a resume version, score, or tool caused more interviews. Do not optimize only applications/day or turn preliminary correlations into advice.

## Decision

My recommendation is to make **the application record the center of the product**, deliver the shared fit review through the extension, and deepen email/answer assistance around it. This preserves Resume Butler's existing investment while addressing the most concrete reliability and repetition problems found in the source material.
