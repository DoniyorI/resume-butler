-- Add content JSONB column to resumes for inline resume data
-- This stores education, experience, projects, skills, header, and section order
alter table public.resumes add column if not exists content jsonb default '{}';
