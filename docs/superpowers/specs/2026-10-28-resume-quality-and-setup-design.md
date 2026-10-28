# CS-first resume review, flexible sections and first-login setup

Status: expanded proposed design, awaiting user approval. October 28, 2026. The separately requested page-fit correction is implemented and verified; the broader review/section/setup/extension features remain design work.

**Personal-workflow revision, October 28:** The user now prioritizes non-AI application efficiency before new AI work and is not preparing a public release yet. The Phase A/B sequence in [ROADMAP.md](../../../ROADMAP.md) and the [updated program plan](../plans/2026-10-28-job-search-improvements.md) supersedes this document's original delivery sequence. Flexible manual sections/export and extension capture/resume selection can ship before deeper analysis. Guided first-login onboarding is deferred for later users. Optional persona review inspired by the user's local panel and Career Ops is scoped as RB-15; see [reference notes](../../research/2026-10-28-career-ops-and-persona-review.md). The technical material below remains a proposal, not a claim that these larger features are implemented.

## Intent and decisions

The app is primarily for the owner, who targets computer-science/software roles. Make its feedback more demanding and useful for that workflow while removing unnecessary restrictions that prevent other professions from using it. Preserve the existing editor and starter layout.

The user selected a combination of deterministic checks and AI review, with CS as the primary domain. The following implementation details are proposals, not previously agreed requirements. Investigation and reproducible current defects are in [the review](../../ats-resume-onboarding-review.md).

Success means clearer evidence of fit and actionable gaps, not merely lower numbers or a claim to predict interview outcomes. The app evaluates the user's own resume; it does not rank other applicants or reproduce an employer's private ATS configuration.

## Approaches considered

1. **Expand deterministic checks only.** Fast and cheap, with good precision for known CS aliases. Weak at interpreting required/preferred language, alternatives, unfamiliar qualifications and evidence context.
2. **AI assigns a score directly.** Flexible, but a free-form model verdict is difficult to reproduce, explain and validate. Do not use this approach.
3. **CS-first rules plus grounded AI extraction/review — selected direction.** Rules handle rendering visibility, known aliases, dates, empty content and numeric aggregation. GPT-6 Luna extracts quoted job requirements and proposes links to existing resume evidence. Code validates those links and computes the score. Extra latency/cost occurs on deliberate deep review, not every edit.

## 1. Resume review

### User experience

Keep an immediate check while editing and add an explicit **Review against job** action for deeper analysis. Show three distinct areas:

- **Job fit:** required qualifications, responsibilities and preferred qualifications, each with evidence and gaps.
- **Document checks:** visible content, contact details, incomplete entries and an explicit exported-PDF readability check.
- **Writing feedback:** specificity, clarity, weak wording and opportunities to quantify real outcomes.

Retain an interpretable 0–100 job-fit number, labeled as this app's evidence-based assessment. Separate writing feedback from job-fit arithmetic: good verbs and a Projects heading cannot compensate for missing essential qualifications.

A requirement row shows the job-description quote, requirement type, status, the supporting resume quote/location, and one useful next action. Statuses are **supported**, **partially supported**, **not evidenced** and **needs confirmation**. "Not evidenced" describes the document, not an assertion that the person lacks the qualification. Never encourage adding an untrue skill or fabricated metric.

### Deterministic scoring and safeguards

- A blank resume scores 0. A job description with no meaningful extractable requirements receives **insufficient information**, not a fabricated numeric fit.
- Only visible/exported content counts, regardless of caller. Application detail, resume studio, API and PDF export share the same visibility traversal.
- Keep curated CS aliases, but require boundaries and coherent phrases. Distinguish Java/JavaScript, React/React Native, unrelated uses of "Go", and bare "C". Equivalent spellings may match; distinct technologies do not become substitutes merely because AI says they are similar.
- Preserve alternatives: "Java or Python" is one requirement group. Requirements explicitly marked preferred cannot become mandatory.
- Explicit self-stated years/dates may support experience claims. Merge overlapping dated intervals before totaling time. Employment duration alone does not establish years using every technology in that role; missing technology-specific duration is flagged for confirmation.
- A skills-list mention supports a claim of familiarity, but is weaker than evidence of relevant work/project use. Duplicating terms or hiding them in content never increases coverage.
- Projects are useful CS evidence but not a required section. Education, certifications and years are mandatory only when the job makes them mandatory; avoid universal credentials or GitHub requirements.
- Validate exact quote locations and stable source IDs from AI. A valid quote is necessary but not sufficient: it must support the requirement under the technology, context and duration rules above. Invalid or irrelevant evidence cannot count as satisfied requirements. Treat all job/resume text as data, including embedded instructions.
- The proposed initial rubric weights requirement groups **70% required / 20% responsibilities / 10% preferred**, renormalized only across groups actually extracted, with equal weight per distinct requirement inside each group. Evidence is valued at supported=1, partial=0.5, not-evidenced/confirmation=0. A skills-only mention cannot satisfy a requirement explicitly asking for demonstrated experience. An explicitly mandatory qualification without adequate evidence caps the displayed rating below "strong match" and remains visible as a critical gap.
- The numbers above are product choices, not an ATS standard. Validate them on labeled CS examples before finalizing numeric thresholds. If examples show misleading ranking, adjust before release and version the rubric.
- Eligibility questions not contained in the resume remain unknown. The app cannot infer work authorization, willingness to relocate or an employer's knockout answers from unrelated personal details.

