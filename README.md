# Resume Butler

A job search workspace: track every application, keep one master CV, and build a tailored resume and cover letter for each job, in your own words. Email sync and a Chrome extension keep the tracker up to date without retyping.

Built with Next.js (App Router, JavaScript) and Supabase, deployed on Vercel.

## Features

- **Dashboard**: stat cards (total, response rate, offer rate, average time to a reply), a daily or weekly application goal with streaks, follow-ups for applications with no reply after two weeks, recent applications, and charts (over time, pipeline, status breakdown, a Sankey status flow).
- **Application tracker**: a fast table with search, status and date filters, sorting, pages, bulk actions, inline status and comments, and CSV export. Each application has a detail page with its job description, pay range, workplace and employment type, notes, a status timeline, linked documents and an ATS check.
- **Master CV**: experience, projects, education, skills and certifications, with a CV strength meter and import from a PDF or text resume.
- **Resume studio**: edit on a page that matches the exported PDF, reorder and hide sections, see live how full the one page is, score keywords against the job (ATS-style, no AI), pick the master CV entries that fit the job, and get AI wording suggestions that may never add a technology or fact you didn't write. Export to PDF via LaTeX.
- **Cover letter studio**: draft a letter from your CV and the job (tone, length), rewrite paragraphs, export to PDF.
- **Email sync**: connects to your inbox over IMAP (Gmail with an app password, Outlook and Office 365, Yahoo, iCloud), finds confirmations, interview invites, assessments, offers and rejections, and queues suggested changes for you to approve. Optional daily auto-sync.
- **Chrome extension**: notices when you submit an application on LinkedIn Easy Apply, Greenhouse, Lever or Ashby, and adds it to your tracker with the job description, pay range and where you applied. A small notice confirms it, with Undo.

## Tech stack

Next.js App Router (Server Components, Server Actions, Route Handlers) · React · Tailwind CSS and shadcn/ui · Supabase (Postgres with row-level security, Auth with email and Google) · OpenAI (`gpt-6-luna`) · LaTeX compiled through YtoTech's LaTeX-on-HTTP · IMAP (`imap`, `mailparser`) · Chrome Manifest V3 extension · Vercel and Vercel Cron.

The full breakdown (architecture, data model, every route and module, the AI rules, security) is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Getting started

Requirements: Node.js 24.x, a Supabase project, and an OpenAI API key.

1. **Install**
   ```bash
   npm install
   ```
2. **Environment**: create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=   # server only: daily email sync, extension API, auth rate limits, PDF/submission archival
   OPENAI_API_KEY=
   OPENAI_MODEL=                # optional, defaults to gpt-6-luna
   OPENAI_EMAIL_MODEL=          # optional override for email classification
   OPENAI_WRITING_MODEL=        # optional override for wording and cover letters
   OPENAI_SELECTION_MODEL=      # optional override for CV entry selection
   OPENAI_IMPORT_MODEL=         # optional override for CV import
   APP_ENCRYPTION_KEY=          # base64 32 bytes: openssl rand -base64 32
   CRON_SECRET=                 # any long random string; Vercel Cron sends it
   NEXT_PUBLIC_EXTENSION_ID=    # optional: the published extension's ID
   ```
3. **Database**: in the Supabase SQL editor, run each file in `supabase/migrations/` in order, `001` to `017`, as its own query. Each should report success. Migration 012 enables identity-safe recording/approval, 013 saved jobs, 014 flexible documents, 015 preserved submission versions, and 016–017 approved reusable answers with safe conflict responses. Finish017 before using answer capture. Run only unapplied migrations; never edit an applied file. Missing archive/library setup blocks the affected writes with a retry message.
4. **Auth settings** in Supabase:
   - Authentication → URL Configuration: set **Site URL** to your production origin (for example, `https://resume-butler.vercel.app`; use `http://localhost:3000` for a local-only project).
   - Add `http://localhost:3000/**` to **Redirect URLs** for local development. For production, add `<your site>/auth/callback` and the glob pattern `<your site>/auth/callback\?next=**`, replacing `<your site>` with your production origin. The backslash makes `?` literal; `**` accepts the `next` value, including paths and encoded slashes. The app uses these query strings for email confirmation (`next=/profile`), password reset (`next=/reset-password`) and Google sign-in. See [Supabase's redirect URL rules](https://supabase.com/docs/guides/auth/redirect-urls).
   - Authentication → Providers: enable Email. For Google sign-in, configure a Google OAuth client and its credentials in Supabase, using the Supabase provider callback as Google's authorized redirect URI; follow [Supabase's Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
   - Set the minimum password length to 8. **Leave CAPTCHA protection disabled for now**: the app has no challenge widget or `captchaToken` handling, so enabling it would block email/password sign-in, sign-up and password-reset requests. Turnstile integration is pending in [ROADMAP.md](ROADMAP.md); it must collect a challenge token in each form and pass it as `options.captchaToken` in the corresponding Supabase auth call before protection is enabled. See [Supabase's CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha).
5. **Run**
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

### Deploying to Vercel

- Add every variable from `.env.local` to the project's Production environment, then redeploy (Vercel applies changed variables on the next deploy).
- `vercel.json` schedules the daily email sync (`/api/cron/email-sync`, 12:00 UTC).
- Check **Functions → Fluid Compute** in the Vercel project settings before changing route durations. Hobby allows up to 300 seconds with Fluid Compute, or 60 seconds without it ([Vercel limits](https://vercel.com/docs/functions/limitations)). This repository's email scan and cron routes explicitly use `maxDuration = 60` and can run in either configuration; the project's Fluid Compute setting is not recorded in the repository.

### The Chrome extension

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `extension/` folder.
2. It opens the app's `/extension/connect` page and connects on its own (sign in first if asked).

Details: [extension/README.md](extension/README.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint |
| `npm test` | Email, AI, page-fit and editor-save regression checks (Node 24) |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check) |

## Documentation

| File | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The whole app: stack, request flow, folders, pages, features, API routes, Server Actions, database, AI, PDFs, email sync, extension, security, design, deployment |
| [CLAUDE.md](CLAUDE.md) | Coding conventions and rules for working in the codebase (for people and AI assistants) |
| [ROADMAP.md](ROADMAP.md) | What's done and what's next |
| [docs/email-sync-reliability.md](docs/email-sync-reliability.md) | Matching rules, model evaluation, QA evidence, migration 011 and remaining reliability limits |
| [docs/submission-packages-verification.md](docs/submission-packages-verification.md) | Preserved submission files, source labels, ownership/retry checks and storage limits |
| [docs/approved-answers-verification.md](docs/approved-answers-verification.md) | Manual approval, revision safety, copying, submitted answer copies and verification limits |
| [docs/chrome-extension-plan.md](docs/chrome-extension-plan.md) | How the extension was designed and what's planned for it |
| [extension/README.md](extension/README.md) | Installing, testing and how the extension works |
