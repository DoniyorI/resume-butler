# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Resume Butler is a job application tracker and resume builder: Next.js 14 (App Router, JavaScript) on Supabase (Postgres, Auth). AI features (resume alignment, cover letters, bullet suggestions, resume parsing, email classification) call OpenAI `gpt-4o-mini` from server code. Email sync reads the user's inbox over IMAP (a Gmail OAuth connection is planned), and the Chrome extension in `extension/` adds applications as the user submits them.

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
                          page.jsx (/) is the dashboard; the applications table is /applications
    (auth)/               login, register, forgot-password, reset-password (no nav)
    (marketing)/          about, contact (public, static)
    api/*/route.js        Route Handlers (uploads, downloads, AI, email scan, the extension API)
    api/cron/*            Scheduled jobs (vercel.json crons), authorized by CRON_SECRET
    auth/callback/        Exchanges OAuth / email-link codes for a session
  features/<feature>/     UI and logic per feature: applications, ats, auth, contact,
                          cover-letters and resumes (the editors live in each one's studio/ folder
                          and share resumes/studio's page canvas and toolbar), cv (data + actions only), dashboard,
                          documents (resume + cover letter library), email-sync, profile (profile and
                          master CV page), suggestions (email review queue), extension (connect page)
    actions.js            Server Actions for that feature ("use server")
    data.js               Server-only reads and snake_case -> camelCase mapping
    hooks/                Client hooks for that feature
  components/
    ui/                   shadcn/ui primitives only (kebab-case files)
    layout/               NavBar (signed in), PublicHeader (visitors), MarketingHeader (picks one), Footer
    shared/               App-wide widgets (ErrorState, LocalDateTime, PageSkeletons for loading.js)
  lib/                    Code safe on client and server: constants, dates, safeUrl, redirects, postJson,
                          salary, jobDetails, emailCategories, supabase server and middleware clients
                          (there is no browser client)
  server/                 Server-only code (`import "server-only"`), reusable by actions, routes, cron and the extension:
    auth.js               getCurrentUser (cached per request), requirePageUser, requireUser, hasRecentRecovery
    actionResult.js       runAction / parseInput for Server Actions
    http.js               HttpError, parseJson, errorResponse for Route Handlers
    openai.js, rateLimit.js (per user), authRateLimit.js (per IP and email, signed out), crypto.js, latex.js
    ats/                  ATS scoring (scoreResume)
    email/                IMAP client, classification, matching, connection settings, syncEmailsForUser,
                          autoSync (the daily job)
    supabaseAdmin.js      Service-role client (bypasses RLS): cron, extension API, auth rate limits
    extension/            Extension tokens (authenticateExtension) and recordApplication / undoApplication
    resume/               loadCv, tailorResume, generateResume, coverLetter, suggestBullets,
                          rewriteBullet, guardrails (blocks AI edits that add or swap facts),
                          parseResume, renderResume
  middleware.js           Refreshes the session and routes signed-out visitors (pages only, skips /api)
supabase/migrations/      SQL schema, 001-010; apply in order in the Supabase SQL editor
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
- **Matching applications.** New submissions and confirmations only merge into an open application from the same hiring cycle (`isSameCycle`, 120 days); otherwise they're new. Email never changes applications directly: it writes `application_suggestions` for the user to approve.
- **Loading and layout.** Each `(app)` route has a `loading.js` shaped like its page (`@/components/shared/PageSkeletons`); keep them in step with page layout changes. The header is a fixed 73px, so pages start at `pt-[85px]` and the editors at `top-[73px]`.
- **Migrations.** Add a new numbered file in `supabase/migrations/`; never edit an applied one. The user runs it in the SQL editor, so code must keep working until it's applied (fail open, or check the column exists, as `writeWithDetails` and `enforceRateLimit` do). Enable RLS on every new table.
- **Page fidelity.** The editors' pages (`.rb-paper` and `.rb-letter` in globals.css) are calibrated to the LaTeX in `src/server/latex.js` (`generateLatex`, `generateCoverLetterLatex`). If you change the LaTeX spacing, margins or fonts, re-measure against a compiled PDF and update the CSS, or the one-page estimate drifts.

## API Routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `POST /api/generate-resume` | Align the master CV to a job description and store a resume |
| `POST /api/generate-cover-letter` | Draft cover letter paragraphs from the CV and job description (tone, length; flags technologies the CV doesn't have) |
| `POST /api/tailor-resume` | Pick the master CV entries that fit a job (previewed, then applied in the editor) |
| `POST /api/suggest-bullets` | Suggest edits to resume bullets (`focus`: "match" a job, or "concise" to fit one page) |
| `POST /api/rewrite-bullet` | Three AI rewrites of one bullet (stronger, tailored, shorter) |
| `POST /api/resume-pages` | Compile the saved resume and return the PDF's page count |
| `POST /api/ats-score` | Heuristic ATS keyword/section score (no AI) |
| `POST /api/parse-resume` | Parse an uploaded PDF/.txt resume into the master CV |
| `POST /api/download-resume` | Render a resume to LaTeX and compile to PDF (latex.ytotech.com) |
| `POST /api/download-cover-letter` | Same for a cover letter |
| `POST /api/cover-letter-pages` | Compile the saved cover letter and return the PDF's page count |
| `POST /api/rewrite-paragraph` | Three AI rewrites of one cover letter paragraph |
| `GET/POST/DELETE /api/email-settings` | Manage the IMAP connection (password encrypted) |
| `POST /api/scan-emails` | Scan recent email and queue application suggestions for review |
| `GET /api/extension/me` | Browser extension: check its token, return who it's connected as |
| `POST /api/extension/applications` | Browser extension: add the application the user just submitted (or fill in the tracked one) |
| `DELETE /api/extension/applications/[id]` | Browser extension: undo an addition (same day, still at Applied) |
| `GET /api/cron/email-sync` | Daily auto-sync for users who turned it on (Vercel Cron, `Authorization: Bearer $CRON_SECRET`) |

## Database (Supabase)

Key tables: `profiles`, `cv_experience` (+ `_bullets`), `cv_projects` (+ `_bullets`), `cv_education`, `cv_skills`, `cv_certifications`, `applications`, `application_status_history` (trigger-logged), `resumes` (`content` JSONB), `cover_letters` (Draft.js JSONB), `email_connections` (+ `auto_sync`), `processed_emails`, `application_suggestions`, `api_rate_limits`, `auth_rate_limits` (hashed IP/email buckets for sign-in, sign-up and reset), `extension_tokens` (hashed; the extension's credentials). `applications.source` is `manual`, `email` or `extension`; migration 010 adds job details (`salary_min`/`salary_max`/`salary_currency`/`salary_period`, `workplace_type`, `employment_type`, `source_site`), built by `jobDetailColumns` (`@/lib/jobDetails`, pay parsed by `@/lib/salary`). Matching across hiring cycles: `isSameCycle` (`@/server/email/matching`), open and applied within 120 days. Goals are `profiles.goal_period` / `goal_target`. RLS is enabled on every table.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
APP_ENCRYPTION_KEY=   # base64 32 bytes: openssl rand -base64 32 (server-only)
OPENAI_MODEL=         # optional; defaults to gpt-4o-mini
SUPABASE_SERVICE_ROLE_KEY=  # server-only; daily email sync, extension API, auth rate limits
CRON_SECRET=          # Vercel sends it as a Bearer token to /api/cron/*
NEXT_PUBLIC_EXTENSION_ID=   # optional; lets /extension/connect use externally_connectable
```

Never print or commit `.env.local` values.

## Deployment and workflow

- Personal project: commit and push straight to `main` (no PRs). Vercel deploys `main`; check the commit status after pushing.
- Vercel Hobby: `maxDuration` must be 60 or less on every route, or every deploy fails.
- No automated tests: verify with `npm run lint`, a production build, and the pages in a browser (signed in and signed out).
- `vercel.json` runs `/api/cron/email-sync` daily at 12:00 UTC.
- An upgrade to Next.js 16.4 / React 19 is on the branch `claude/keen-roentgen-b7b6a5`. When it merges, update this file (versions, `proxy.js` instead of `middleware.js`, the lint command) and docs/ARCHITECTURE.md.