### Model calls, caching and failure behavior

Use the existing `chatJSON` boundary and `gpt-6-luna` default. Add a task-scoped `OPENAI_REVIEW_MODEL` override so a later experiment need not change email or writing models. Strict schemas define extracted requirements and evidence links; validators enforce IDs, quotes, lengths and categories.

Cache normalized job requirements by description hash, extraction schema/prompt version and model within the authenticated user's context. Associate review results with job hash, visible-resume hash, model and rubric version. Invalidate them after meaningful edits. While edits are pending, display the previous review as outdated; never show it as a current score. Serialize/cancel client requests so stale responses cannot replace newer results.

On model failure, keep instant checks available and show that deeper review failed. Do not turn a provider error into a low job-fit score. Add route input limits, authenticated ownership, per-user rate limits, deadlines and user-safe errors consistent with other AI routes. Do not log resume text/provider response bodies.

The immediate local/server check remains cheap; deeper review runs only on user request and can reuse the same extracted job requirements. An exported-PDF check is separate and explicit because compilation/extraction costs more than checking structured content. It compares extracted text with expected visible content and reports missing content/reading-order concerns without claiming full vendor certification.

## 2. Flexible resumes and Master CV

### Editing behavior

Start from Education, Experience, Projects and Skills as today. Keep existing inline heading renaming and add a discoverable rename control in the section outline. Permit add, rename, reorder, hide and remove/undo. Hiding preserves content; deletion explains what is being removed and does not delete the Master CV source.

Add generic section formats:

1. **Entries:** optional title, organization, location, dates, link and bullets. Useful for additional experience, volunteering, certifications/licenses, publications and leadership.
2. **Text:** summary, objective, statement or other paragraphs.
3. **List:** languages, credentials, skills and compact achievements.

Offer example titles without restricting names. Display title and semantic/content type are separate, so renaming Experience does not break AI, exports or source references. Empty optional fields are omitted cleanly from the printed result.

Custom sections belong in both the Master CV and individual resumes. Master CV entries are reusable facts; each resume is an independent selected snapshot. Editing a resume does not silently modify the master source or another resume.

### Data and compatibility

Introduce a versioned normalized document representation with ordered typed sections and stable section/entry IDs. Read existing four-list documents through a legacy adapter, preserving titles, visibility, order, targets and all content. Save edited documents in the new version; do not bulk rewrite existing resumes. Server save logic rejects a downgrade that would discard newer section content from an old open client.

Use the same section traversal and validation for editor rendering, ATS text/evidence, AI selection, autosave and LaTeX/PDF export. Fail explicitly on unsupported future schema versions rather than dropping content. Keep size/entry caps and text/URL escaping.

Retain existing Master CV tables. Add an owned custom-section store with stable IDs, type and bounded content, protected by RLS. Persist one Master CV order/title metadata list spanning built-in and custom sections, so arbitrary interleaving survives reload. Include existing certifications in resume selection; do not require users to re-enter them into a custom section.

Adapt AI selection to all available section types. It may select existing source IDs and suggest phrasing, but cannot invent credentials or facts. Explain picks briefly and preview them before applying. Do not insist on 1–3 projects for every job or replace the user's custom layout wholesale. Preserve manual content not covered by a selected replacement.

Keep the current single-column template and typography. A template marketplace, arbitrary drag/drop page design and broad industry-specific template packs are outside this change.

## 3. First-login setup

New users see a brief welcome step after their first authenticated login, then continue to the profile/Master CV page. Core message:

> Build your Master CV once. Add your responsibilities, achievements, education, skills and relevant credentials in as much useful detail as you can. For each job, AI selects the most relevant material and suggests wording based on what you provide. You review the result before using it.

