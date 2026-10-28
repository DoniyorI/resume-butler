# ATS scoring, flexible resumes and first-login setup review

Investigated October 28, 2026. Findings are verified against the current uncommitted checkout. This is an investigation and proposal, not an implemented feature or approved design.

## What scoring does today

`src/server/ats/score.js` computes:

`overall = 50% keyword coverage + 20% section presence + 30% writing checks`

It does not rank candidates against an employer's applicant pool. It compares one resume's structured content with one job description using a fixed skill-alias dictionary and a few patterns. No AI is involved in this scanner, regardless of the configured GPT model.

Verified gaps:

1. An empty resume scores **30/100** because an empty quality-check set defaults to 100.
2. The server scorer does not honor hidden section metadata. A synthetic resume with every section hidden scores **96/100**, although generated LaTeX contains none of its skills. The resume studio already removes hidden sections before calling the API, but the application detail loader passes stored resume content directly to its scanner. The same resume can therefore be evaluated differently across entry points.
3. Education, experience, projects and skills each earn a quarter of the section score. A person whose profession does not use projects is penalized for omitting them.
4. The keyword dictionary and compound patterns heavily favor software roles. A job requiring a Registered Dental Hygienist license and periodontal charting yielded **zero extracted requirements** in the synthetic probe, so the missing list could not report either gap.
5. Required and preferred requirements, alternatives such as "Python or Java", license requirements and experience thresholds have no structured interpretation. Years are treated as phrases to find, not computed from employment history.
6. Phrase fallback accepts stemmed words appearing anywhere in the resume, without requiring one coherent supporting statement. A skill in a list counts the same as demonstrated experience.
7. Header checks are displayed, but not included in the numeric formula. Bullet metrics and a small verb list affect the score despite not being an employer's actual matching rubric.
8. The scanner evaluates structured JSON, not extraction quality or reading order of the actual exported PDF. Certifications and future custom sections are not included by `resumeToText`.

Reproduction used fictional data only and the real `scoreResume` and `generateLatex` functions through the existing Node test loader. No user data or database state was changed for this investigation.

## What documented ATS behavior establishes

There is no single ATS algorithm or universal passing score. Greenhouse documents both exact keyword filtering, including required AND / preferred OR queries, and a separate assistive AI matching feature that evaluates recruiter-defined job criteria against extracted skills and employment evidence. Its matching feature does not itself automatically advance or reject applicants. Application-question auto-reject rules are a separate feature.

Sources:

