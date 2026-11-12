# Resume Butler: product direction and current-state audit

October 30, 2026. Research and recommendation, not an approved implementation specification or a replacement for ROADMAP.md.

## Recommended purpose

**Help a CS job seeker prepare an accurate application, preserve exactly what they sent, and manage every next step until the opportunity ends.**

The product should answer five questions: Is this opportunity worth pursuing? What should I send? What did I actually send? Where does it stand? What do I need to do next?

The strongest direction is one connected application workspace. Resume building, tailoring, capture, answers, inbox updates, deadlines and preparation support that workspace. A collection of independently useful tools is not yet the same experience.

Start with individual CS/software candidates. Early-career applicants are a plausible first pilot group because projects and assessments fit the existing model, but that narrower audience has not been chosen by the owner. Validate the workflow with one experience band before trying to serve every profession and seniority.

## Evidence and limits

Reviewed the current checkout's roadmap, architecture, verification notes, database migrations, application and saved-job UI, resume selection/generation, rewrite guardrails, scoring, submission capture, dashboard follow-ups, export wiring and privacy disclosure. Read the October 28 research as historical context and checked current source rather than carrying its old missing-feature list forward.

Fresh web research included firsthand Reddit threads in r/cscareerquestions, r/jobsearch, r/recruitinghell, r/simplify and r/csMajors; current official Teal, Huntr and Simplify pages; and Greenhouse's Talent Matching FAQ. See linked evidence below. This is a purposive qualitative sample, not a representative survey. Promotional replies are not independent demand evidence. Reports of competitor bugs are anecdotes, not reproduced defects. Search and page-relative dates conflict in places, so relative timestamps are not used to date those incidents.

No GitNexus repository index was registered. Analysis used current source through Serena and targeted repository searches. Memory recall returned no relevant entries.

All **237 existing tests passed** in this session. The available shell ran **Node 26.3.0**, while the repository specifies Node 24.x: this is not a supported-runtime certification. A synthetic call to the real scorer independently reproduced the empty-resume result below. No production, private inbox or employer form was exercised. Existing verification documents contain earlier integration evidence; their existence does not establish today's hosted configuration or deployment state.

## What has actually been accomplished

| Capability | Current source supports | Remaining boundary |
| --- | --- | --- |
| Career facts | Master CV, PDF/text import, experience/projects/education/skills/certifications and custom sections; improved import matching | Guided first-use verification and reusable claim provenance are incomplete |
| Resume preparation | Visual editor, section controls, save conflict recovery, PDF export and real compilation page-count checks | Page count is not a full extracted-PDF readability check; source facts and document wording need clearer lineage |
| Job-specific customization | AI selects stored CV entries and skills, previews selections/reasons, and offers bullet rewrites; cover-letter drafting also exists | Selection remains centered on the four original section types; broad custom-section selection and evidence-based requirement review are unfinished |
| Save before applying | Saved jobs, captured descriptions/details, working-resume choice, owned reads and posting identity | Saved-job context does not flow directly into the editor's job picker |
| Applications | Filtered/paginated table, editable records/JDs, status history, linked documents and notes | Detailed recruiting steps and next actions are unstructured |
| Submission memory | Preserved PDF artifacts, JD/application snapshots, selected/unknown source distinctions, corrections and frozen approved-answer references | User-selected resume intent is not proof of employer upload; frozen cover-letter/file attachments beyond the resume workflow are not a general package system |
| Reusable answers | Owned library, drafts/approval, revisions, export and archive/delete controls | Contextual AI drafts are future work, and reuse requires suitability for the current question |
| Extension | Capture/tracking readers for LinkedIn, Greenhouse, Lever and Ashby; account-bound retry queue; keyword comparison | Reviewed autofill is currently English Lever contact/plain-text-answer filling; file upload, broad history fields, dropdowns and Workday remain manual |
| Email updates | IMAP connection, manual/daily scanning, classification, review suggestions, explicit uncertain matching and retry protections | Gmail OAuth, easier setup and operational visibility remain unfinished; Google sign-in is not mailbox access |
| Dashboard | Goals, counts, journey chart and waiting follow-ups | No structured daily task/reminder/interview workspace; charts summarize records rather than manage the work |
| Reliability foundation | Ownership checks/RLS, revision protection, retry identity, tests, CI and public processing disclosure | Requires separate verification of deployed migrations, configuration and commercial readiness |

