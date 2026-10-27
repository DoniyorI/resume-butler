# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Resume Butler is a job application tracker and resume builder: Next.js 14 (App Router, JavaScript) on Supabase (Postgres, Auth). AI features (resume alignment, cover letters, bullet suggestions, resume parsing, email classification) call OpenAI `gpt-4o-mini` from server code. Email sync reads the user's inbox over IMAP; a Gmail OAuth connection and a Chrome extension are planned.

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
    (auth)/               login, register, forgot-password (no nav)
    (marketing)/          about, contact (public)
    api/*/route.js        Route Handlers (uploads, downloads, AI, email scan, future extension API)
    api/cron/*            Scheduled jobs (vercel.json crons), authorized by CRON_SECRET
    auth/callback/        Exchanges OAuth / email-link codes for a session
  features/<feature>/     UI and logic per feature: applications, ats, auth, contact,
                          cover-letters and resumes (editors; resumes/studio is the new resume
                          editor at /resumes/[id]/new), cv (data + actions only), dashboard,
                          documents (resume + cover letter library), email-sync, profile (profile and
                          master CV page), suggestions
    actions.js            Server Actions for that feature ("use server")
    data.js               Server-only reads and snake_case -> camelCase mapping
    hooks/                Client hooks for that feature
  components/
    ui/                   shadcn/ui primitives only (kebab-case files)
    layout/               NavBar, Footer, PublicHeader
    shared/               App-wide widgets (ErrorState, LocalDateTime, SidePanel, ViewSwitch)
  lib/                    Code safe on client and server: constants, dates, safeUrl, redirects, postJson, supabase clients
  server/                 Server-only code (`import "server-only"`), reusable by actions, routes, cron and the extension:
    auth.js               getCurrentUser (cached per request), requirePageUser, requireUser
    actionResult.js       runAction / parseInput for Server Actions
    http.js               HttpError, parseJson, errorResponse for Route Handlers
    openai.js, rateLimit.js, crypto.js, latex.js
    ats/                  ATS scoring (scoreResume)
    email/                IMAP client, classification, matching, connection settings, syncEmailsForUser,
                          autoSync (the daily job)
    supabaseAdmin.js      Service-role client for jobs with no signed-in user (bypasses RLS)
    resume/               loadCv, tailorResume, generateResume, coverLetter, suggestBullets,
                          rewriteBullet, guardrails (blocks AI edits that add or swap facts),
                          parseResume, renderResume
  middleware.js           Refreshes the session and redirects signed-out visitors
supabase/migrations/      SQL schema; apply in order
```

## Conventions

- **Service role.** Only scheduled jobs use `createAdminClient()` (`@/server/supabaseAdmin`). It bypasses RLS, so every query made with it must filter by `user_id`.
- **Auth.** Use `getUser()` on the server, never `getSession()`, for any decision. Pages: `requirePageUser()` from `@/server/auth` (redirects). Route Handlers and Server Actions: `requireUser()` (throws a 401 `HttpError`). The user ID is `user.id`.
- **Reads.** Fetch in Server Components with the server client (`@/lib/supabase/server`) and pass plain data to client components. Avoid `useEffect` fetching for initial data.
- **Writes.** Use Server Actions in `features/<feature>/actions.js`, wrapped in `runAction` with input checked by `parseInput` (zod): check the user, scope queries by `user_id`, call `revalidatePath`, and return `{ ok: true, data }` or `{ ok: false, error }` with a user-safe message. Call `redirect()` outside `runAction` (it works by throwing). Don't write to Supabase directly from the browser; the browser client is only for sign-in/sign-out.
- **Business logic** that more than one entry point needs (route, action, future cron or extension) goes in `src/server/<domain>/` as functions taking `(supabase, userId, input)`.
- **Route Handlers** stay for file uploads, binary downloads, streaming, long-running jobs and anything the future Chrome extension will call. Use `parseJson(request, schema)` and `errorResponse(error, context)` from `@/server/http`, and `enforceRateLimit` for expensive routes.
- **Client components** carry `"use client"` only where they need state, effects or browser APIs. Keep them small and push data loading up to the page.
- **Untrusted content.** Never use `dangerouslySetInnerHTML`. Render links through `safeHttpUrl` / save through `normalizeHttpUrl` (`@/lib/safeUrl`). Treat LLM output, emails and uploaded files as untrusted: validate and cap before writing.
- **Shared values.** Statuses and colors come from `@/lib/constants`; dates are formatted with `@/lib/dates`; the brand color is the Tailwind `brand` token.
- **Naming.** Components are PascalCase `.jsx`; hooks, lib and server modules are camelCase `.js`. Import with the `@/` alias.
- **Database** fields are snake_case; frontend state is camelCase, mapped in `data.js` / at the query boundary.
- **Feedback.** Use `toast` from `sonner`, not `alert()`.
- **AI edits to user text** go through `checkRewrite` (`@/server/resume/guardrails`): a suggestion may never add or swap a technology, or drop a fact, the user wrote.
- **Resume page fidelity.** The editor's page (`.rb-paper` in globals.css) is calibrated to the LaTeX PDF in `src/server/latex.js`. If you change the LaTeX spacing, margins or fonts, re-measure and update the CSS, or the one-page estimate drifts.

## API Routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `POST /api/generate-resume` | Align the master CV to a job description and store a resume |
| `POST /api/generate-cover-letter` | Draft a cover letter from the CV and job description |
| `POST /api/tailor-resume` | Pick the master CV entries that fit a job (previewed, then applied in the editor) |
| `POST /api/suggest-bullets` | Suggest edits to resume bullets (`focus`: "match" a job, or "concise" to fit one page) |
| `POST /api/rewrite-bullet` | Three AI rewrites of one bullet (stronger, tailored, shorter) |
| `POST /api/resume-pages` | Compile the saved resume and return the PDF's page count |
| `POST /api/ats-score` | Heuristic ATS keyword/section score (no AI) |
| `POST /api/parse-resume` | Parse an uploaded PDF/.txt resume into the master CV |
| `POST /api/download-resume` | Render a resume to LaTeX and compile to PDF (latex.ytotech.com) |
| `GET/POST/DELETE /api/email-settings` | Manage the IMAP connection (password encrypted) |
| `POST /api/scan-emails` | Scan recent email and queue application suggestions for review |
| `GET /api/cron/email-sync` | Daily auto-sync for users who turned it on (Vercel Cron, `Authorization: Bearer $CRON_SECRET`) |

## Database (Supabase)

Key tables: `profiles`, `cv_experience` (+ `_bullets`), `cv_projects` (+ `_bullets`), `cv_education`, `cv_skills`, `cv_certifications`, `applications`, `application_status_history` (trigger-logged), `resumes` (`content` JSONB), `cover_letters` (Draft.js JSONB), `email_connections` (+ `auto_sync`), `processed_emails`, `application_suggestions`, `api_rate_limits`. Goals are `profiles.goal_period` / `goal_target`. RLS is enabled on every table.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
APP_ENCRYPTION_KEY=   # base64 32 bytes: openssl rand -base64 32 (server-only)
OPENAI_MODEL=         # optional; defaults to gpt-4o-mini
SUPABASE_SERVICE_ROLE_KEY=  # server-only; the daily email sync job
CRON_SECRET=          # Vercel sends it as a Bearer token to /api/cron/*
```
