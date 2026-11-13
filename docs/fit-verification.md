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
