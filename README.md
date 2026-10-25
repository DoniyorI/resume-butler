# Resume Butler

Track job applications, keep one master CV, and generate tailored resumes and cover letters for each job. Built with Next.js 14 (App Router) and Supabase.

## Features

- **Application tracker**: table with status, comments, bulk actions and CSV export; dashboard with response rates and a status flow (Sankey) chart
- **Master CV**: experience, projects, education, skills and certifications, with PDF/.txt resume import
- **Resume builder**: drag-and-drop sections, AI bullet suggestions, ATS keyword score, PDF/LaTeX export
- **Cover letters**: rich-text editor with AI drafts
- **Email sync**: scans your inbox for job emails and creates or updates applications (Gmail OAuth is planned)

## Getting Started

Requirements: Node.js 24.x and a Supabase project.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   OPENAI_API_KEY=
   APP_ENCRYPTION_KEY=   # openssl rand -base64 32
   ```
3. Apply the SQL files in `supabase/migrations/` to your Supabase project, in order.
4. In Supabase, go to Authentication > URL Configuration and add `<your site>/auth/callback` to the Redirect URLs.
5. Start the dev server:
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Project Structure

See [CLAUDE.md](CLAUDE.md) for the folder layout and coding conventions, and [ROADMAP.md](ROADMAP.md) for what's next.
