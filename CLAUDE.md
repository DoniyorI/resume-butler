# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Resume Butler is a job application tracker and resume builder: Next.js 14 (App Router, JavaScript) on Supabase (Postgres, Auth). AI features (resume alignment, cover letters, bullet suggestions, resume parsing, email classification) call OpenAI `gpt-6-luna` from server code. Email sync reads the user's inbox over IMAP or, connected with Google, through the read-only Gmail API, and the Chrome extension in `extension/` adds applications as the user submits them.

**Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first** for the full map: stack, request flow, every page, feature, route, action, server module and table, the AI rules, the email pipeline, the extension and security. This file is the short list of rules for changing the code.

## Commands

```bash
npm run dev        # Dev server on port 3000
npm run build      # Production build
npm start          # Production server
npm run lint       # ESLint (next/core-web-vitals)
npm run format     # Prettier
```

Node 24.x (see `engines` in package.json).

## Folder Structure

```
src/
  app/                    Routes only; pages stay thin
    (app)/                Signed-in app. layout.js checks the user on the server and renders the nav.
                          page.jsx (/) is the dashboard; /insights has the charts and the Search report;
                          the applications table is /applications
    (auth)/               login, register, forgot-password, reset-password (no nav)
    (marketing)/          about, contact (public, static)
    api/*/route.js        Route Handlers (uploads, downloads, AI, email scan, the extension API)
    api/cron/*            Scheduled jobs (vercel.json crons), authorized by CRON_SECRET
    auth/callback/        Exchanges OAuth / email-link codes for a session
  features/<feature>/     UI and logic per feature: applications, ats, auth, contact,
                          cover-letters and resumes (the editors live in each one's studio/ folder
                          and share resumes/studio's page canvas and toolbar), cv (data + actions only), dashboard,
                          documents (resume + cover letter library), email-sync, opportunities (saved jobs),
                          watchlist (companies' public job boards),
                          profile (profile and master CV page), suggestions (email review queue),
                          extension (connect page)
    actions.js            Server Actions for that feature ("use server")
    data.js               Server-only reads and snake_case -> camelCase mapping
    hooks/                Client hooks for that feature
  components/
    ui/                   shadcn/ui primitives only (kebab-case files)
    layout/               NavBar (signed in), PublicHeader (visitors), MarketingHeader (picks one), Footer
    shared/               App-wide widgets (ErrorState, LocalDateTime, PageSkeletons for loading.js)
  lib/                    Code safe on client and server: constants, dates, safeUrl, redirects, postJson,
                          salary, jobDetails, csv (toCsv, parseCsv), emailCategories, supabase server and middleware clients
                          (there is no browser client)
  server/                 Server-only code (`import "server-only"`), reusable by actions, routes, cron and the extension:
    auth.js               getCurrentUser (cached per request), requirePageUser, requireUser, hasRecentRecovery
    actionResult.js       runAction / parseInput for Server Actions
    http.js               HttpError, parseJson, errorResponse for Route Handlers
    openai.js, rateLimit.js (per user), authRateLimit.js (per IP and email, signed out), crypto.js, latex.js
    ats/                  ATS scoring (scoreResume), keyword and skill matching (matchSkills)
    applications/         insertApplication (shared insert: posting identity, job details, fail-open),
                          importPlan (pure CSV import planning), importApplications (commit, undo)
    opportunities/        Saved jobs: save, list, tailoring targets, startTailoredResume, applyToSavedJob
    fit/                  assessFit (posting against Master CV, with evidence), fitForSavedJobs, rankSavedJobsByFit
    activities/           Dated next steps per application (service.js) and suggestNextSteps (suggest.js, pure rules)
    offers/               Offer terms and decision per application (service.js)
    export/               exportJsonChunks (streamed full export), applicationsCsv, NEVER_EXPORT
    watchlist/            Watched companies: parseBoardLink and fetchBoard (boards.js), refresh, save, dismiss
                          and the daily job (service.js), htmlToText, watchedWithBands
    email/                IMAP client, classification, matching, connection settings, syncEmailsForUser,
                          autoSync (the daily job)
    supabaseAdmin.js      Service-role client (bypasses RLS): cron, extension API, auth rate limits
    extension/            Extension tokens (authenticateExtension) and recordApplication / undoApplication
    resume/               loadCv, tailorResume, generateResume, coverLetter, suggestBullets,
                          rewriteBullet, guardrails (blocks AI edits that add or swap facts),
                          parseResume, renderResume
  middleware.js           Refreshes the session and routes signed-out visitors (pages only, skips /api)
supabase/migrations/      SQL schema, 001-024; apply in order in the Supabase SQL editor
extension/                Chrome extension (Manifest V3, no build step); see extension/README.md
docs/                     ARCHITECTURE.md (the full map), chrome-extension-plan.md
```