- [Greenhouse Talent Filtering](https://support.greenhouse.io/hc/en-us/articles/27104809835291-Talent-Filtering): exact terms and required/preferred queries, plus other recruiter-selected filters.
- [Greenhouse Talent Matching technical FAQ](https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ): structured extraction of skills, titles, employment dates and experience; assistive comparison against recruiter criteria.
- [Greenhouse Talent Matching FAQ](https://support.greenhouse.io/hc/en-us/articles/41131886674075-Talent-Matching-FAQ): matching does not auto-reject or auto-advance.
- [Greenhouse Auto-reject](https://support.greenhouse.io/hc/en-us/articles/360000653472-Auto-reject): employer-configured rules based on application question responses.
- [Greenhouse unsuccessful resume parsing](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse): actual document extraction can be affected by image-only files, columns, tables, headings and other formatting.
- [Lever candidate search](https://help.lever.co/s/article/Searching-the-Database-for-Candidates): vendor search documentation; search result text confirms resume-specific keyword queries, but the full page failed to load during this investigation. No broader claims rely on it.

Implication: lowering scores alone does not improve outcomes. We should expose evidence gaps, parsing problems and missing job requirements. Our output must not claim to reproduce an employer's private settings or predict hiring decisions.

## Stricter scanner approaches

**A. Rules only:** fix visibility/empty-score bugs; remove profession-specific section requirements; strengthen aliases, phrase matching and quality checks. Instant and inexpensive, but continuing dictionary maintenance cannot cover arbitrary professions or nuanced job requirements well.

**B. GPT-6 Luna plus deterministic rules (recommended, awaiting user choice):** extract job requirements with exact supporting job-description quotes, classify required/preferred/alternative groups, and link resume evidence to each. Validate references and quotes in code. Let code calculate the displayed score and critical-gap indicators; use deterministic dates and checks where reliable. Keep instant checks during editing and run/cached deeper review deliberately, avoiding a paid model request on every keystroke.

For B, distinguish **met**, **partial**, **not evidenced** and **needs confirmation**. A keyword list alone is weaker evidence than a relevant dated accomplishment. Missing mandatory evidence prevents a top match rating; typography and preferred keywords cannot hide it. Unknown qualifications are not asserted to be absent, and the assistant never invents licenses, years, responsibilities or achievements. Exact score weights and caps need benchmark calibration rather than an arbitrary claim of ATS equivalence.

Show separate job-requirement fit, document readability and writing feedback. An explicit exported-PDF check should verify selectable text and key content against the visible document; it should not silently label a JSON-only check as PDF validation. Self-declared eligibility that is absent from the resume remains unknown, not inferred from a person's name or history.

## Flexible sections: current limits and recommended scope

The four built-in resume headings are **already renameable inline** in the paper editor. They can also be reordered and hidden. The limitation is the fixed underlying section IDs and item types. `normalizeOrder` drops unknown IDs; `normalizeResumeContent` keeps only four lists; server save validation rejects custom IDs; the renderer, PDF builder and AI tailoring all assume the same fixed sections. Renaming alone does not add new content types.

The Master CV includes certifications, but the resume content model and tailoring prompt omit them. The tailoring prompt also always asks for projects and gives software-oriented skill-group examples. The profile completeness meter rewards a project and LinkedIn/GitHub, which should not be universal requirements.

Recommended scope:

- Preserve today's starter layout and all existing resumes. Add a clear rename action in the outline while preserving inline editing.
- Give sections stable IDs independent of titles and content types. Add, rename, reorder, hide and remove sections with an undo path.
- Support repeated entries (optional title, organization, dates, location, link and bullets), text/summary and compact lists. These cover licenses, certifications, volunteering, publications, languages, clinical placements, awards, leadership and many other professions without hardcoding each as a special section.
- Allow custom content in the **Master CV as well as each resume** so tailoring can select it. Preserve per-resume wording/layout independently of the master source.
- Use one normalized section representation across save validation, editor, AI selection, ATS text extraction and LaTeX/PDF export. An unknown future section must not disappear silently on save.
- AI can choose relevant existing entries across section types, with source IDs and short reasons. Projects/certifications are optional unless relevant to that job. Keep selection preview and truthful editing rules.
- Preserve escaping, size caps, ownership, autosave serialization and export fidelity. Changing a visible heading does not change the semantic type or break AI references.

## First-login setup

Today email-confirmation signup links point to `/profile`, but there is no persistent onboarding state or guided first-login experience across password and Google sign-in. Merely reaching the profile page does not explain why to fill it in.

Recommended flow: first authenticated visit → short welcome/setup introduction → profile/Master CV → continue to the original intended destination. Explain: "Add your experience, responsibilities, achievements, education, skills and relevant credentials. For each job, AI selects the most relevant details and suggests wording from what you provide. You review changes before using them."

- Offer resume import or manual entry; encourage detailed, accurate source material rather than filling every optional section.
- Let the user add career-specific sections. Do not require projects, GitHub, certifications or years of employment from everyone.
- Persist started/completed/skipped state per user. Allow skip and resume later. Avoid redirect loops and interruptions on later sign-ins.
- Preserve safe deep links, OAuth destinations, extension connection and password-reset flows. Returning users must not be accidentally forced through setup after a migration.
- Use a separate "build your profile" completeness checklist; keep it distinct from job suitability. A complete profile is not necessarily a good match for a specific job.

## Proposed delivery order and verification

1. Fix scoring invariants: empty resume, visibility across all API callers, missing contact details, no meaningful extracted requirements, irrelevant section penalties and phrase false positives. Keep synthetic counterexamples as regressions.
2. Evolve the section model with backward-compatible normalization; wire Master CV, editor, persistence, AI selection, scan text and PDF together. Test round trips and older documents before release.
3. Introduce requirement-based review after approach choice, using fictional job/resume pairs across software, healthcare, education, operations and an early-career case. Verify mandatory gaps, alternative requirements, overlapping dates, keyword stuffing, quoted prompt injection, model failures and stable rescoring. Compare against human-labeled evidence rather than targeting lower numbers.
4. Add first-login welcome and resumable profile setup with account-isolation and redirect tests. Use synthetic password and OAuth-path scenarios, skip/resume, refresh and returning-user checks.
5. Verify custom section edits survive refresh, generation and PDF download; browser-test score explanations and onboarding. Avoid building over `.next` used by running previews. Deploy only after review and verification.

Product behavior has not been changed in this investigation. The scanner approach is the pending decision before writing the implementation design.