This is a substantial personal-use foundation. It is not a reason to restart or replace the stack.

## The most important gaps, grounded in code

### 1. The preparation and tracking halves are not fully connected

`src/features/opportunities/SavedJobs.jsx` links a saved job to its chosen resume. But `getJobOptions` in `src/features/resumes/data.js` queries `applications`, not `job_opportunities`. The studio can accept a pasted JD, so pre-application tailoring is possible, but saving a job does not give the editor a first-class target automatically.

Recommended experience: open saved opportunity → review requirements → create/select a resume variant with that JD already attached → prepare → apply → retain the same opportunity context. Avoid making an application record merely to obtain pre-application tools. Keep separate storage where useful; the user should experience continuity.

### 2. A status is too coarse to manage a CS hiring process

The status set and history support broad progress, but there is no structured contact, interview-round, assessment-deadline, task or offer-detail model in the inspected migrations. `ApplicationEditor.jsx` invites interview prep, contacts and follow-ups in a notes field. Dashboard `followUps` identifies old unchanged Applied records; it is not a scheduled reminder system. The October 30 journey chart accurately summarizes entry/interview/current outcome, but does not add these missing workflows.

Keep a simple overall status, and add activities beneath it: recruiter screen, coding assessment, take-home, technical round, system design, behavioral round, final round, offer deadline. Allow repeated rounds, cancellations, rescheduling, withdrawal and rejection at any point. Each activity needs a date/time zone where relevant, state, notes, related people/links and a next action. Do not make a rigid linear funnel a requirement for recording reality.

### 3. Resume feedback is not yet trustworthy enough to be the main paid promise

The real `scoreResume` in `src/server/ats/score.js` returned **30 overall, 100 quality, 0 section and 0 keyword** for an empty object against a synthetic Python/SQL engineering JD. The quality component defaults to 100 for an empty quality-check set. This confirms an unresolved scoring issue from the older review.

Some old findings have been fixed: current scoring applies `visibleResumeContent`, and `resumeToText` includes certifications/custom content. Do not repeat the October 28 hidden-section and omitted-custom-content findings as if unchanged. The extension separately rejects empty source content and shows keyword coverage rather than the composite score.

Replace a single reassuring number with distinct feedback: document readability, requirement evidence, and writing clarity. Show required/preferred/alternative requirements, supporting facts, missing evidence and items needing confirmation. Separate background fit from what this specific resume demonstrates. A keyword occurrence does not establish years of experience or proficiency.

There is no defensible universal passing threshold in this product. Simplify explicitly describes its own feedback as neither an employer's score nor an interview prediction; Greenhouse describes Talent Matching as assistive and says it does not auto-advance or auto-reject. [Simplify explanation](https://help.simplify.jobs/help/articles/2175778-understand-resume-score-and-keyword-matching), [Greenhouse FAQ](https://support.greenhouse.io/hc/en-us/articles/41131886674075-Talent-Matching-FAQ).

### 4. Tailoring exists, but factual control needs to be deeper

`tailorResume` selects owned experience/project/education IDs and skills. This is a useful foundation. It does not currently return certification/custom-section selections. `generateResume` starts with those selections and a JD target; it does not implement a complete sourced application plan.

`checkRewrite` rejects recognized technology additions and some dropped content. This is a heuristic, not proof that every new claim, number, scope or achievement is grounded. Preserve the current protections, then add explicit source references and reviewable edits. Ask the person for a missing result instead of inventing one. Existing saved material should remain available across variants without silently rewriting other applications.

### 5. Portability and commercial readiness remain incomplete