Offer **Import a resume**, **Enter details myself**, and **Skip for now**. These lead to the existing profile experience with a resumable checklist and welcome guidance. Encourage concrete outcomes and tools where truthful; do not force every optional section to be filled. The profile can be longer than one page because job-specific resumes select from it.

Persist onboarding state per user: not started, started, completed or skipped. Completion is an explicit Continue action, not a requirement to reach 100% on a generic meter. A skipped user can resume later from their profile.

Preserve a safe original destination after setup, including application links and extension connection. Password reset/callback paths must complete without a redirect loop. Cover password sign-in, immediate-session signup, email-confirmed signup and Google sign-in. Existing users bypass forced onboarding after rollout, with optional profile guidance still available. Add new-user defaults without marking every existing profile as newly created.

Replace the universal Projects / LinkedIn-or-GitHub completeness rules with useful source-content guidance. Keep optional CS suggestions, clearly optional. Profile completeness is distinct from job suitability.

## 4. Extension job scoring

User-requested addition: provide a job-match view similar in purpose to Simplify/Jobright while retaining Resume Butler's existing application detection. First delivery extends the current popup; a persistent sidebar can follow if needed. Autofill and automatic application submission are outside this request.

On a supported LinkedIn, Greenhouse, Lever or Ashby posting, show the detected company, title and description availability. Add a source selector with **Master CV** and owned saved resumes, plus an explicit **Score this job** action. Remember the chosen source for this account and allow changing it at any time.

- **Master CV → Background fit:** evaluates all relevant master evidence to answer whether this job fits the user's background. It does not claim all that evidence appears in a submitted resume and has no PDF/layout score.
- **Selected resume → Resume match:** evaluates only that resume's visible/exported content. Display the resume title and separate missing qualifications from background evidence omitted from this version.
- Return the same requirement-based assessment, evidence and critical gaps as the app's shared CS-first review engine. Use the same rubric/model versions; do not create a second unrelated extension scoring formula.
- Show concise matched strengths, missing/uncertain requirements and a link to tailor/open the selected resume for this job. Require readable job text; show a correction/retry path if extraction is incomplete rather than scoring a title alone. A changed posting or source invalidates the old score.
- Restrict the resume list and score messages to trusted extension UI handlers. The background worker calls authenticated extension endpoints; the server loads the owned source and scores it. Neither the OpenAI key nor complete Master CV/resume text is injected into job-site DOM or given to content scripts.
- Reuse existing revocable extension tokens and ownership checks. Bound/rate-limit input and model work; filter source metadata, and validate source ownership on every request. Signing out/disconnecting clears selected-source metadata and cached results for that account.
- Cache by authenticated account, job text/hash, source content version/hash and rubric/model versions. Handle LinkedIn's in-page job switches, navigation and out-of-order responses so the prior job's score cannot appear for a different posting.
- Keep current submission detection and manual tracker recording unchanged. Scoring does not claim the user applied and does not create an application automatically.

