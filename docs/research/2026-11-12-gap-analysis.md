# Gap analysis: Resume Butler against Jobright and Simplify

November 12, 2026. Extends the [October 30 audit](2026-10-30-product-direction-audit.md) and the [October 28 capability scan](2026-10-28-competitor-capabilities.md); it does not repeat them. Every audit finding used below was re-checked against source at commit `8a83097`.

**Goal measured against:** one place to learn whether a job fits, get a resume tailored to it, apply, track it, and be told what to do next until an offer is accepted.

## How to read the evidence

- **Code findings** carry a `file:line` and were read or reproduced in this session. Scoring results were reproduced by calling the real `scoreResume` and `extractKeywords`.
- **Vendor pages are claims**, not tested quality. Jobright's and Simplify's products were not used hands-on.
- **User reports** are Trustpilot and Chrome Web Store reviews read directly. Reddit could not be fetched this session, so Reddit-derived points arrive through third-party review sites, several of which sell competing tools; they are marked *relayed* and weighted low.
- Jobright publishes no job-seeker price on the pages fetched. The figures below are third-party reports that disagree with each other.

## Journey stage by product

| Stage | Resume Butler (source) | Jobright | Simplify |
| --- | --- | --- | --- |
| Find jobs | None. Jobs enter through the extension (LinkedIn, Greenhouse, Lever, Ashby) or a pasted link | Its core. A job feed ranked for the profile; the feature users praise most. Complaints: out-of-area listings, stale or inaccurate postings | A job board with matches. Trustpilot complaints: few industries, runs dry quickly |
| Is it a fit? | Keyword coverage only: share of recognised JD terms found in a resume or the Master CV. No required/preferred split, no evidence, no seniority or eligibility check. Shown in the extension popup and the studio, not on saved jobs | A match score from experience, skills, seniority, industry and years, plus a "Fit" view of requirements and gaps. Weighting unpublished; users report scores that disagree with other boards | "Keyword Match" for one posting plus a general Resume Score, with matched and missing terms. The vendor says it is not an employer's ATS score |
| Tailored resume | AI picks Master CV entries for a JD, previews them, and offers guarded bullet rewrites. Certifications and custom sections are not selectable. A saved job is not offered as a target | One-click tailored resume that "passes ATS" (claim). Praised for speed; fabricated skills and metrics are the most repeated complaint (*relayed*, plus one first-hand report in the audit) | Manual builder is free; AI tailoring and multiple uploaded resumes are paid |
| Apply | Reviewed autofill on Lever only (contact fields and approved answers). Resume upload stays manual | Autofill on "thousands of ATS platforms" (claim, none named) and an Agent that applies for you | Free Copilot autofill on most major ATS, the feature users praise most; reports of blank or wrong fields. Paid Autopilot submits unattended |
| Remember what was sent | Preserved PDF bytes, frozen JD and answers, corrections. Neither competitor documents this | Not documented | Tracker keeps documents and posting details |
| Track | Applications table, status history, email suggestions over IMAP with a review queue, extension detection, journey chart | A tracker with statuses; users ask for more frequent status updates | Free tracker with Gmail matching and suggested status changes; the most praised feature on Trustpilot |
| What next? | A dashboard list of applications still at Applied after 14 days. No tasks, deadlines, rounds, contacts or offer record | Insider referrals, an assistant, an interview-question page. No reminders documented | Paid follow-up email drafts and referrals. No reminders or interview prep documented |
| Price | Not sold | Free tier on daily credits; paid reported at roughly $30–40/month (unverified) | Free core; Simplify+ $19.99/week, $39.99/month, $89.99/quarter |

### What this says

1. **Fit is the largest gap against the stated goal.** Both competitors answer "is this worth applying to" on the job itself. Resume Butler answers it only as a keyword percentage, in a popup, and never on the saved-jobs list where the decision is made.
2. **Nobody documents "what to do next".** Neither competitor shows reminders, assessment deadlines or round tracking on the pages read. This is the open ground, and the audit's A7 already scoped it.
3. **Truthful tailoring is a real difference only if it is kept.** Jobright's loudest complaint is invented content. Resume Butler's guardrails and Master-CV-only selection are the right base; the fit work below must show evidence for every claim and ask for anything missing.
4. **Autofill breadth is not winnable soon.** Simplify gives it away and has years of adapters. One reviewed adapter at a time stays the plan; it is not where the product competes.
5. **Submission memory is unmatched** but invisible until a user needs it. It needs no further work now.

