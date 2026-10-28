# Resume Butler architecture

A complete map of the app: what it does, how it's built, where each piece lives and how the pieces talk to each other. Written for anyone (person or LLM) picking up the codebase cold. For day-to-day coding rules, see [CLAUDE.md](../CLAUDE.md). For setup, see [README.md](../README.md).

Last reviewed: 2026-10-28, on `main` (Next.js 14.2). An upgrade to Next.js 16.4 / React 19 lives on the branch `claude/keen-roentgen-b7b6a5`; see [Upgrades in flight](#upgrades-in-flight).

## Contents

1. [What the app does](#what-the-app-does)
2. [Tech stack](#tech-stack)
3. [How a request flows](#how-a-request-flows)
4. [Folder map](#folder-map)
5. [Pages](#pages)
6. [Features in depth](#features-in-depth)
7. [API routes](#api-routes)
8. [Server Actions](#server-actions)
9. [Server services (`src/server`)](#server-services-srcserver)
10. [Shared client and server code (`src/lib`)](#shared-client-and-server-code-srclib)
11. [Database](#database)
12. [AI](#ai)
13. [PDF and LaTeX](#pdf-and-latex)
14. [Email sync pipeline](#email-sync-pipeline)
15. [Chrome extension](#chrome-extension)
16. [Authentication and security](#authentication-and-security)
17. [Design system](#design-system)
18. [Deployment and operations](#deployment-and-operations)
19. [Known gaps and decisions](#known-gaps-and-decisions)
20. [Upgrades in flight](#upgrades-in-flight)

---

## What the app does

Resume Butler is a job search workspace for one person at a time:

- **Track applications** in a table and on a dashboard (statuses, follow-ups, goals, charts).
- **Keep one master CV** (experience, projects, education, skills, certifications), imported from an existing resume or typed in.
- **Build tailored resumes and cover letters** per job: pick master CV entries that fit a job description, get AI wording suggestions that may not invent facts, check an ATS-style keyword score, and export a LaTeX-compiled PDF.
- **Sync email**: scan the inbox (IMAP) for confirmations, interview invites, assessments, offers and rejections, and queue suggested additions or status changes for the user to approve. Optional daily auto-sync.
- **Chrome extension**: detects submitted applications on LinkedIn Easy Apply, Greenhouse, Lever and Ashby, and adds them to the tracker automatically, with the job description and details.

Core principle: **the user's own words and facts**. AI may pick, reorder and reword, never add a technology, a claim or a number the user didn't write (enforced in code, see [AI](#ai)). Nothing from an email changes the tracker without approval.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14.2 App Router, JavaScript (no TypeScript) | Server Components, Server Actions, Route Handlers, middleware |
| UI | React 18, Tailwind CSS 3, shadcn/ui (Radix primitives), lucide-react icons, sonner toasts | `src/components/ui` holds the shadcn primitives |
| Tables | @tanstack/react-table | Applications table |
| Charts | recharts (incl. Sankey) | Loaded lazily on the dashboard |
| Drag and drop | @hello-pangea/dnd | Resume section order |
| Forms | react-hook-form + zod in a few forms; most forms use plain state | zod is the validation layer everywhere on the server |
| Dates | date-fns, plus `@/lib/dates` helpers | Plain `YYYY-MM-DD` dates are read as local dates |
| Database and auth | Supabase: Postgres with row-level security, Supabase Auth (email/password, Google OAuth), `@supabase/ssr` | Server-side client only; no Supabase client ships to the browser |
| AI | OpenAI chat completions, `gpt-6-luna` by default (`OPENAI_MODEL` overrides) | JSON-mode responses via `chatJSON` |
| PDF | LaTeX generated on the server, compiled by the YtoTech LaTeX-on-HTTP service (`latex.ytotech.com`) | Falls back to returning the `.tex` source |
| Email | `imap` + `mailparser` | Read-only IMAP over TLS to an allowlist of hosts |
| Resume import | `pdf2json` | PDF or `.txt`, then the AI structures it |
| Contact form | EmailJS (browser SDK) | Public, client-side IDs |
| Extension | Chrome Manifest V3, plain JS, no build step | `extension/` |
| Hosting | Vercel (Hobby plan), Vercel Cron | Hobby maximum: 300 seconds with Fluid Compute, 60 without; scan and cron routes explicitly use 60 |
| Tooling | ESLint (`next/core-web-vitals`), Prettier, Node 24 test runner | Email/AI regression suite via `npm test` |
| Runtime | Node.js 24.x | `engines` in package.json |

## How a request flows

```
Browser ──► middleware.js ──► (app) layout ──► page.jsx (Server Component)
            refresh session     requirePageUser()   reads with the server Supabase client
            route by sign-in                         passes plain data to client components
                                                            │
             client component ◄─────────────────────────────┘
                 │  user edits
                 ├──► Server Action (features/<feature>/actions.js)
                 │       runAction + parseInput(zod) → requireUser() → query scoped by user_id
                 │       → revalidatePath → { ok, data } | { ok: false, error }
                 └──► Route Handler (app/api/*/route.js) for AI, uploads, PDFs, email scans, the extension
                         requireUser() / authenticateExtension() → parseJson(zod) → enforceRateLimit
                         → src/server/<domain> service → JSON (errors via errorResponse)
```

- **Reads** happen in Server Components with `createClient()` from `@/lib/supabase/server` (acts as the user; RLS applies). Independent queries run in `Promise.all`; detail loaders are wrapped in React `cache()` so `generateMetadata` and the page share one query.
- **Writes** are Server Actions. Route Handlers are kept for what actions can't or shouldn't do: file uploads, binary downloads, long AI or IMAP jobs, and anything the extension or cron calls.
- **Business logic** shared by several entry points lives in `src/server/<domain>/` as functions taking `(supabase, userId, input)`.

## Folder map

```
src/
  middleware.js              Session refresh and sign-in routing for pages (skips /api)
  app/                       Routes only; pages stay thin
    layout.js                Root: Inter font, globals.css, <Toaster>
    (app)/                   Signed-in app. layout.js: requirePageUser() + NavBar + Footer
      page.jsx               Dashboard (/)
      applications/          Table (/applications) and detail (/applications/[id])
      documents/             Resume and cover letter library
      profile/               Profile and master CV
      email-sync/            Email connection, scans, suggestion review
      extension/             Manage extension connections; connect/ = one-step connect page
      resumes/[resumeId]/    Resume editor ("studio")
      coverletters/[coverLetterId]/  Cover letter editor
      loading.js, error.js   Per-route skeletons (src/components/shared/PageSkeletons.jsx), error page
    (auth)/                  login, register, forgot-password, reset-password (no nav)
    (marketing)/             about, contact (public, static)
    api/*/route.js           Route Handlers (see API routes)
    auth/callback/route.js   Exchanges OAuth / email-link codes for a session
    not-found.js, global-error.js, icon.svg, globals.css
  features/<feature>/        UI and logic per feature
    actions.js               Server Actions ("use server")
    data.js                  Server-only reads, snake_case → camelCase
    hooks/                   Client hooks
    *.jsx                    Feature components
  components/
    ui/                      shadcn/ui primitives (kebab-case files)
    layout/                  NavBar, PublicHeader, MarketingHeader, Footer
    shared/                  ErrorState, LocalDateTime, PageSkeletons
  lib/                       Safe on client and server: constants, dates, redirects, safeUrl,
                             salary, jobDetails, emailCategories, postJson, utils, supabase clients
  server/                    Server-only ("server-only" import), reusable by actions, routes, cron, extension
supabase/migrations/         SQL schema, applied in order (001–011)
extension/                   Chrome extension (see its README)
docs/                        This file, the extension plan
public/image/                Logo, illustrations, Lottie animations
vercel.json                  Cron schedule
next.config.mjs              Security headers (CSP etc.), redirects, server external packages
```

Feature folders: `applications`, `ats`, `auth`, `contact`, `cover-letters`, `cv` (data and actions only), `dashboard`, `documents`, `email-sync`, `extension`, `profile`, `resumes`, `suggestions`.

## Pages

| Path | File | What it shows |
|---|---|---|
| `/` | `(app)/page.jsx` | Dashboard: welcome, stat cards, goal, email sync card, follow-ups, recent applications, charts |
| `/applications` | `(app)/applications/page.jsx` | Applications table (URL-driven filters, sort, pages of 50), suggestions banner |
| `/applications/[id]` | `(app)/applications/[id]/page.jsx` | Application detail: facts, editable details, job description, notes, ATS scanner, status timeline, linked documents |
| `/documents` | `(app)/documents/page.jsx` | Library of resumes and cover letters with page thumbnails, search, tabs, sort |
| `/profile` | `(app)/profile/page.jsx` | Profile (identity rail, CV strength) and master CV sections, resume import |
| `/email-sync` | `(app)/email-sync/page.jsx` | IMAP connection, Gmail setup guide, scan options and results, scan history, suggestion review |
| `/extension` | `(app)/extension/page.jsx` | Connected browsers (tokens), disconnect, connect manually |
| `/extension/connect` | `(app)/extension/connect/page.jsx` | One-step connect page the extension opens after install |
| `/resumes/[resumeId]` | `(app)/resumes/[resumeId]/page.jsx` | Resume studio |
| `/coverletters/[coverLetterId]` | `(app)/coverletters/[coverLetterId]/page.jsx` | Cover letter studio |
| `/login`, `/register`, `/forgot-password` | `(auth)/…` | Email/password and Google sign-in, sign-up, reset request |
| `/reset-password` | `(auth)/reset-password/page.jsx` | Choose a new password (only within 15 minutes of following the reset link) |
| `/about`, `/contact` | `(marketing)/…` | Public pages, statically rendered |

Redirects in `next.config.mjs`: `/cv` → `/profile`, `/resumes` and `/coverletters` → `/documents`, `/dash` → `/`, and the old `…/new` editor URLs to the current editors.

## Features in depth

### Dashboard (`features/dashboard`)
- `data.js` computes everything server-side from `applications` and `application_status_history`: totals and this week's count, response rate, offer rate, average days from Applied to first Interviewed, follow-ups (still at Applied 14+ days after applying, oldest first), recent applications, applications over time, status breakdown, and Sankey nodes and links (forward transitions only, so the graph stays acyclic).
- `GoalCard`: "apply to N jobs a day/week" with progress, streak and what's left (weeks start Monday; saved by `saveGoal` to `profiles.goal_period/goal_target`).
- `SyncCard`: email connection status, pending suggestions, "Scan now", daily auto-sync toggle.
- `Charts.jsx` is loaded through `LazyCharts.jsx` (dynamic import) to keep recharts out of the first load.

### Applications (`features/applications`)
- **Table** (`ApplicationTable`, `columns.jsx`, `useApplicationsTable`): TanStack Table. The URL is the state (`listParams.js`): `?status=…&q=…&from=…&to=…&sort=applied_date.desc&page=2`. Search, status filter with counts, date range, sorting, column visibility, pages of 50, row selection with bulk status change and delete (`BulkActions`), inline status (`StatusCell`) and comments (`CommentsCell`), row actions (duplicate, delete), CSV export (`csv.js` neutralizes spreadsheet formulas).
- **Add** (`AddApplication`): dialog from the header; can link a resume or cover letter.
- **Detail** (`ApplicationEditor`): breadcrumb, status select beside the title, a facts row (pay, workplace, employment type, location, applied date, source, posting link), editable details including the pay range (once migration 010 is applied), job description as readable text with Edit / Show more, notes, the ATS scanner when a resume is linked, status timeline, linked documents. Status saves instantly; everything else saves with Save (an "unsaved changes" hint shows when something changed).
- **Email scan button** (`ScanEmailsButton`, `useEmailScan`) on the table header.

### Suggestions (`features/suggestions`)
- Email scans write `application_suggestions` (kind `new` or `update`), never applications directly.
- `SuggestionsReview` (on the email sync page) is a compact table: application, the status to set (for updates, current → new), the email it came from; inline edit of company and role, Dismiss, Add/Update, Approve all, Dismiss all.
- `SuggestionsBanner` on the applications page points to pending ones.

### Master CV and profile (`features/profile`, `features/cv`)
- `CareerProfile`: `IdentityRail` (name, contact links, location) with a CV strength meter (`strength.js`: checks that link to the section that fixes them), plus sections for experience, projects, education, skills (grouped by category) and certifications. Each entry edits in a dialog (`EditDialog`, `useEntryList`).
- Writes go through `features/cv/actions.js` (`saveExperience`, `saveProjects`, `saveEducation`, `saveCertifications`, `addSkill`, and the deletes) and `features/profile/actions.js` (`updateProfile`).
- **Import**: `/api/parse-resume` takes a PDF or `.txt` (size-capped, PDF detected by magic bytes), extracts text with pdf2json, has the model structure it, and inserts entries (capped rows and text). It only adds; nothing is overwritten.

### Documents (`features/documents`)
- `DocumentLibrary` lists resumes and cover letters together with live page thumbnails (`PaperPreview`), tabs (all, resumes, letters), search by name or company, sort, and dialogs to create, rename and delete (`DocumentDialogs`).

### Resume studio (`features/resumes`)
- **Content model** (`resumeDocument.js`): `resumes.content` JSONB `{ header, education, experience, projects, skills, order, target }`. `order` lists sections `{ id, title, hidden }`; `target` is the job `{ jobDescription, applicationId, company, role }`.
- **Layout** (`ResumeStudio`): toolbar (`StudioToolbar`: title, fit gauge, download), outline (`OutlinePanel`: drag to reorder sections, hide them), the editable page (`PaperCanvas`, `paper/*`: inline editing on a page styled like the PDF), and the assistant (`AssistantPanel`).
- **Autosave** (`useResumeDocument`, `useLetterDocument`): debounced, serialized saves with quiet Saved / Saving / Not saved feedback in the shared toolbar, including document-name writes. Failure details are available on the indicator. Routine renames and additions do not toast; unsaved content and names retain close-tab protection.
- **One-page fit** (`FitGauge`, pure decisions in `features/resumes/pageFit.js`): browser usage is an estimate. Target 90–100% is green; underfill and unverified overflow are amber. On resume overflow, a compiled PDF check (`/api/resume-pages`) starts automatically after a 1.5-second pause, with a 30-second automatic cooldown, bounded per-content caching and manual retry on failure. A server SHA-256 fingerprint must match the current printed content before confirmation. The real page count overrides the estimate: one page is labeled explicitly, multiple pages are red. The canvas boundary is labeled estimated. Screen typography is calibrated to LaTeX (see `.rb-paper`), but the percent is not a measurement of the PDF itself.
- **Assistant** (`studio/assistant/*`): `JobTarget` (pick an application's job description or paste one), `MatchCard` (ATS score via `/api/ats-score`, re-scored shortly after each edit by `useJobMatch`), `TailorPicks` (`/api/tailor-resume` picks master CV entries that fit; previewed, then applied), `ReviewList` (`/api/suggest-bullets` with focus "match" or "concise"), `CvLibrary` (add entries from the master CV), `BulletRewrite` (`/api/rewrite-bullet`: stronger, tailored, shorter variants).
- **Download** (`useResumeDownload`, `/api/download-resume`): PDF, or `.tex` if compiling fails.
- `/api/generate-resume` creates a new resume from the master CV entries that best fit a job.

### Cover letter studio (`features/cover-letters`)
- **Content model** (`letterDocument.js`): `cover_letters.content` JSONB `{ header, date, recipient, greeting, body, signOff, target }`. The body is stored as Draft.js raw JSON (`{ blocks: [{ text }] }`), the format letters were first saved in; the editor reads and writes it as paragraphs (draft-js itself is no longer a dependency).
- `LetterStudio`: `LetterPaper` (editable letter page, `.rb-letter` styles), `ParagraphList`, `LetterAssistant` (draft a letter from the CV and job via `/api/generate-cover-letter` with tone and length, rewrite one paragraph via `/api/rewrite-paragraph`; flags technologies the CV doesn't have). Autosave via `useLetterDocument`; PDF via `/api/download-cover-letter`, page check via `/api/cover-letter-pages`.

### ATS scanner (`features/ats`, `server/ats`)
- Heuristic, no AI, cheap enough to rerun on every edit. `scoreResume` combines keyword coverage (`keywords.js`: terms the job asks for, years of experience, crude stemming, `skills.js` aliases), section and header checks (`sections.js`), and bullet quality (`bullets.js`: strong vs weak opening verbs, metrics, length). `AtsScanner` / `AtsResults` / `ScoreRing` show it.

### Email sync (`features/email-sync`)
- `ConnectionCard`: IMAP host (allowlisted in `server/email/imapHosts.js`: Gmail, Outlook and Office 365, Yahoo, iCloud), email and app password (encrypted at rest, never sent back), with a Gmail app-password guide (`GmailSetupGuide`).
- `ScanOptions`: date range (default the last 14 days) and categories (confirmations, interviews, assessments, offers, rejections on by default; recruiter outreach opt-in).
- `ScanResults`, `ScanHistory`, `AutoSyncToggle` (daily auto-sync, see the [pipeline](#email-sync-pipeline)).

### Extension pages (`features/extension`)
- `ConnectFlow` (`/extension/connect`): finds the extension (`handoff.js`), checks whether it's already connected to this account, otherwise creates a token (`connectExtension`) and hands it over by `postMessage` (or `externally_connectable` when `NEXT_PUBLIC_EXTENSION_ID` is set). States: checking, connecting, connected, already, missing, error.
- `ConnectExtension` (`/extension`): list of connected browsers with last use, disconnect (`revokeExtensionToken`), manual connect.

### Auth (`features/auth`)
- `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `GoogleAuthButton` call the Server Actions in `features/auth/actions.js` (`signIn`, `signUp`, `sendPasswordReset`, `updatePassword`, `startGoogleSignIn`, `signOut`). `AuthCarousel` (embla + Lottie) is lazy-loaded on the sign-in pages.

### Contact (`features/contact`)
- `ContactForm` (react-hook-form + zod) sends through EmailJS from the browser.

## API routes

All live in `src/app/api/`. Each uses `requireUser()` (or the extension token / cron secret), `parseJson(request, schema)` with a size cap, `errorResponse(error, context)`, and `enforceRateLimit` for anything costly.

| Route | Purpose | Rate limit key |
|---|---|---|
| `POST /api/generate-resume` | New resume from the master CV entries that fit a job | `generate-resume` |
| `POST /api/tailor-resume` | Pick master CV entries for a job (previewed in the editor) | `generate-resume` |
| `POST /api/suggest-bullets` | Edits to bullets for a job (`focus`: match or concise) | `suggest-bullets` |
| `POST /api/rewrite-bullet` | Three rewrites of one bullet | `rewrite-bullet` |
| `POST /api/rewrite-paragraph` | Three rewrites of one cover letter paragraph | `rewrite-bullet` |
| `POST /api/generate-cover-letter` | Draft a letter from the CV and job (tone, length) | `generate-cover-letter` |
| `POST /api/ats-score` | Heuristic ATS score (no AI) | none |
| `POST /api/parse-resume` | Import an uploaded PDF or `.txt` into the master CV | `parse-resume` |
| `POST /api/download-resume` | Resume to LaTeX to PDF (or `.tex`) | `download-resume` |
| `POST /api/resume-pages` | Compile and return the PDF's page count | `download-resume` |
| `POST /api/download-cover-letter` | Cover letter PDF (or `.tex`) | `download-resume` |
| `POST /api/cover-letter-pages` | Cover letter page count | `download-resume` |
| `GET/POST/DELETE /api/email-settings` | Read, save or remove the IMAP connection (password encrypted, never returned) | none |
| `POST /api/scan-emails` | Scan recent email and queue suggestions (`maxDuration` 60) | `scan-emails` |
| `GET /api/cron/email-sync` | Daily auto-sync (Vercel Cron, `Authorization: Bearer $CRON_SECRET`) | n/a |
| `GET /api/extension/me` | Extension: check its token, return who it's connected as | n/a |
| `POST /api/extension/applications` | Extension: add a submitted application, or fill in the tracked one | 60 per hour |
| `DELETE /api/extension/applications/[id]` | Extension: undo an addition (same day, still at Applied) | n/a |
| `GET /auth/callback` | Exchange an OAuth or email-link code for a session, then go to a safe `next` | n/a |

Per-user limits live in the `consume_rate_limit` database function (migrations 004 and 006), so callers can't change them.

## Server Actions

| File | Actions |
|---|---|
| `features/applications/actions.js` | `createApplication`, `updateApplication` (incl. optional `jobDetails`), `updateApplicationStatus`, `updateApplicationComments`, `bulkUpdateApplicationStatus`, `deleteApplications`, `deleteApplicationAndReturn`, `duplicateApplication`, `listLinkableDocuments` |
| `features/resumes/actions.js` | `createResume`, `renameResume`, `deleteResume`, `saveResumeContent`, `loadApplicationJob` |
| `features/cover-letters/actions.js` | `createCoverLetter`, `renameCoverLetter`, `deleteCoverLetter`, `saveCoverLetterContent` |
| `features/cv/actions.js` | `saveExperience`, `deleteExperience`, `saveProjects`, `deleteProject`, `saveEducation`, `deleteEducation`, `saveCertifications`, `deleteCertification`, `addSkill`, `deleteSkill` |
| `features/profile/actions.js` | `updateProfile` |
| `features/dashboard/actions.js` | `saveGoal` |
| `features/email-sync/actions.js` | `saveEmailConnection`, `disconnectEmail`, `setEmailAutoSync` |
| `features/suggestions/actions.js` | `approveSuggestion`, `dismissSuggestion`, `dismissAllSuggestions` |
| `features/extension/actions.js` | `connectExtension`, `revokeExtensionToken` |
| `features/auth/actions.js` | `signIn`, `signUp`, `sendPasswordReset`, `updatePassword`, `startGoogleSignIn`, `signOut` |

Every action is `runAction(context, async () => …)` with `parseInput(zodSchema, input)`, checks the user, scopes queries by `user_id`, revalidates what changed, and returns `{ ok: true, data }` or `{ ok: false, error }` with a user-safe message. `redirect()` is called outside `runAction` (it works by throwing).

## Server services (`src/server`)

| Module | What it does |
|---|---|
| `auth.js` | `getCurrentUser` (cached per request), `requirePageUser` (redirects), `requireUser` (401), `hasRecentRecovery` (reset-link session within 15 minutes, from timestamped `amr`) |
| `actionResult.js` | `runAction`, `parseInput` |
| `http.js` | `HttpError`, `parseJson` (size cap + zod), `errorResponse`, `jsonError`, `attachmentHeader` |
| `rateLimit.js` | `enforceRateLimit(supabase, key)`: per-user limits; fails open if the function is missing |
| `authRateLimit.js` | `enforceAuthRateLimit(kind, email)`: sign-in, sign-up, reset and password-update limits per visitor IP, IP + email, and email (hashed buckets, service role, migration 009); fails open |
| `supabaseAdmin.js` | `createAdminClient()`: service-role client for the cron job, the extension API and the auth limiter. Bypasses RLS: every query must filter by `user_id` |
| `crypto.js` | AES-256-GCM `encryptSecret` / `decryptSecret` with `APP_ENCRYPTION_KEY` (email app passwords) |
| `openai.js` | `chatJSON`: one JSON-mode chat completion |
| `latex.js` | `generateLatex`, `generateCoverLetterLatex`: every user value goes through `esc()` / `escUrl()` |
| `ats/*` | `scoreResume` and its parts (keywords, sections, bullets, skills aliases, resume text) |
| `resume/loadCv.js` | The user's profile and master CV as stored (with nested bullets) |
| `resume/generateResume.js`, `tailorResume.js` | Pick CV entries for a job (model output filtered to ids that exist, in CV order, capped) |
| `resume/suggestBullets.js`, `rewriteBullet.js`, `rewriteParagraph.js` | Wording suggestions, all passed through `guardrails.js` |
| `resume/guardrails.js` | `checkRewrite`: rejects AI edits that add or swap a technology, or drop a fact the user wrote |
| `resume/coverLetter.js` | Draft a letter body from the CV and job |
| `resume/parseResume.js` | Resume import (PDF/text → structured CV rows, capped) |
| `resume/renderResume.js`, `renderCoverLetter.js` | LaTeX → PDF via YtoTech; `countPdfPages` |
| `email/*` | IMAP client, host allowlist, classification, matching, scan options, connection storage, `syncEmailsForUser`, `runAutoSync` (see the [pipeline](#email-sync-pipeline)) |
| `extension/tokens.js` | `createExtensionToken` (hashed, retires the oldest beyond 5), `authenticateExtension` (bearer token → `{ admin, userId, tokenId }`) |
| `extension/applications.js` | `recordApplication` (dedupe, job details, fallback when migration 010 is missing), `undoApplication` |

## Shared client and server code (`src/lib`)

| Module | What it holds |
|---|---|
| `constants.js` | `APPLICATION_STATUSES` (Applied, Reached Out, Pending, Interviewed, Offered, Rejected, Withdrew; also enforced by the database), `STATUS_PROGRESSION`, `STATUS_COLORS`, `DEFAULT_STATUS`, `BRAND_COLOR`, `MIN_PASSWORD_LENGTH` |
| `dates.js` | `parseDate` (date-only strings as local dates), `formatMonthYear`, `formatShortDate` |
| `redirects.js` | Public and auth paths, `safeNextPath` (blocks open redirects such as `//evil.com`) |
| `safeUrl.js` | `safeHttpUrl` for rendering links, `normalizeHttpUrl` for saving them (http(s) only) |
| `salary.js` | `parseSalaryText` (pay ranges from posting text, ignoring "$40M raised"), `formatSalary` |
| `jobDetails.js` | `jobDetailColumns` (pay, workplace, employment type, source site from the extension's data or the description), labels |
| `emailCategories.js` | Scan categories, their implied status and defaults |
| `postJson.js` | Client helper for Route Handlers; throws the safe `{ error }` message |
| `supabase/server.js`, `supabase/middleware.js` | The two Supabase clients (there is no browser client) |
| `utils.js` | `cn()` for class names |

## Database

Supabase Postgres. **Row-level security is on for every table**; users can only touch their own rows. The service role (server only) bypasses RLS and is used only by the cron job, the extension API and the auth rate limiter, always filtering by `user_id`.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth user), name, email, phone, location, linkedin, github, portfolio, `goal_period`, `goal_target` | Created by the `handle_new_user` trigger on sign-up |
| `cv_experience` (+ `cv_experience_bullets`) | company, position, location, type, dates, `currently_working`, `sort_order` | Bullets ordered by `sort_order` |
| `cv_projects` (+ `cv_project_bullets`) | name, description, url, dates | |
| `cv_education` | school, degree type, major, minor, GPA, dates | |
| `cv_skills` | category, name | |
| `cv_certifications` | name, issuer, date earned, url | |
| `applications` | company, role, location, `portal_link`, `job_description`, `status` (checked against the known list), `applied_date`, `comments`, `resume_id`, `cover_letter_id`, `source` (`manual` / `email` / `extension`); migration 010 adds `salary_min/max/currency/period`, `employment_type`, `workplace_type`, `source_site` | |
| `application_status_history` | `application_id`, status, `changed_at` | Written by triggers (`log_initial_status`, `log_status_change`), never by the app |
| `resumes` | title, `content` JSONB (see Resume studio), `application_id` | `latex_content`, `ats_score` and the old `resume_items` / `resume_suggestions` tables are from the original design and unused |
| `cover_letters` | title, `content` JSONB (Draft.js body) | |
| `email_connections` | IMAP host and port, email, `app_password` (encrypted), `last_scan_at`, `auto_sync`, `last_auto_sync_at`, `last_auto_sync_error` | The password column is never selected for the browser (`PUBLIC_CONNECTION_COLUMNS`) |
| `processed_emails` | `message_id`, subject, sender, date, classification, action taken | Each message is classified once |
| `application_suggestions` | kind (`new` / `update`), `application_id`, company, role, status, category, confidence, summary, email fields, `state` (pending / approved / dismissed) | The review queue |
| `api_rate_limits` | `user_id`, key, window | Via `consume_rate_limit()` (authenticated only) |
| `extension_tokens` | `token_hash` (SHA-256), name, `last_used_at`, `revoked_at` | Tokens are `rbx_` + 32 random bytes, shown once |
| `auth_rate_limits` | hashed `bucket`, window | Via `consume_auth_rate_limit()` (service role only, migration 009) |

Migrations (`supabase/migrations/`, apply in order in the SQL editor):

| File | Adds |
|---|---|
| `001_initial_schema.sql` | Core tables, RLS policies, triggers (`handle_new_user`, `handle_updated_at`, status history) |
| `002_add_resume_content.sql` | `resumes.content` |
| `003_email_sync.sql` | `email_connections`, `processed_emails` |
| `004_security_hardening.sql` | `api_rate_limits`, `consume_rate_limit`, pinned `search_path`, status check |
| `005_application_suggestions.sql` | Review queue |
| `006_rewrite_bullet_limit.sql` | `rewrite-bullet` limit |
| `007_goals_and_auto_sync.sql` | Goals, auto-sync columns |
| `008_extension.sql` | `extension_tokens`, `applications.source` |
| `009_auth_rate_limits.sql` | Auth rate limits |
| `010_job_details.sql` | Pay range, workplace, employment type, source site |
| `011_email_sync_integrity.sql` | Expiring scan leases, auto-sync attempt ordering, transactional suggestion approval |

Naming: database fields are snake_case; each `data.js` maps rows to camelCase at the boundary.

## AI

- One entry point, `chatJSON` in `src/server/openai.js` (OpenAI chat completions, JSON mode, `gpt-6-luna` unless configured). Task overrides: `OPENAI_EMAIL_MODEL`, `OPENAI_WRITING_MODEL`, `OPENAI_SELECTION_MODEL`, `OPENAI_IMPORT_MODEL`; each falls back to `OPENAI_MODEL`. Email requests use a strict JSON schema and runtime validation. See [model evaluation and rollout advice](email-sync-reliability.md#current-ai-models-and-recommendation).
- **Uses**: email classification, resume tailoring (pick entries), bullet suggestions and rewrites, paragraph rewrites, cover letter drafts, resume import.
- **Untrusted output**: every response is validated and capped before use. Tailoring keeps only ids that exist; import caps rows and text; suggestions go through `checkRewrite` (`guardrails.js`), which rejects any variant that adds or swaps a technology or drops a fact (a number, a name) from the original. Paragraph rewrites get the technology check.
- **Cost control**: per-user rate limits on every AI route; a no-AI pre-filter before email classification; ATS scoring needs no AI.

## PDF and LaTeX

- `src/server/latex.js` builds a LaTeX document from `resumes.content` or `cover_letters.content`. Every user value is escaped (`esc`, `escUrl`) so text can't run LaTeX commands on the compile server.
- `renderResume` / `renderCoverLetter` POST the source to YtoTech's LaTeX-on-HTTP service and return the PDF, or the `.tex` source if compiling fails.
- **Page fidelity**: the editors' pages (`.rb-paper`, `.rb-letter` in `globals.css`, using the Source Serif 4 font as `--font-paper`) are calibrated to the LaTeX output (scale factors about 0.935 for resumes and 0.905 for letters). Change the LaTeX spacing, margins or fonts and the CSS must be re-measured against a compiled PDF, or the one-page estimate drifts.

## Email sync pipeline

```
Scan (button, /api/scan-emails)  or  daily cron (/api/cron/email-sync → runAutoSync)
  └─ syncEmailsForUser(supabase, userId, options)
       1. Load the connection; decrypt the app password; check the host is allowlisted (imapHosts.js)
       2. fetchEmails (imapClient.js): IMAP over TLS, read-only, date window (default 14 days),
          skips Gmail tabs that never hold application mail, caps message size; mailparser decodes
       3. Skip message ids already in processed_emails
       4. isCandidateEmail (classify.js): no-AI pre-filter (ATS senders, application phrases),
          so job alerts and digests don't reach the model
       5. classifyEmail: one model call per candidate (10 at a time, at most 100 per scan) →
          category, company, role, confidence
       6. planSuggestion: category → status (emailCategories.js), confidence ≥ MIN_CONFIDENCE,
          findTargetApplication (matching.js) to decide new vs update, merge with pending suggestions,
          skip if the status wouldn't move forward (shouldUpdateStatus)
       7. Write application_suggestions (pending) and processed_emails; nothing touches applications
  └─ The user approves or dismisses in SuggestionsReview (approveSuggestion writes the application)
```

- **Matching** (`matching.js`): normalized company equality, exact roles preferred, shortened titles accepted only when one distinct role matches. Explicit different roles never fall back to unrelated applications. Role-less messages require one open application. Confirmation matching and new-suggestion approval preserve closed/older-than-120-day cycles. Email dates exclude newer reapplications. See [matching and reliability details](email-sync-reliability.md).
- **Auto-sync** (`autoSync.js`): Vercel Cron at 12:00 UTC daily (`vercel.json`), service-role client scoped by user, users with `auto_sync` on. Migration 011 orders by oldest attempt; older schemas fall back to oldest success. New inboxes start only in the first 20 seconds, with a shared 50-second work budget. Errors/deferred work preserve the last successful watermark and set `last_auto_sync_error`. A 300-message transport cap requires narrower manual date ranges; first/long-gap cron scans look back at most seven days. Migration 011 also supplies cross-instance leases and atomic approval; compatibility paths provide fewer concurrency guarantees.

## Chrome extension

Full details in [extension/README.md](../extension/README.md) and [docs/chrome-extension-plan.md](chrome-extension-plan.md). In short:

- **Manifest V3**, no build step. `background.js` (module service worker) holds the connection and talks to the app. Content scripts: `app-bridge.js` on the app's pages (connect handshake), and `sites.js`, `job-reader.js`, `toast.js` and `detector.js` on job sites.
- **Connect**: after install the extension opens `/extension/connect`, which creates a token and hands it over by `postMessage`. Tokens are hashed in `extension_tokens`, and the extension sends `Authorization: Bearer rbx_…`.
- **Detect**: per-site rules (`sites.js`) for LinkedIn Easy Apply, Greenhouse (incl. its embedded iframe), Lever and Ashby. The posting is read from JSON-LD `JobPosting` first, then the site's selectors, then the page title. A submission counts on the site's confirmation URL (Greenhouse `/confirmation`, Lever `/thanks`, LinkedIn's brief `/post-apply/`, caught with the Navigation API), on success text that appears after a real submit click, or, for LinkedIn, on its Easy Apply submit request completing (seen with `webRequest`, URL and status only).
- **Add**: automatic when the user really clicked submit for that job; otherwise a small "Did you apply?" notice asks first. A compact top-right toast shows "Tracking application", then "Added to Resume Butler" with Undo. Offline submissions are queued and retried.
- **Server side** (`server/extension/applications.js`): dedupes by posting link, or by company and exact role, but only against an open application from the same cycle. It saves the job description and job details, and the comment says where it came from ("Added by the browser extension from LinkedIn").
- **Security**: popup-only messages are separate from content-script messages; the token never leaves the background worker; undo only works for this browser's recent additions; `localhost:3000` is trusted only by unpacked installs; only `isTrusted` clicks count; frames are accepted only for Greenhouse's embed. After an update, the extension injects fresh scripts into open tabs, and orphaned copies stop themselves.

## Authentication and security

- **Supabase Auth** with email/password and Google OAuth. All auth calls run on the server as Server Actions (`features/auth/actions.js`); there is no Supabase client in the browser.
- **Session**: `middleware.js` refreshes the session cookies and routes pages with `getClaims()`. Signed-out visitors go to `/login?next=…`, and signed-in users are kept off the auth pages. It skips `/api`, because routes check auth themselves. Layouts, pages and routes always verify with `getUser()`; never use `getSession()` for a decision.
- **Callback**: `/auth/callback` exchanges the one-time code (PKCE) and redirects only to a safe `next` path (`safeNextPath`).
- **Password reset**: the email link goes through `/auth/callback?next=/reset-password`. The reset page and `updatePassword` accept only a session whose `amr` shows a recovery or OTP sign-in in the last 15 minutes.
- **Rate limits**: per-user limits for expensive routes (`consume_rate_limit`); per-IP, IP + email and email limits for sign-in, sign-up, reset and password update (`consume_auth_rate_limit`), since Supabase sees the server's IP for every visitor.
- **Passwords**: at least 8 characters (`MIN_PASSWORD_LENGTH`), checked in the form and on the server; Supabase applies its own rules too.
- **Untrusted content**: no `dangerouslySetInnerHTML`; links render through `safeHttpUrl`; email, LLM output, uploads and extension input are validated and capped; CSV export neutralizes formulas; LaTeX input is escaped; IMAP hosts are allowlisted (SSRF).
- **Secrets**: `APP_ENCRYPTION_KEY` (AES-256-GCM for stored email passwords), `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are server-only, and none appears in the client bundle.
- **Headers** (`next.config.mjs`): Content-Security-Policy (`script-src 'self' 'unsafe-inline'` until nonce CSP), `frame-ancestors 'none'`, HSTS with preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`.

## Design system

- **Colors**: brand green `#559F87` (Tailwind `brand`, `BRAND_COLOR` for JS-drawn UI such as charts); status colors in `STATUS_COLORS`; shadcn's CSS variables (`--primary`, `--muted` and so on) in `globals.css`. The app chrome is neutral white and gray (the user chose gray over green headers).
- **Type**: Inter (via `next/font`) for the UI; Source Serif 4 for the resume and letter pages; Latin Modern Roman in the LaTeX output.
- **Layout**: a fixed 73px header (`NavBar`: links with the active page from 768px up, account menu with Profile & CV, the extension and sign-out, "New application" as the primary action), so pages start at `pt-[85px]` and the editors at `top-[73px]`. Content containers: `max-w-6xl` / `max-w-7xl` with `px-4 md:px-6`.
- **Components**: shadcn/ui primitives in `src/components/ui`; cards for grouped content; badges per status (`<Badge variant={status.toLowerCase()}>`); sonner toasts for feedback (never `alert()`); skeletons shaped like each page while loading.

## Deployment and operations

- **Vercel**, Hobby plan, auto-deploys from `main` (commit status shows the deploy). Personal project: changes are pushed straight to `main`, no PRs.
- **Limits**: Hobby supports a maximum duration of 300 seconds with Fluid Compute, or 60 seconds without it. The scan and cron routes explicitly set `maxDuration = 60`. Check the project's Functions settings before raising limits; its Fluid Compute setting is not recorded in the repository. See [README deployment setup](../README.md#deploying-to-vercel) and [Vercel's limits](https://vercel.com/docs/functions/limitations).
- **Cron**: `vercel.json` runs `/api/cron/email-sync` daily at 12:00 UTC; Vercel sends `CRON_SECRET` as a bearer token.
- **Environment variables**:

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase clients (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role client: cron, extension API, auth rate limits (server only) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` and task-specific `OPENAI_*_MODEL` overrides (optional) | AI features |
| `APP_ENCRYPTION_KEY` | Encrypting stored email passwords (`openssl rand -base64 32`) |
| `CRON_SECRET` | Authorizes Vercel Cron |
| `NEXT_PUBLIC_EXTENSION_ID` (optional) | Lets the connect page also use `externally_connectable` |

- **Supabase settings**: Follow [README auth setup](../README.md#getting-started) for the production Site URL, local and production redirect patterns (including `/auth/callback?next=…`), Google provider configuration and minimum password length 8. Keep CAPTCHA protection disabled until the forms and Server Actions support challenge tokens.
- **Logs**: Vercel runtime logs (errors are logged with a context string by `errorResponse` and `runAction`). There's no error monitoring service yet.

## Known gaps and decisions

- **Email/AI regression tests** run with `npm test` under Node 24. Add relevant browser checks and an isolated production build. Database RPC execution and real mailbox provider behavior need integration coverage; see [email-sync-reliability.md](email-sync-reliability.md).
- **Next.js 14 is end of life** with known advisories; the 16.4 upgrade is on a branch (below).
- **CSP still allows inline scripts**; a nonce-based CSP needs dynamic rendering and is best done after the upgrade.
- **CAPTCHA integration is pending.** Sign-in, sign-up and password-reset forms must collect challenge tokens and pass `options.captchaToken` in their Supabase auth calls before protection is enabled. Enabling the dashboard toggle alone would block those flows. See [ROADMAP.md](../ROADMAP.md).
- **Gmail OAuth** (instead of IMAP app passwords) is planned; see [ROADMAP.md](../ROADMAP.md).
- **Unused schema**: `resumes.latex_content`, `resumes.ats_score`, `resume_items`, `resume_suggestions`, `applications.parsed_requirements` are from the original design.
- **The email page's name** ("Email Sync") is under discussion.
- **Caching**: data is per-user and changes often, so nothing is cached across requests; React `cache()` dedupes within a request and Server Actions revalidate paths.

## Upgrades in flight

Branch `claude/keen-roentgen-b7b6a5` (not merged): Next.js 16.4.3 with React 19 (async request APIs, `proxy.js` in place of `middleware.js`, ESLint run directly instead of `next lint`, Turbopack builds), plus a feature sweep adopting Next 16 / React 19 features where they beat the current code. When it merges, update this file, CLAUDE.md and the README: version numbers, `proxy.js`, the lint command, and any new caching or form conventions.
