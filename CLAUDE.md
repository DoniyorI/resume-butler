# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Resume Butler is a job application management platform with a Next.js 14 frontend and Supabase (PostgreSQL) backend. Supabase provides authentication, database, and storage. AI resume alignment uses OpenAI via a Next.js API route.

## Commands

```bash
npm run dev        # Dev server on port 3000
npm run build      # Production build
npm start          # Production server
npm run lint       # ESLint (next/core-web-vitals)
```

## Architecture

### Frontend (`src/`)
- **App Router**: Next.js 14 file-based routing in `src/app/`. Dynamic routes for `/resumes/[resumeId]` and `/coverletters/[coverLetterId]`.
- **UI System**: Shadcn/UI components in `src/components/ui/` built on Radix UI primitives with Tailwind CSS. Configured via `components.json`.
- **Path alias**: `@/*` maps to `./src/*` (jsconfig.json).
- **Supabase client**: Browser client at `src/lib/supabase/client.js`, server client at `src/lib/supabase/server.js`.
- **Auth**: Supabase Auth (email/password + Google OAuth). Custom `useAuth` hook at `src/hooks/useAuth.js` returns `{ user, loading, supabase }`. Supports `redirect: true` to auto-redirect unauthenticated users. Auth pages at `/login`, `/register`, `/forgot-password`.
- **Middleware**: `src/middleware.js` refreshes Supabase auth sessions on every request.
- **Forms**: React Hook Form + Zod validation. CV form components (ExperienceForm, EducationForm, ProjectForm, SkillForm).
- **Data tables**: TanStack React Table in `ApplicationTable.jsx` with sorting, filtering, pagination.
- **Charts**: MUI X-Charts (PieChart, LineChart) on `/dash`.

### API Routes (`src/app/api/`)
- `POST /api/generate-resume` — AI resume generation. Fetches user's CV data from Supabase, calls OpenAI GPT-4o-mini to select relevant items, stores result as a new resume.

### Database (Supabase PostgreSQL)
Schema in `supabase/migrations/`. Key tables:
- `profiles` — user info (auto-created on signup via trigger)
- `cv_experience`, `cv_experience_bullets` — master CV work experience
- `cv_projects`, `cv_project_bullets` — master CV projects
- `cv_education` — master CV education
- `cv_skills` — master CV skills (categorized)
- `cv_certifications` — master CV certifications
- `applications` — job application tracker with status history
- `application_status_history` — auto-logged via trigger on status change
- `resumes` — generated resumes with `content` JSONB column
- `cover_letters` — cover letters with Draft.js content as JSONB
- Row-level security enabled on all tables (users can only access their own data)

### Key Patterns
- User ID is `user.id` (Supabase UUID), not `user.uid`
- All components use `useAuth()` hook — never import Supabase client directly in components
- Database field names use snake_case; frontend state uses camelCase with mapping at the query boundary

## Key Dependencies
- **@supabase/supabase-js** / **@supabase/ssr**: Auth, database, storage
- **draft-js**: Rich text editing for cover letters
- **jspdf** + **html2canvas**: PDF generation
- **@hello-pangea/dnd**: Drag and drop for resume sections
- **sonner**: Toast notifications
- **date-fns**: Date formatting
- **@tanstack/react-table**: Data tables
- **@mui/x-charts**: Dashboard charts

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```
