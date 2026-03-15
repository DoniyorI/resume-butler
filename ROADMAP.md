# Resume Butler — Project Roadmap

## Vision

A job application platform where users build a comprehensive CV once, then generate tailored resumes for each job by selecting and refining relevant items — not AI slop, but intelligent curation of the user's own words. Output in LaTeX for maximum ATS compatibility, with a built-in ATS scanner to verify match quality before submitting.

---

## Current State

- Next.js 14 frontend + Django backend (GPT calls only) + Firebase (Auth, Firestore, Storage)
- Application tracker table (working)
- Basic resume builder with drag-and-drop sections
- Cover letter editor (Draft.js)
- Profile/CV page with education, experience, projects, skills forms
- AI resume generation via Django → GPT-3.5 (generates full content, not selective)

### Problems with Current Architecture

- **Firebase Firestore** is a poor fit for relational CV data (experiences linked to skills, tagged by industry, scored against job requirements)
- **Django backend** only exists for one GPT call — overkill for what it does
- **Data is scattered** — profile info, CV entries, and resume content are stored in separate places with duplication
- **No job description storage** — postings get taken down, users lose context
- **AI currently rewrites content** — should select and suggest instead

---

## Proposed Architecture

### Stack Migration

| Current | Proposed | Why |
|---------|----------|-----|
| Firebase Auth | Supabase Auth | Unified with DB, row-level security |
| Firestore | Supabase (PostgreSQL) | Relational data, full-text search, pg_vector for semantic matching |
| Firebase Storage | Supabase Storage | Unified platform |
| Django backend | Next.js API routes | Simplify to one codebase, Django only existed for GPT calls |
| GPT-3.5 | GPT-4o-mini or Claude | Better structured output for selection/suggestion tasks |

### Database Schema (PostgreSQL)

```sql
-- Core user profile
users (
  id uuid PK,
  email text,
  first_name text,
  last_name text,
  phone text,
  location text,
  linkedin text,
  github text,
  portfolio text,
  created_at timestamp
)

-- Master CV entries (the source of truth)
cv_experience (
  id uuid PK,
  user_id uuid FK → users,
  company text,
  position text,
  location text,
  type text, -- internship, full-time, contract, part-time
  start_date date,
  end_date date,
  currently_working boolean,
  sort_order int,
  created_at timestamp
)

cv_experience_bullets (
  id uuid PK,
  experience_id uuid FK → cv_experience,
  content text, -- the actual bullet point in user's words
  sort_order int
)

cv_projects (
  id uuid PK,
  user_id uuid FK → users,
  name text,
  description text,
  url text,
  start_date date,
  end_date date,
  currently_working boolean,
  sort_order int
)

cv_project_bullets (
  id uuid PK,
  project_id uuid FK → cv_projects,
  content text,
  sort_order int
)

cv_education (
  id uuid PK,
  user_id uuid FK → users,
  school text,
  location text,
  degree_type text,
  major text,
  minor text,
  gpa numeric,
  start_date date,
  end_date date,
  sort_order int
)

cv_skills (
  id uuid PK,
  user_id uuid FK → users,
  category text, -- "Languages", "Frameworks", "Tools", etc.
  name text,
  sort_order int
)

cv_certifications (
  id uuid PK,
  user_id uuid FK → users,
  name text,
  issuer text,
  date_earned date,
  url text
)

-- Applications (the central hub)
applications (
  id uuid PK,
  user_id uuid FK → users,
  company text,
  role text,
  location text,
  portal_link text,
  job_description text, -- saved full posting
  parsed_requirements jsonb, -- extracted keywords/skills
  status text,
  applied_date date,
  comments text,
  resume_id uuid FK → resumes (nullable),
  cover_letter_id uuid FK → cover_letters (nullable),
  created_at timestamp
)

-- Status history for timeline
application_status_history (
  id uuid PK,
  application_id uuid FK → applications,
  status text,
  changed_at timestamp
)

-- Generated resumes (subsets of CV)
resumes (
  id uuid PK,
  user_id uuid FK → users,
  application_id uuid FK → applications (nullable),
  title text,
  latex_content text, -- compiled LaTeX
  ats_score numeric,
  created_at timestamp,
  updated_at timestamp
)

-- Which CV items are included in a resume
resume_items (
  id uuid PK,
  resume_id uuid FK → resumes,
  item_type text, -- 'experience', 'project', 'education', 'skill', 'certification'
  item_id uuid, -- FK to the relevant cv_ table
  sort_order int,
  included boolean -- user can toggle on/off
)

-- AI suggestions (edits to bullet points for a specific resume)
resume_suggestions (
  id uuid PK,
  resume_id uuid FK → resumes,
  bullet_id uuid, -- FK to cv_experience_bullets or cv_project_bullets
  original_text text,
  suggested_text text,
  reason text, -- "adds keyword: CI/CD"
  accepted boolean default null -- null = pending, true = accepted, false = rejected
)

-- Cover letters
cover_letters (
  id uuid PK,
  user_id uuid FK → users,
  application_id uuid FK → applications (nullable),
  title text,
  content text,
  created_at timestamp,
  updated_at timestamp
)
```