## What "right fit" means here

A fit result is a comparison of one job description with the user's **Master CV**, shown with its evidence. It is not a prediction of an interview.

- **Requirements, split by weight.** Terms under a "requirements / qualifications / must have" heading count as required; those under "preferred / nice to have / bonus" count as preferred. With no headings, everything is required.
- **Evidence, by strength.** *Demonstrated*: the term appears in an experience or project entry, which is named and quoted. *Listed*: it appears only in the skills list. *Missing*: not found; the user is asked whether they have it and pointed to the Master CV, never given invented wording.
- **Experience and degree.** A years requirement is compared with the span of dated experience; a degree requirement with education. Either is "unknown" when dates or text are absent, never assumed met.
- **Things only the user can judge.** Sponsorship, clearance, citizenship and on-site lines are quoted from the posting as checks, not scored.
- **A band, not a decimal.** Strong, good, stretch or low, from required coverage and the years comparison; "not enough to tell" when the posting or the CV is too thin.
- **Two questions kept apart.** "Can I support this?" uses the Master CV. "Does this resume show it?" uses the working resume. The difference between them is the tailoring to-do list: supported requirements the resume leaves out.

The same engine serves saved jobs, the studio and the extension. It is deterministic, so it costs nothing per job, needs no migration and can be tested with fixtures.

### Is job discovery needed to compete?

**Yes against Jobright, no for the product to be useful.** Discovery is the thing Jobright's users praise most, and without it Resume Butler can only answer "of the jobs I found, which fit?", never "what should I look at?". That is a real gap and should be stated as one. A general job board is still the wrong build: it is Jobright's whole company and Simplify's weakest-rated feature.

The proportionate answer is a **watchlist**: the user names target companies, the server reads their public Greenhouse, Lever and Ashby boards, and new postings arrive already scored for fit. It reuses posting identity, saved jobs and the fit engine, and it needs no index or marketplace. It is in the backlog after fit and next actions, because it is worthless until fit is trustworthy.

## Bugs found

Verified means reproduced by running the code or read at the cited lines with unambiguous behaviour.

| # | Where | What the user sees | Status |
| --- | --- | --- | --- |
| 1 | `src/server/ats/score.js:33-38` | An empty resume scores 30 overall with "quality 100"; a skills-only resume against a posting with no recognised terms scores 35. Zero quality checks count as a perfect result | Verified (reproduced) |
| 2 | `src/server/ats/keywords.js:25-27` | "C++" and "C#" are never extracted from a posting, so they are never reported missing. `\b` cannot match after `+` or `#` | Verified (reproduced) |
| 3 | `src/server/ats/keywords.js:39-40` | "5+ years of experience" becomes a keyword that is matched only by that literal phrase, so every posting with a years requirement reports it missing | Verified (reproduced) |
| 4 | `src/server/ats/skills.js:36`, `keywords.js:6` | "go above and beyond" adds the Go language; "Scrum master" adds "master's degree". Ordinary English is read as requirements | Verified (reproduced) |
| 5 | `src/server/ats/score.js:26`, `src/features/ats/AtsResults.jsx:49-52` | A posting with no recognised terms shows a red "Keywords 0" ring and empty lists, which reads as a failed match. The extension route already returns "no score" for this case | Verified |
| 6 | `src/features/resumes/data.js:67-79` | A saved job is never offered as a tailoring target; the picker reads `applications` only | Verified |
| 7 | `src/features/applications/actions.js:103-116`, `supabase/migrations/013_saved_opportunities.sql:88-106` | Applying to a saved job links the two records but copies nothing: the application has no description, pay, workplace or chosen resume. Saved jobs have no "applied" action at all | Verified |
| 8 | `src/server/opportunities/service.js:12,44`, `013_saved_opportunities.sql:79-81`, `extension/background.js:362` | Saving the same posting again from the extension sends `resumeId: null` and a fresh payload; the upsert overwrites both, dropping the chosen resume and any fuller description | Verified (read end to end, not run against a database) |
| 9 | `src/features/dashboard/data.js:185-189`, `src/features/dashboard/SectionCards.jsx:44-46` | Response rate uses current status only, so an application rejected after an interview stops counting as a response. The percentage includes recruiter outreach ("Reached Out") but its caption counts only "interviews or offers", so the two disagree | Verified (read) |
| 10 | `src/features/applications/actions.js:35-38,113` | A blank date is inserted as `null`, overriding the column default, so the application drops out of follow-ups and weekly counts | Verified in code; whether the form can submit blank is unchecked |
| 11 | `src/server/resume/tailorResume.js:103-107` | If the model returns no experience or project picks, the tailored resume is applied with those sections empty and no warning | Inferred |
| 12 | `src/features/dashboard/data.js:52-55` | An old application added directly at Interviewed reports the gap since its backdated apply date as "response time" | Inferred |
| 13 | `src/features/applications/ApplicationTable.jsx:78-81` | CSV export covers the 50 loaded rows. The button says so, so this is a limit, not a defect | Verified |