`ApplicationTable.jsx` sends its loaded `applications` prop to CSV generation: the existing download is not an all-account backup. The public privacy page correctly discloses missing full self-service account export/deletion and individual frozen-record removal. It also discloses external AI/PDF processing. These are known product limits, not absent disclosures.

Before charging, verify full export, usable deletion/disconnection, recoverable failures, production configuration, extension installation/distribution, onboarding, monitoring and billing/cancellation. Gmail OAuth and third-party processing arrangements need their own concrete readiness work. Do not infer launch readiness from local tests or historical migration notes.

## What people are struggling with

| Firsthand problem | Evidence | Product implication |
| --- | --- | --- |
| Losing track of applications and their context | CS applicants discuss spreadsheets, document links, saved job information and applying/forgetting. [CS tracking discussion](https://www.reddit.com/r/cscareerquestions/comments/1aomsot/how_do_you_keep_track_of_your_job_applications/) | Beat the spreadsheet by reducing upkeep and joining documents, events and next actions; basic rows/statuses alone are weak differentiation |
| Tailoring fatigue and unclear payoff | An applicant describes 20–30 minutes of small changes per application without knowing whether it helps. Replies include vendors, so their claims were excluded. [Original post](https://www.reddit.com/r/jobsearch/comments/1sukc8a/how_much_resume_tailoring_is_actually_enough/) | Offer a reusable role-family base and a small list of meaningful job-specific edits; allow a clear stopping point |
| Re-entering the resume into forms | Applicants complain about repeated Workday entry and parser corrections. [Workday discussion](https://www.reddit.com/r/recruitinghell/comments/1t42qr8/workday_job_applications_are_the_worstest_of_the/) | Measure filling plus correction time; expand reliable adapters progressively rather than promising universal form completion |
| Wrong resume attached despite the user's choice | One Simplify user reports stale-file attachment and replacement of a manual correction. This was not reproduced. [Original report](https://www.reddit.com/r/simplify/comments/1xcpgfu/attaching_wrong_resume_to_all_applications/) | Make intended file/version explicit, preserve corrections, and distinguish intent from actual submission evidence |
| AI fabricates accomplishments | A paying Jobright user reports invented leadership and conference recognition in an answer. This is one account, not a measured rate. [Original report](https://www.reddit.com/r/recruitinghell/comments/1pex53h/jobright_agent_sucks/) | Ground edits in confirmed facts; approval must show the exact proposed claims |
| Assessment deadlines and process uncertainty | A CS fellowship discussion includes a missed CodeSignal deadline and questions about subsequent rounds. [CS discussion](https://www.reddit.com/r/csMajors/comments/1naunbc/anthropic_fellow_hiring_process/) | Put assessment due dates, round details and reminders beside the application; this supports workflow value, not a claim about prevalence |

These sources support problems to investigate. They do not prove willingness to pay, competitor failure rates, the cause of rejection, or that tailoring increases interviews. Silence is an observed lack of response; do not automatically call it rejection or claim to know the employer's intent.

## Keep the scope coherent

**Core:** verified career facts; opportunity capture and basic constraints; job-specific documents and answers; review and supported autofill; submission preservation; update reconciliation; contacts, rounds, tasks and deadlines; contextual preparation; outcomes and export.

**Useful later:** calendar integration, offer details/comparison, more ATS adapters, reminders through additional channels, and descriptive source/resume outcome comparisons. Start offer handling with a place to record terms and a decision deadline, rather than a compensation-advice product.

**Defer:** building a broad job marketplace, unattended mass apply, a LeetCode replacement, a generic chatbot, a social network, native mobile apps before the web workflow works, and elaborate multi-persona review by default. Link to external practice resources while keeping preparation notes with the application.

The existing flexible document model is useful infrastructure; it need not be removed because the initial audience is CS. Cover letters remain an optional document within an application. Existing charts remain useful summaries, but further chart polish is lower priority than preventing a missed assessment. Framework upgrades are maintenance work, not product strategy.

## What one-stop should feel like

Career facts → save opportunity → check constraints/evidence → select or tailor documents → review/apply → preserve submission → manage replies/activities → prepare from that exact package → record outcome.

Suggested navigation: **Today**, **Opportunities**, **Career profile**, **Documents**, **Settings**. Saved and applied jobs can be different views within Opportunities. Inbox suggestions can be surfaced where they need action, while integration setup stays in Settings. This is a proposed information architecture, not a request to rename routes immediately.

Every opportunity should make its current state, intended/submitted documents, relevant correspondence and next action easy to find. Today's view should show actual dated work: an OA due tomorrow, tomorrow's interview, a follow-up the user chose, an uncertain inbox update, or an unfinished application. Avoid equating productivity with application volume alone.

## Suggested delivery order

| Order | Bounded outcome | How to know it works |
| --- | --- | --- |
| 1 | Connect saved opportunities to preparation | Save a posting, create/select a variant with its context, return to the same opportunity and apply without re-entering the JD or creating a premature application |
| 2 | Finish tracking and next actions (existing A7) | Add recruiter, assessment, interview round, deadline and next task; see dated work in Today; edit/reschedule/complete it |
| 3 | Repair deterministic feedback (existing A9) | Empty content cannot receive positive quality credit; hidden content is excluded; checks distinguish structured content from actual exported-PDF validation |
| 4 | Add evidence-based review and complete tailoring | Each proposed change cites a confirmed source; requirements/gaps are explained; certifications/custom items can participate; edits are reviewed before use |
| 5 | Pilot the complete workflow with a small CS cohort | Observe real searches from save through follow-up/interview and identify corrections, repeated data entry and abandonment |
| 6 | Prepare a paid beta | Demonstrate value, full data access, onboarding, operational reliability, workable installation and explicit billing/cancellation |

This mostly reinforces the existing Phase A then Phase B roadmap. The proposed adjustment is a small preparation-continuity milestone before/alongside A7. It does not silently authorize starting new Phase B AI work before the current Phase A policy allows it. No milestone is an implementation estimate.

## Business reality and a pricing hypothesis

An all-in-one feature list is already competitive territory. Teal documents unlimited free tracking and resume creation, with monthly Teal+ at **$29**. Huntr lists a free tier including tracking up to **100 jobs**, and monthly Pro at **$40**. Simplify advertises free autofill, application tracking and basic resume tools. These are vendor descriptions checked during this research, not independent quality tests. [Teal plan comparison](https://help.tealhq.com/en/articles/9530153-teal-vs-teal), [Huntr pricing](https://huntr.co/pricing), [Simplify Copilot](https://simplify.jobs/copilot).

The defensible promise to test is **less repeated work and fewer lost details across the whole application**, with grounded customization as part of that experience. Price alone will not establish it.

A **$5–10/month active-search plan** is an experiment consistent with the owner's small-fee idea, not a validated recommendation or promise of sustainable margins. Consider a free core with bounded paid AI/review features, straightforward cancellation/pause, and continued access/export after cancelling. Do not lock a person's historical application records behind continued payment. Job search is episodic; successful customers may leave after finding work. Whether they return, refer others, or keep a light career profile is an empirical business question.

Measure paid conversion and ongoing support/hosting/email/PDF/model cost before offering unlimited AI. Do not build billing ahead of proving that strangers can complete the workflow and prefer it to their existing free process.

## A practical definition of quality

Replace “perfect” with a small set of observable promises:

- An unrelated opening is never silently merged into another application.
- Changing today's resume cannot rewrite yesterday's preserved submission.
- Every suggested factual claim has a source or requires confirmation.
- A candidate can see, change and complete the next task with its correct deadline/time zone.
- Save/sync/export failures are visible and recoverable.
- Users can retrieve their full history and understand removal controls.
- Measured preparation/form time includes time spent correcting the tool.

Use fictional fixtures for integrity checks and opt-in pilot observation for workflow research. Track time to first useful application, preparation/correction time, repeated data entry, incorrectly linked updates, missed/user-corrected deadlines, and repeated use during an active search. Interview rates can be descriptive with cohort sizes and observation windows; they cannot establish that the product caused a hiring outcome.

For an initial research round, interview and observe roughly 5–10 active CS candidates using their current process. Ask them to reconstruct a recent application, find the exact resume, explain the next step, and describe the last correction or missed detail. Let their behavior determine which gaps are most costly. This is proposed research; no outreach was performed.

## Decision

Keep the foundation. Make the application journey continuous, finish its operational tracking, repair misleading feedback, and then deepen evidence-based tailoring. Sell saved effort and dependable context only after a small pilot demonstrates them.

The current roadmap and application code remain unchanged by this audit.

## Follow-up: comparison with the supplied DeepSeek assessment

The owner supplied a parallel assessment. Both recommend completing the application journey rather than restarting. DeepSeek gives greater emphasis to the handoff after submission, activity management, offer decisions and emotionally useful daily guidance. This audit gives greater emphasis to preparation continuity, scoring correctness, factual provenance and uncertainty about competitive advantage.

### Additions worth adopting

- **Manual application creation loses context.** Fresh inspection confirms that `createApplication` writes identity/status/document links, but not job description, pay or workplace details. The saved-opportunity linking trigger connects records; it does not transfer those fields or preserve a PDF. This is a more specific handoff gap than the original audit identified.
- **Spreadsheet import is an adoption feature.** The original audit addressed export but omitted CSV import. A preview/mapping/duplicate-review flow would let existing applicants bring their history rather than begin again. Its priority depends on the pilot audience.
- **The streak concern is concrete.** `GoalCard.jsx` does calculate streaks and render a flame icon for application-volume goals. Put due tasks first and consider making volume goals optional. Research supports testing this design choice, not claiming streaks harm every applicant.
- **Offer decisions deserve explicit closure.** Overall Offered status is not a structured offer record. Record terms, deadline and accepted/declined outcome early enough to complete the workflow. Detailed equity/vesting comparison can follow if the target cohort needs it.
- **Messages arrive through several channels.** Contacts should record channel and allow manual notes/links for LinkedIn, calls and referrals, without requiring integrations with every service.

### Claims to qualify or reject

- “AI suggestions can't invent facts” exceeds the heuristic guardrails' guarantee. No evidence establishes them as rare or a competitive moat.
- “Nobody's trackers do this well” is unverified. Teal currently documents interview date/type/round/interviewer tracking, notes and offer analysis. That establishes competing functionality, not its quality. [Official Teal guide](https://help.tealhq.com/en/articles/14435728-how-to-prepare-for-interviews-using-teal).
- “Multi-tenancy is already safe” is not established by RLS/server auth alone. Those are useful controls; public-readiness verification remains necessary.
- “Tracking barely exists” overlooks existing status/history, inbox reconciliation and journey reporting. The missing part is structured activity management. “No offers” should similarly mean no offer-detail/decision workflow, not no Offered status.
- “Records are over-built” is a prioritization judgment, not a demonstrated defect. Exact submitted-document preservation supports the owner's per-job customization goal. Freeze further archive expansion while completing activities, rather than removing the integrity work.
- A single “I applied” action must distinguish intended resume, preserved PDF and actual submission evidence. It cannot silently claim that the selected working resume was uploaded. Do not automatically close an opportunity that still needs follow-up, and make reminder dates editable rather than universal hiring rules.
- The supplied response provides source labels but no usable research URLs. Its application-volume statistics, five-loop threshold, lost-compensation anecdote, form-abandonment cutoff, market-wide superlatives and price anchors cannot be audited from that text alone. They are hypotheses or reported anecdotes pending original evidence.
- Current file discovery found no QA/fixture route under `src/app`; empty duplicate directories and the unrelated untracked chart copy exist, but are not established product defects. Unused-schema cleanup needs dependency/data checks and should not drive product priorities.

**Revised recommendation:** complete the saved/prepared/submitted handoff with correct context transfer and explicit submission evidence; make Today useful through tasks, contacts and recruiting activities; correct misleading feedback; add basic offer closure, import/export and onboarding around pilot needs; then validate paid value. These are bounded outcomes, not a new unapproved implementation plan.
