# Honest feedback and saved-job continuity: verification

November 12, 2026. Covers roadmap milestones M1 and M2. Scope and reasons are in the [gap analysis](research/2026-11-12-gap-analysis.md).

## What changed

**M1, honest feedback.** `scoreResume` returns a `status` and uses `null` for anything it did not rate. An empty resume has no score; a posting with no recognised terms has no keyword or overall score. Keyword extraction finds C++ and C#, no longer reads ordinary English as a skill, reports a years requirement as a note instead of a phrase to match, and matches degrees by level. The dashboard response rate counts every application an employer ever responded to.

**M2, one job, one thread.** A saved job is a tailoring target in both editors. Its card has "Tailor resume" and "I applied". The application created from it carries the description, pay, workplace and working resume. Adding an application by hand for a saved posting fills the same fields without overwriting anything typed. No migration.

## Evidence

- **Tests:** 298 pass with `npm test` (237 before this work). Run on Node 26.3.0, because Node 24 is not installed on this machine; the Node 24 run is the repository's `Checks` workflow.
- **Lint:** `npm run lint` clean.
- **Build:** production build passed in an isolated copy of the tree, leaving the dev server's output untouched.
- **Signed-in browser flow:** `scripts/qa-saved-job-flow.mjs` passed all steps twice against `localhost:3000`: save a job, tailor (the editor opens on that job with its description; the empty resume shows no score, lists C++ and C# as missing and does not list Go or a degree), mark applied, confirm the application row, re-save without loss, deep link that does not replace another target, manual add that inherits the description, dashboard caption, no page errors, no AI endpoint called. Each run creates one `@example.test` account and deletes it and its rows afterwards; cleanup was confirmed both times.
- **Review:** an independent review of the M2 diff found no authorization, schema or Next.js defects. Its behavioural findings were fixed and tested: the hiring-cycle rule on "already tracked", cleanup when recording the working resume fails, the web editor being able to clear a description, and the insert fallback keeping job details.
- **Security review:** the first version of the skill matcher compared every candidate with every other one. It is now a pass over neighbours in position order, with a timing test on a 48,000-character repetitive posting.

## Known limits

- **Double "I applied" from two tabs** is settled without a lock: the earliest row for the posting stays and the later request removes its own. A lock needs a migration and was not worth one here.
- **Skill recognition is a fixed list.** A posting that names nothing on the list gets "no keyword comparison", not a score. Known misses and false hits: a sentence that starts "Go is our main language" finds nothing; "a node in our org chart" is still read as Node when a technical word follows.
- **A resume is matched more leniently than a posting**, on the assumption that a resume is technical writing throughout.
- **The response rate has no time window.** It counts over every tracked application.
- **Choosing a working resume is still not proof of what was uploaded.** The application links the resume; the submission record remains the evidence.
- **Not fixed here:** `extension/popup/popup.js:91` ignores a freshly captured description when the stored one is an empty string. It is held for the next extension change so the unpacked extension is reloaded once.
- **Production** was not exercised. Deployment status is reported with the push.