Not product defects, but worth knowing: the working tree holds empty duplicate folders and one stray file with " 2" in the name (`src/app/(app)/applications 2`, `src/server/ats 2`, `src/features/dashboard/LazyCharts 2.jsx`, `.git/index 2` and others). They look like file-sync conflict copies. Nothing imports them and git ignores the empty ones, but a sync tool writing inside `.git` is a risk to the repository.

## Ranked backlog

Bugs that mislead come first, as instructed. Effort is relative: S is under a day of focused work, M a few days, L a week or more.

| Rank | Milestone | User value | Effort | Depends on |
| --- | --- | --- | --- | --- |
| 1 | **Honest feedback.** Fix bugs 1–5, 9, 10: no credit for empty content, "nothing to compare" instead of a red zero, correct C++/C#, years handled as a requirement instead of a phrase, no ordinary-English false positives, a response rate that counts every application an employer ever responded to | High: every later fit result rests on these | S | None |
| 2 | **One job, one thread.** Fix bugs 6–8: saved jobs as tailoring targets, "Tailor for this job" and "I applied" on a saved job carrying description, pay, workplace and resume into the application; re-saving keeps the chosen resume | High: the user's own example of lost context | M | None; no migration |
| 3 | **Fit with evidence.** The definition above, on saved jobs (band, evidence, gaps, checks, best-fit sort), with the resume-versus-CV to-do list | Highest new value; the main gap against both competitors | M–L | 1 for correct terms, 2 for the hand-off to tailoring |
| 4 | **Next actions** (was A7). Dated activities per application: assessment, interview round, follow-up, offer deadline, with a Today list on the dashboard | High; open ground against both competitors | L | A new migration; code must work before it is applied |
| 5 | **Tailoring from fit** (was B3). Selection driven by the fit evidence, certifications and custom sections included; missing facts asked for, never written; bug 11 | High; turns fit into a document | M | 3 |
| 6 | **Fit everywhere.** The same result in the extension popup and on application pages | Medium | S–M | 3; extension reload |
| 7 | **Watchlist.** Target companies' public boards, new postings scored for fit | Medium–high; the proportionate answer to discovery | M–L | 3; a migration and a cron |
| 8 | **Offer closure and portability.** Record terms, deadline and decision; full export; spreadsheet import | Medium | M | 4 |
| 9 | **More reviewed autofill** (Greenhouse, then Ashby) | Medium; parity, not advantage | L each | None |
| 10 | **Gmail connection** | Medium | M | The owner's Google Cloud setup |
| 11 | **Interview preparation from the submitted package** (was B5) | Medium | M | 4 |

Deliberately not ranked: billing, unattended mass apply, native mobile apps and framework upgrades are out of scope for this work.