## Conventions

- **Extension API.** Routes under `api/extension/` authenticate with `authenticateExtension(request)` (`@/server/extension/tokens`), a bearer token, not a session. It returns the service-role client, so scope every query by the returned `userId`. The plan is in `docs/chrome-extension-plan.md`.
- **Service role.** Only scheduled jobs, the extension API and the auth rate limiter use `createAdminClient()` (`@/server/supabaseAdmin`). It bypasses RLS, so every query made with it must filter by `user_id`.
- **Auth.** Use `getUser()` on the server, never `getSession()`, for any decision. The middleware (pages only, not `/api`) refreshes the session and routes with `getClaims()`; layouts, pages and routes still check `getUser()` themselves. Pages: `requirePageUser()` from `@/server/auth` (redirects). Route Handlers and Server Actions: `requireUser()` (throws a 401 `HttpError`). The user ID is `user.id`.
- **Reads.** Fetch in Server Components with the server client (`@/lib/supabase/server`) and pass plain data to client components. Avoid `useEffect` fetching for initial data.
- **Writes.** Use Server Actions in `features/<feature>/actions.js`, wrapped in `runAction` with input checked by `parseInput` (zod): check the user, scope queries by `user_id`, call `revalidatePath`, and return `{ ok: true, data }` or `{ ok: false, error }` with a user-safe message. Call `redirect()` outside `runAction` (it works by throwing). Don't call Supabase from the browser: there is no browser client, and sign-in, sign-up, password reset and sign-out are Server Actions too (`features/auth/actions.js`).
- **Business logic** that more than one entry point needs (route, action, future cron or extension) goes in `src/server/<domain>/` as functions taking `(supabase, userId, input)`.
- **Route Handlers** stay for file uploads, binary downloads, streaming, long-running jobs and anything the Chrome extension or cron calls. Use `parseJson(request, schema)` and `errorResponse(error, context)` from `@/server/http`, and `enforceRateLimit` for expensive routes.
- **Client components** carry `"use client"` only where they need state, effects or browser APIs. Keep them small and push data loading up to the page.
- **Untrusted content.** Never use `dangerouslySetInnerHTML`. Render links through `safeHttpUrl` / save through `normalizeHttpUrl` (`@/lib/safeUrl`). Treat LLM output, emails and uploaded files as untrusted: validate and cap before writing.
- **Shared values.** Statuses and colors come from `@/lib/constants`; dates are formatted with `@/lib/dates`; the brand color is the Tailwind `brand` token.
- **Naming.** Components are PascalCase `.jsx`; hooks, lib and server modules are camelCase `.js`. Import with the `@/` alias.
- **Database** fields are snake_case; frontend state is camelCase, mapped in `data.js` / at the query boundary.
- **Feedback.** Use `toast` from `sonner`, not `alert()`.
- **AI edits to user text** go through `checkRewrite` (`@/server/resume/guardrails`): a suggestion may never add or swap a technology, or drop a fact, the user wrote.
- **Auth flows.** Sign-in, sign-up, reset and password update count against `enforceAuthRateLimit` (`@/server/authRateLimit`), since Supabase sees the server's IP for everyone. Only a fresh recovery session (`hasRecentRecovery`) may set a new password. Redirects after sign-in go through `safeNextPath`.
- **Auth configuration.** Follow [README.md's setup](README.md#getting-started) for Site URL and redirect patterns, including callback query strings. CAPTCHA is pending: enable Supabase protection only after the sign-in, sign-up and password-reset forms collect challenge tokens and their Server Actions pass `options.captchaToken`.
- **Scores.** `scoreResume` (`@/server/ats/score`) returns `null` for anything it did not rate and a `status` saying why. Never show a stand-in 0 or 100, and never add a word to `SKILL_ALIASES` that is also ordinary English without an `ALIAS_RULES` entry (`@/server/ats/skills`).
- **Fit.** `assessFit` (`@/server/fit/assessFit`) compares a posting with the Master CV: pure, deterministic, no AI. Evidence is always a quote of the user's own text, and a gap points to the Master CV instead of writing a claim. It is decision support; never present it as a chance of an interview or as a percentage. New skills go in `SKILL_ALIASES`; known wrong cases are listed in [docs/fit-verification.md](docs/fit-verification.md). A required spoken language the Master CV never mentions rates the job `low` (`language` in the result), and a posting with fewer than three named skills is still `stretch` when its years exceed the dated experience; neither ever raises a band. Location and language lines are `checks`, quoted for the user. Interview-process sections are not requirements.
- **Extension and fit.** The extension only ever receives `fitSummary(fit)` (`@/server/fit/fitSummary`): bands, counts, requirement names and quotes from the posting. Never send it text from the user's CV. Show skills with `skillLabel` (`@/server/ats/skills`), not the canonical key. After changing files under `extension/`, bump the manifest version and tell the owner to reload the unpacked extension.
- **Tailoring.** The editor tailors from fit evidence (`planTailoring`, `resumeGaps` in `@/server/fit/tailorPlan`, served by `POST /api/resume-fit`): entries, bullets and skills are copied verbatim from the Master CV, and a requirement the Master CV lacks is asked about ("I have this" adds it to the Master CV), never put on the page directly. Keep it that way: no control may add text to a resume that is not the user's own.
- **Next steps.** Dated activities live in `application_activities` (migration 020) and go through `@/server/activities/service`; every read handles the table being absent (`setupPending`). `suggestNextSteps` is a pure function over rows already loaded: add a rule there, with its reason sentence and a test, and never store or AI-generate a suggestion. A timed step keeps the IANA zone it was entered in.
- **Saved jobs.** A saved job (`job_opportunities`) keeps its context through tailoring and applying: documents target it by `opportunityId`, and applications are created through `insertApplication` so description, pay, workplace and resume carry over. Extension captures merge with the stored job (`keepStored`); the web editor is authoritative.
- **Offers.** An offer's terms and decision live in `application_offers` (migration 022) through `@/server/offers/service`; every read handles the table being absent. The decide-by date is not a column: it is the open `offer_deadline` step in `application_activities`, and a decided offer never gets one back. There is no "Accepted" status; the decision is on the offer.
- **Export.** `GET /api/export` streams everything the account holds (`@/server/export/exportData`). A new user-owned table needs a `SECTIONS` entry there (or a sentence in `NOT_INCLUDED`), and a column holding a credential, a hash of one or file bytes goes in `NEVER_EXPORT`. Write CSV with `toCsv` (`@/lib/csv`), which guards formula cells.
- **Import.** `planImport` (`@/server/applications/importPlan`) is pure and decides each row's outcome; the route re-plans from the uploaded file on commit and never trusts a plan from the browser. It may not fill in what the file lacks: an unknown status or unreadable pay is kept in the notes, and a row without a date is skipped unless the user chooses today's date.
- **Interview preparation.** `/applications/[id]/prepare` is built by `buildInterviewPrep` (`@/server/interviews/prepare`), pure and without AI, from the latest unsuperseded submission (else the application's current description and resume) and `assessFit`. Every statement about the user is a verbatim quote; new wording goes in its fixed strings, which a test checks the output against.
- **Watchlist.** `watched_companies` and `watched_postings` (migration 021) go through `@/server/watchlist/service`. The server fetches only the three fixed board API hosts in `@/server/watchlist/boards`, built from a platform and a checked token, never a URL from the user or from a board's response; board text is untrusted and passes through `htmlToText`/`cleanText`. Users cannot write `last_checked_at`, `last_error` or `open_count`: use the `record_watch_check` RPC. Another board platform is a new adapter there with recorded-shape tests.
- **Dashboard figures.** Rates are descriptive: count applications applied `RESPONSE_WINDOW_DAYS` (14) or more days ago, show "x of N", and give no percentage for fewer than `MIN_GROUP_SIZE` (5) (`@/features/dashboard/report`). A row whose first status is Reached Out was never applied to (`startedAsOutreach`): it is left out of the rates and the Search report and counted apart. No median time to first reply from fewer than `MIN_TIMING_SAMPLES` (5) replies. No advice, predictions or causal claims.
- **Alert rows.** `findAlertRows` (`@/features/applications/alertRows`, pure) lists email-created rows that never left Reached Out or Pending and read like job alerts; the applications page asks about them (`AlertRowsReview`). It only ever proposes: removal is the user's choice, and a row the user added, applied to, moved or linked a resume to is never listed.
- **Gmail.** "Connect Gmail with Google" (`/api/gmail/connect` → Google → `/api/gmail/callback`, logic in `@/server/email/gmailConnect`) asks only for `gmail.readonly`, binds the state to the signed-in user in an httpOnly cookie on `/api/gmail`, and stores the refresh token encrypted in `email_connections.oauth_refresh_token` with `provider = 'gmail'` (migration 023; `NEVER_EXPORT`). `@/server/email/gmailClient` calls only Google's fixed OAuth and Gmail hosts and returns the same message shape as the IMAP reader, so classification, matching and review are shared. Replacing or disconnecting a Gmail connection revokes the token. Every connection read falls back to IMAP-only columns before migration 023, and the button is hidden until both Google keys are set. A Gmail scan skips the message ids in `email_connections.gmail_seen_ids` (migration 024): only ids the scan finished with (already processed, never a candidate, or recorded) are added, so deferred or failed messages are read again.
- **Matching applications.** New submissions and confirmations only merge into an open application from the same hiring cycle (`isSameCycle`, 120 days); otherwise they're new. Email never changes applications directly: it writes `application_suggestions` for the user to approve.
- **Loading and layout.** Each `(app)` route has a `loading.js` shaped like its page (`@/components/shared/PageSkeletons`); keep them in step with page layout changes. The header is a fixed 73px, so pages start at `pt-[85px]` and the editors at `top-[73px]`.
- **Migrations.** Add a new numbered file in `supabase/migrations/`; never edit an applied one. The user runs it in the SQL editor, so code must keep working until it's applied (fail open, or check the column exists, as `insertApplication` (`@/server/applications/insertApplication`) and `enforceRateLimit` do). Enable RLS on every new table.
- **Page fidelity.** The editors' pages (`.rb-paper` and `.rb-letter` in globals.css) are calibrated to the LaTeX in `src/server/latex.js` (`generateLatex`, `generateCoverLetterLatex`). If you change the LaTeX spacing, margins or fonts, re-measure against a compiled PDF and update the CSS, or the one-page estimate drifts.

## API Routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `POST /api/generate-resume` | Align the master CV to a job description and store a resume |
| `POST /api/generate-cover-letter` | Draft cover letter paragraphs from the CV and job description (tone, length; flags technologies the CV doesn't have) |
| `POST /api/tailor-resume` | AI pick of master CV entries for a job; no longer called by the editor, which uses `/api/resume-fit` |
| `POST /api/suggest-bullets` | Suggest edits to resume bullets (`focus`: "match" a job, or "concise" to fit one page) |
| `POST /api/rewrite-bullet` | Three AI rewrites of one bullet (stronger, tailored, shorter) |
| `POST /api/resume-pages` | Compile the saved resume and return the PDF's page count |
| `POST /api/ats-score` | Heuristic ATS keyword/section score (no AI) |
| `POST /api/resume-fit` | Fit of the Master CV for a job, a tailoring plan and what the resume leaves out (no AI) |
| `POST /api/parse-resume` | Parse an uploaded PDF/.txt resume into the master CV |
| `POST /api/download-resume` | Render a resume to LaTeX and compile to PDF (latex.ytotech.com) |
| `POST /api/download-cover-letter` | Same for a cover letter |
| `POST /api/resume-readability` | Compile the saved resume and report which of its own lines a PDF text extractor reads back (no AI, descriptive only) |
| `POST /api/cover-letter-pages` | Compile the saved cover letter and return the PDF's page count |
| `POST /api/rewrite-paragraph` | Three AI rewrites of one cover letter paragraph |
| `GET/POST/DELETE /api/email-settings` | Manage the IMAP connection (password encrypted) |
| `POST /api/scan-emails` | Scan recent email and queue application suggestions for review |
| `GET /api/extension/me` | Browser extension: check its token, return who it's connected as |
| `POST /api/extension/applications` | Browser extension: add the application the user just submitted (or fill in the tracked one) |
| `DELETE /api/extension/applications/[id]` | Browser extension: undo an addition (same day, still at Applied) |
| `GET /api/cron/email-sync` | Daily auto-sync for users who turned it on (Vercel Cron, `Authorization: Bearer $CRON_SECRET`) |
| `GET /api/export` | Everything the account holds as streamed JSON; `?format=csv` for all applications (never credentials or hashes) |
| `POST /api/import-applications` | CSV import: `preview` plans every row, `commit` re-plans and inserts (multipart, 1 MB, 500 rows) |
| `GET /api/cron/watchlist` | Daily re-read of watched companies' boards (Vercel Cron, same authorization) |
| `GET /api/gmail/connect` | Send the signed-in user to Google's consent page for read-only Gmail |
| `GET /api/gmail/callback` | Finish the Google round trip, store the Gmail connection, return to `/email-sync?gmail=<outcome>` |

## Database (Supabase)

Key tables: `profiles`, `cv_experience` (+ `_bullets`), `cv_projects` (+ `_bullets`), `cv_education`, `cv_skills`, `cv_certifications`, `applications`, `application_status_history` (trigger-logged), `resumes` (`content` JSONB), `cover_letters` (Draft.js JSONB), `email_connections` (+ `auto_sync`), `processed_emails`, `application_suggestions`, `api_rate_limits`, `auth_rate_limits` (hashed IP/email buckets for sign-in, sign-up and reset), `extension_tokens` (hashed; the extension's credentials), `job_opportunities` (saved jobs, migration 013), `application_activities` (dated next steps, migration 020), `watched_companies` and `watched_postings` (watchlist, migration 021), `application_offers` (offer terms and decision, migration 022). `email_connections.provider` is `imap` or `gmail` (migration 023). `applications.source` is `manual`, `email` or `extension`; migration 010 adds job details (`salary_min`/`salary_max`/`salary_currency`/`salary_period`, `workplace_type`, `employment_type`, `source_site`), built by `jobDetailColumns` (`@/lib/jobDetails`, pay parsed by `@/lib/salary`). Matching across hiring cycles: `isSameCycle` (`@/server/email/matching`), open and applied within 120 days. Goals are `profiles.goal_period` / `goal_target`. RLS is enabled on every table.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
APP_ENCRYPTION_KEY=   # base64 32 bytes: openssl rand -base64 32 (server-only)
OPENAI_MODEL=         # optional; defaults to gpt-6-luna
SUPABASE_SERVICE_ROLE_KEY=  # server-only; daily email sync, extension API, auth rate limits
CRON_SECRET=          # Vercel sends it as a Bearer token to /api/cron/*
NEXT_PUBLIC_EXTENSION_ID=   # optional; lets /extension/connect use externally_connectable
GOOGLE_CLIENT_ID=           # optional; with the secret, shows "Connect Gmail with Google" in Inbox
GOOGLE_CLIENT_SECRET=       # optional, server-only
```

Never print or commit `.env.local` values.

## Deployment and workflow

- Personal project: commit and push straight to `main` (no PRs). Vercel deploys `main`; check the commit status after pushing.
- Vercel Hobby: the maximum duration is 300 seconds with Fluid Compute, 60 without it. Check the project's Functions settings before raising limits; scan and cron routes currently set `maxDuration = 60`. See [README.md](README.md#deploying-to-vercel) for deployment configuration and the official limits.
- Verify email/AI changes with `npm test` under Node 24, then `npm run lint`, an isolated production build and relevant signed-in browser flows. Build outside output used by a running preview. For email matching, retries, approval concurrency or models, read [docs/email-sync-reliability.md](docs/email-sync-reliability.md); migration 011 is required for transactional approval and cross-instance scan locks.
- `vercel.json` runs `/api/cron/email-sync` daily at 12:00 UTC and `/api/cron/watchlist` at 13:00 UTC.
- An upgrade to Next.js 16.4 / React 19 is on the branch `claude/keen-roentgen-b7b6a5`. When it merges, update this file (versions, `proxy.js` instead of `middleware.js`, the lint command) and docs/ARCHITECTURE.md.