Reference behavior: [Simplify's score documentation](https://help.simplify.jobs/help/articles/2175778-understand-resume-score-and-keyword-matching) describes source selection and distinguishes keyword coverage from broader resume feedback. [Jobright's match documentation](https://api.jobright.ai/ai-job-match) describes profile/resume-based match scores and fit explanations. Neither source establishes access to an employer's private screening threshold.

## 5. Page-fit meter correction

This is a separately authorized, concrete bug fix and does not depend on the larger scoring/sections implementation. A browser height estimate and actual PDF pagination can disagree because rendering/font/layout differ. Do not adjust calibration blindly to make a single reported 102% case fit.

- Target estimated usage **90–100%**, green, including 99%. Below 90% is amber guidance to add relevant detail, not a requirement to pad the document.
- Label unconfirmed measurements as estimates. Estimated overflow is amber with a PDF-check action, rather than asserting a second page exists.
- A current-content PDF check is authoritative: one page displays **1 page**; two or more pages displays the actual count in red. Preserve the honest browser percentage in supporting text rather than clamping it to 100.
- An underfilled one-page PDF remains amber for usage, while accurately confirming the page count. Missing/invalid browser measurements are neutral, not false success.
- The on-page guide says **Estimated page boundary**, with matching amber styling. Existing edit-based PDF-result invalidation remains in place.
- Share pure fit logic between the toolbar badge and full gauge. Cover letters use the same general fit presentation. Actual PDF download does not itself trigger the page-count check. At the user's request, resume overflow now triggers an automatic check after a 1.5-second pause, with a 30-second cooldown. Manual checking remains available; unchanged content and undo reuse bounded cached results. Failures do not auto-retry repeatedly. The server fingerprints the actual compiled snapshot, so an old or different saved version cannot confirm newer edits.

## Delivery sequence and verification

1. Lock down scoring invariants with regressions for blank content, hidden sections across callers, phrase false positives, nontechnical requirements and profession-specific section penalties.
2. Introduce shared versioned sections and Master CV custom content; complete editing, save/read compatibility and export round trips before exposing unsupported section controls.
3. Build requirement extraction/evidence review and explanations on the shared visible-content model, with CS examples first. Wire generic certifications/custom evidence and PDF verification.
4. Add welcome/profile setup using additive database migrations and resumable state. Test all auth destinations and existing-user bypasses.
5. Add extension source selection and job scoring on the shared review engine; test owned-source access, account changes, job switches, stale results, unreadable descriptions and preservation of tracker detection.
6. Run unit/integration checks, synthetic-account browser flows, PDF extraction tests and a production build from an isolated snapshot. Obtain fresh review and fix material findings before rollout.

Benchmark cases include a strong CS match, keyword stuffing without experience, Java versus JavaScript, preferred-only gaps, alternative skills, missing explicit mandatory degree/license, overlapping experience dates, entry-level CS, irrelevant projects, all-hidden/blank resumes, custom sections, stale responses and AI instruction injection. Include healthcare/operations examples to verify flexibility without making CS quality depend on a generic dictionary.

Test section normalization/save/refresh/export, LaTeX escaping, old-client downgrade rejection, unknown section preservation, tenant isolation and AI source-ID validation. Browser checks cover add/rename/hide/reorder/undo, actual PDF download, setup skip/resume, returning users and safe redirects. Real ATS access is not assumed; claims are limited to tested behavior and documented vendor capabilities.

## Non-goals and rollout

- No guarantee of ATS acceptance, interviews or hiring outcomes.
- No automatic addition of skills, certifications or years to raise the score.
- No rewrite of applied migrations, bulk resume conversion, unrelated framework upgrade merge or deployment without the existing project workflow.
- No use of existing users' private content for testing; reuse dedicated synthetic accounts or create appropriately scoped fictional fixtures.

Implementation can stay in the current checkout with existing unrelated edits preserved, as in the prior work. Keep changes reviewable and report migration/deployment status explicitly. Exact migration files and module boundaries belong in the implementation plan after approval of this design.

## Page-fit verification completed

- Extracted shared pure fit logic; regression assertions reproduced the old failures before the behavior fix. All nine fit tests pass, including 99/100%, 102% plus a confirmed single-page PDF, invalid measurements and authoritative multi-page output.
- Full suite: 70 passing tests; ESLint clean; production build passed in an isolated snapshot.
- Playwright on localhost:3000, dedicated synthetic QA resume only: 28.3% is amber, 91.5% is green, and an actual compiled PDF returns one page with the UI showing "1 page". Zero browser page errors. Evidence: /tmp/resume-butler-fit-qa-result.json and /tmp/resume-butler-fit-{low,target,pdf}.png.
- Independent review found no material defect in fit logic or the expanded extension design. The extension feature and larger resume/setup redesign are not implemented yet. The page-fit fix remains uncommitted and undeployed.

## Follow-up editor corrections

The user explicitly requested automatic PDF checking on overflow and Google Docs-style quiet save feedback. Both are implemented independently of the larger proposed redesign.

- Automatic/manual checks share one serialized scheduler. It debounces overflow edits, reuses exact-content results, ignores stale completion after edits or unmount, and stops automatic retries for a failed content version. The 30-second cooldown limits backend compilation work; the existing per-user backend limit still applies. Browser-only measurement continues during editing.
- The PDF route returns the SHA-256 identity of the saved snapshot it compiled. Canonicalization respects visible headings/order, normalizes absent/empty contact fields and ignores unprinted target metadata. The client validates the identity before accepting the real page count.
- The common toolbar reports Saved / Saving / Not saved for content and document names. Renames save after a short pause or blur, serialize rapid updates, and retain unsaved-tab protection. Routine rename/addition and autosave-error toasts were removed; failure details live on the inline indicator. Actions with Undo still provide their Undo affordance.
- Full suite now passes **90 tests**. A real synthetic-account browser run triggered exactly one automatic compilation, confirmed **2 PDF pages**, persisted a rename, saved a normal content edit with **zero routine toasts**, and recorded **zero page errors**. Renaming did not recompile unchanged printed content; the next content edit respected the cooldown. Evidence: /tmp/resume-butler-auto-save-qa-result.json and /tmp/resume-butler-{auto-pdf,quiet-save}.png.
