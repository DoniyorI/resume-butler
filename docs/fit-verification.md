# Fit with evidence: verification

November 12, 2026. Covers roadmap milestone M3. The definition of fit and the reasons for it are in the [gap analysis](research/2026-11-12-gap-analysis.md#what-right-fit-means-here).

## What changed

Each saved job shows how well it fits the user's Master CV and why.

- **A band and a reason.** Strong fit, Good fit, Stretch, Low fit or Not enough to tell, with one sentence giving the counts. No percentage.
- **See why.** Every requirement the posting states, split into required and preferred, each marked as backed by experience (with the user's own bullet quoted), listed without an example, or not in the Master CV. Years of experience and degree are compared. Lines about sponsorship, clearance, citizenship, on-site attendance, relocation and travel are quoted for the user to judge and are not scored.
- **Resume against CV.** When a working resume is chosen, the panel lists what the Master CV backs that the resume leaves out.
- **Best fit sort**, and Saved jobs in the main navigation.

The engine (`src/server/fit/`) is deterministic and calls no AI. Fit is computed when the page is read, so there is no migration and nothing to backfill. A missing item points to the Master CV; the product never writes a claim for the user.

## Evidence

- **Tests:** 410 pass with `npm test` on Node 26.3.0, and on Node 24 in the `Checks` workflow. 46 cover the engine, the saved-job ranking and the rewrite guardrail, including a pinned result for a realistic posting and CV.
- **Lint and build:** clean; the production build was run on an isolated copy of the committed tree.
- **Signed-in browser flow:** `scripts/qa-saved-job-fit.mjs` passed every step: seed a fictional Master CV, save a well-matched posting, a poorly matched one written as a bulleted list, and one with no description; check the bands (Strong fit, Low fit, and the add-a-description hint); open See why and find a quote that is a substring of a seeded bullet, a listed-only row, the sponsorship line and the not-a-prediction footer; confirm Best fit ordering against Newest; confirm the navigation entry; check the panel at 375px; no page errors and no AI endpoint called. `scripts/qa-saved-job-flow.mjs` still passes. Each run uses one disposable `@example.test` account and removes it.
- **Hostile input:** four 50,000-character postings against a CV of 400 bullets return in under 100 ms each; the skill matcher is linear in the text length.
- **Hand check:** a posting and CV written by the reviewer exposed two faults that were fixed before release: role words ("backend") were reported as gaps, and a PostgreSQL bullet did not count for a SQL requirement.

## Known limits

These are the cases the engine is known to get wrong. They are stated so the result is read as decision support.

- **It only knows the skills on its list** (316, software, data, DevOps, mobile and security). A posting outside those fields reads "Not enough to tell". SAS and SAP are left out because they are also company names.
- **A skill is found by its name.** "Built a message queue" does not count for a Kafka requirement, and nothing checks depth or recency.
- **Importance follows headings and cue words.** "Bachelor's required, Master's preferred" in one sentence is read as preferred. An "About <Company>" passage inside a one-paragraph posting is not recognised as boilerplate.
- **Years** are the span of dated experience with overlaps merged. Internships count the same as full-time work, an end date given as a year is read as 1 January, and an open-ended entry that is not the most recent is left out.
- **A heading such as "Next" alone on a line** can be read as Next.js.
- **Checks** need recognisable wording; ordinary uses of "citizen" can match the citizenship check, and an on-site line needs a capitalised place name.
- **Best fit ranks the 200 most recently saved jobs.**
- **The rewrite guardrail** is stricter than before for Go, Node, Express and AI, and laxer only for lower-case "react", "jest", "flask", "angular" and "tailwind", which now read as ordinary words.
- **The extension popup** still shows keyword coverage, not this result. Bringing fit to the extension and to application pages is M6.

## Knockouts and sections that are not requirements (November 16, 2026)

Found by reading the owner's own applications: a role in Seoul that required Korean and 5+ years read "Not enough to tell", and its one requirement, "system design", came from the interview-process section.

- **Interview-process sections are ignored** ("Our process", "Interview process", "Hiring process"), like company boilerplate.
- **Spoken languages.** A required sentence that names a language other than English with a fluency cue ("fluent in", "proficiency in", "speaking") is reported in `language`. If the Master CV never mentions that language the job is rated Low fit and the reason says why; if it does, nothing changes. A language under a nice-to-have heading is quoted as a check and not scored.
- **Location** is a new check: a sentence saying where the candidate must be ("must be based in", "located or willing to work from") is quoted for the user. It is never scored, because the engine does not compare places.
- **Few named skills.** A posting with fewer than three recognised skills is rated Stretch when its years exceed the dated experience, and otherwise stays "Not enough to tell", now saying when the years are met.
- **These rules only lower a band.** Nothing new can raise one.

Evidence: 15 new engine, wording, summary and popup tests (699 pass on Node 26.3.0); `scripts/qa-fit-stats-alerts.mjs` passed every step against the local app with a disposable account, which it deleted. Extension 0.8.2 shows the language line and the two new check labels; reload the unpacked extension.

Still wrong, by design or not yet handled:

- **Plain-language postings** ("strong backend fundamentals", "2+ years of software engineering") still read "Not enough to tell" when the years are met: the engine only knows named skills.
- **A language is matched by its capitalised name**, so "Chinese market" in a sentence that also says "proficient in SQL" reads as a language requirement, and a language is "mentioned" if its name appears anywhere in the Master CV.
- **English is never a language requirement**, and a location is never compared with the profile's location.
