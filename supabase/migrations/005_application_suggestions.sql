-- Email scans suggest applications instead of writing them directly; the user
-- approves or dismisses each suggestion. Anyone can send email, so nothing
-- from an inbox changes the tracker without the user's say-so.

create table public.application_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  -- 'new' creates an application; 'update' changes the status of application_id
  kind text not null check (kind in ('new', 'update')),
  application_id uuid references public.applications(id) on delete cascade,
  company text not null,
  role text not null default '',
  status text not null
    check (status in ('Applied', 'Interviewed', 'Pending', 'Offered', 'Rejected', 'Withdrew', 'Reached Out')),
  category text not null,
  confidence real,
  summary text,
  email_subject text,
  email_from text,
  email_date timestamptz,
  state text not null default 'pending' check (state in ('pending', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, message_id),
  check (kind = 'new' or application_id is not null)
);

create index idx_application_suggestions_pending
  on public.application_suggestions (user_id, created_at desc)
  where state = 'pending';

alter table public.application_suggestions enable row level security;

create policy "Users can manage own application suggestions"
  on public.application_suggestions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
