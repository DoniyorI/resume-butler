-- Resume Butler: Initial Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-----------------------------------------------------------
-- USERS PROFILE
-----------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  username text,
  phone text,
  location text,
  linkedin text,
  github text,
  portfolio text,
  other_links text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-----------------------------------------------------------
-- CV: EXPERIENCE
-----------------------------------------------------------
create table public.cv_experience (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  position text,
  location text,
  type text, -- 'Internship', 'Part-time', 'Full-time', 'Contract'
  start_date date,
  end_date date,
  currently_working boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table public.cv_experience_bullets (
  id uuid primary key default uuid_generate_v4(),
  experience_id uuid not null references public.cv_experience(id) on delete cascade,
  content text not null,
  sort_order int default 0
);

-----------------------------------------------------------
-- CV: PROJECTS
-----------------------------------------------------------
create table public.cv_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  url text,
  start_date date,
  end_date date,
  currently_working boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table public.cv_project_bullets (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.cv_projects(id) on delete cascade,
  content text not null,
  sort_order int default 0
);

-----------------------------------------------------------
-- CV: EDUCATION
-----------------------------------------------------------
create table public.cv_education (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school text not null,
  location text,
  degree_type text, -- 'Bachelor', 'Master', 'PhD', 'Associate'
  major text,
  minor text,
  gpa numeric,
  start_date date,
  end_date date,
  sort_order int default 0,
  created_at timestamptz default now()
);

-----------------------------------------------------------
-- CV: SKILLS
-----------------------------------------------------------
create table public.cv_skills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text, -- 'Languages', 'Frameworks', 'Tools', etc.
  name text not null,
  sort_order int default 0
);

-----------------------------------------------------------
-- CV: CERTIFICATIONS
-----------------------------------------------------------
create table public.cv_certifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  issuer text,
  date_earned date,
  url text
);

-----------------------------------------------------------
-- APPLICATIONS
-----------------------------------------------------------
create table public.applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  role text,
  location text,
  portal_link text,
  job_description text,
  parsed_requirements jsonb,
  status text default 'Applied',
  applied_date date default current_date,
  comments text,
  resume_id uuid, -- FK added after resumes table
  cover_letter_id uuid, -- FK added after cover_letters table
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.application_status_history (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status text not null,
  changed_at timestamptz default now()
);

-----------------------------------------------------------
-- RESUMES
-----------------------------------------------------------
create table public.resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  title text not null,
  latex_content text,
  ats_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.resume_items (
  id uuid primary key default uuid_generate_v4(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  item_type text not null, -- 'experience', 'project', 'education', 'skill', 'certification'
  item_id uuid not null,
  sort_order int default 0,
  included boolean default true
);

create table public.resume_suggestions (
  id uuid primary key default uuid_generate_v4(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  bullet_id uuid not null,
  original_text text not null,
  suggested_text text not null,
  reason text,
  accepted boolean -- null = pending
);

-----------------------------------------------------------
-- COVER LETTERS
-----------------------------------------------------------
create table public.cover_letters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  title text not null,
  content jsonb, -- Draft.js raw content
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-----------------------------------------------------------
-- ADD FKs to applications
-----------------------------------------------------------
alter table public.applications
  add constraint fk_applications_resume
  foreign key (resume_id) references public.resumes(id) on delete set null;

alter table public.applications
  add constraint fk_applications_cover_letter
  foreign key (cover_letter_id) references public.cover_letters(id) on delete set null;

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.cv_experience enable row level security;
alter table public.cv_experience_bullets enable row level security;
alter table public.cv_projects enable row level security;
alter table public.cv_project_bullets enable row level security;
alter table public.cv_education enable row level security;
alter table public.cv_skills enable row level security;
alter table public.cv_certifications enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_items enable row level security;
alter table public.resume_suggestions enable row level security;
alter table public.cover_letters enable row level security;

-- Profiles: users can only access their own
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- CV Experience: users can only access their own
create policy "Users can manage own experience" on public.cv_experience for all using (auth.uid() = user_id);

-- CV Experience Bullets: users can access bullets for their own experience
create policy "Users can manage own experience bullets" on public.cv_experience_bullets for all
  using (experience_id in (select id from public.cv_experience where user_id = auth.uid()));

-- CV Projects: users can only access their own
create policy "Users can manage own projects" on public.cv_projects for all using (auth.uid() = user_id);

-- CV Project Bullets: users can access bullets for their own projects
create policy "Users can manage own project bullets" on public.cv_project_bullets for all
  using (project_id in (select id from public.cv_projects where user_id = auth.uid()));

-- CV Education: users can only access their own
create policy "Users can manage own education" on public.cv_education for all using (auth.uid() = user_id);

-- CV Skills: users can only access their own
create policy "Users can manage own skills" on public.cv_skills for all using (auth.uid() = user_id);

-- CV Certifications: users can only access their own
create policy "Users can manage own certifications" on public.cv_certifications for all using (auth.uid() = user_id);

-- Applications: users can only access their own
create policy "Users can manage own applications" on public.applications for all using (auth.uid() = user_id);

-- Application Status History: users can access history for their own applications
create policy "Users can manage own status history" on public.application_status_history for all
  using (application_id in (select id from public.applications where user_id = auth.uid()));

-- Resumes: users can only access their own
create policy "Users can manage own resumes" on public.resumes for all using (auth.uid() = user_id);

-- Resume Items: users can access items for their own resumes
create policy "Users can manage own resume items" on public.resume_items for all
  using (resume_id in (select id from public.resumes where user_id = auth.uid()));

-- Resume Suggestions: users can access suggestions for their own resumes
create policy "Users can manage own resume suggestions" on public.resume_suggestions for all
  using (resume_id in (select id from public.resumes where user_id = auth.uid()));

-- Cover Letters: users can only access their own
create policy "Users can manage own cover letters" on public.cover_letters for all using (auth.uid() = user_id);

-----------------------------------------------------------
-- AUTO-CREATE PROFILE ON SIGNUP
-----------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-----------------------------------------------------------
-- AUTO-UPDATE updated_at
-----------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.applications
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.resumes
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.cover_letters
  for each row execute function public.handle_updated_at();

-----------------------------------------------------------
-- AUTO-LOG STATUS CHANGES
-----------------------------------------------------------
create or replace function public.log_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into public.application_status_history (application_id, status)
    values (new.id, new.status);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_application_status_change
  after update on public.applications
  for each row execute function public.log_status_change();

-- Also log initial status on insert
create or replace function public.log_initial_status()
returns trigger as $$
begin
  insert into public.application_status_history (application_id, status)
  values (new.id, new.status);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_application_created
  after insert on public.applications
  for each row execute function public.log_initial_status();