---

## Phases

### Phase 0: Foundation — Supabase Migration
**Goal:** Replace Firebase with Supabase, keep existing features working.

- [ ] Set up Supabase project (DB, Auth, Storage)
- [ ] Create database schema (tables above)
- [ ] Set up row-level security policies
- [ ] Replace Firebase Auth with Supabase Auth (login, register, forgot-password, Google OAuth)
- [ ] Migrate `useAuth` hook to Supabase
- [ ] Migrate profile page to read/write from Supabase
- [ ] Migrate CV forms (education, experience, projects, skills) to Supabase
- [ ] Migrate application table to Supabase
- [ ] Migrate resume/cover letter file uploads to Supabase Storage
- [ ] Remove Django backend — move GPT call to Next.js API route (`/api/generate-resume`)
- [ ] Remove all Firebase dependencies
- [ ] Verify everything works end-to-end

### Phase 1: Comprehensive CV Page
**Goal:** Rebuild the CV page as the master document with rich data entry.

- [ ] Redesign CV page layout — tabbed sections (Experience, Projects, Education, Skills, Certifications)
- [ ] Experience form: multiple bullet points per role with inline editing
- [ ] Projects form: multiple bullet points, tech stack tags, links
- [ ] Education form: coursework, honors, activities
- [ ] Skills form: categorized (Languages, Frameworks, Tools, Platforms)
- [ ] Certifications form
- [ ] Drag-and-drop reordering within each section
- [ ] Import from existing resume (PDF parse) — stretch goal

### Phase 2: Application Detail Page
**Goal:** Make each application a hub that ties everything together.

- [ ] New route: `/applications/[id]`
- [ ] Click table row → opens detail page
- [ ] Job description field — paste and save the full posting
- [ ] Status timeline — visual history of status changes with dates
- [ ] Linked resume and cover letter with preview
- [ ] "Create tailored resume" button → goes to Phase 3 flow
- [ ] Notes/comments section
- [ ] Follow-up reminder dates

### Phase 3: Smart Resume Builder — Selection
**Goal:** AI selects the most relevant CV items for a job posting.

- [ ] Job description parser — extract requirements, skills, qualifications
- [ ] Matching engine — score each CV item against parsed requirements
  - Keyword matching (exact + synonym)
  - Semantic similarity via embeddings (pg_vector)
- [ ] Selection UI:
  - Ranked list of CV items with relevance scores
  - Checkboxes to include/exclude
  - Shows matched keywords per item ("matches: React, TypeScript")
  - Drag to reorder
- [ ] Preview pane — see the resume take shape as you select items

### Phase 4: LaTeX Output + ATS Scanner
**Goal:** Generate ATS-optimized resumes in LaTeX format.

- [ ] LaTeX resume template (clean, single-column, no graphics)
- [ ] Template system — support 2-3 LaTeX templates users can choose from
- [ ] Generate LaTeX from selected CV items
- [ ] Compile LaTeX → PDF (server-side via API route)
- [ ] ATS Scanner:
  - Keyword match score (% of job requirements found in resume)
  - Missing keywords list with suggestions ("you have Jenkins experience, add 'CI/CD'")
  - Section completeness check
  - Format warnings (too long, too short, missing sections)
- [ ] Score display: 85/100 with breakdown

### Phase 5: AI Suggestions — Refinement
**Goal:** AI suggests edits to bullet points (not rewrites).

- [ ] For each included bullet point, AI can suggest additions:
  - "Add 'REST APIs' — you did this at Company X and the job asks for it"
  - "Quantify: add metrics if available"
- [ ] Diff view — show original vs. suggested with highlights
- [ ] Accept/reject per suggestion
- [ ] Suggestions are stored, so user can review later
- [ ] Never modify the master CV — suggestions only apply to the specific resume

### Phase 6: Dashboard + Analytics
**Goal:** Actionable insights about the job search.

- [ ] Application funnel: Applied → Interviewed → Offered conversion rates
- [ ] Response rate by company/role type
- [ ] Time-to-response tracking
- [ ] Weekly/monthly application goals with progress bar
- [ ] Most-used skills across applications
- [ ] Improve existing pie/line charts

### Phase 7: Quality of Life
**Goal:** Polish and power features.

- [ ] Bulk status update (select multiple applications)
- [ ] Duplicate application (same resume, different company)
- [ ] Export to CSV
- [ ] Email notifications for follow-up reminders
- [ ] Dark mode (Tailwind already supports it, just needs toggle)
- [ ] Mobile responsive improvements

---

## Key Principles

1. **User's words, not AI's** — AI selects and suggests, never generates from scratch
2. **CV is the source of truth** — resumes are curated subsets, never standalone documents
3. **Application is the hub** — everything connects back to a specific job application
4. **ATS-first formatting** — LaTeX output, no fancy layouts that break parsers
5. **Transparency** — always show why something was selected or suggested
