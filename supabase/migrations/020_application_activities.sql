-- Next actions: dated activities (follow-ups, assessments, interviews, offer
-- deadlines, tasks) attached to an application. Apply after 019.
--
-- The composite foreign key (application_id, user_id) is what stops an
-- activity being attached to another user's application, so it needs a unique
-- key on applications(id, user_id) to point at. The app caps each user at
-- 2,000 activities in its insert path.
begin;

create unique index if not exists applications_id_owner on public.applications(id, user_id);

create table public.application_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null,
  kind text not null check (kind in ('follow_up','assessment','recruiter_screen','interview','offer_deadline','task')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_on date,                 -- the calendar day as the user entered it; null = no date yet
  starts_at timestamptz,       -- set only for a timed event such as an interview
  time_zone text check (time_zone is null or char_length(time_zone) between 1 and 64),  -- IANA zone it was entered in
  status text not null default 'open' check (status in ('open','done','cancelled')),
  completed_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 4000),
  contact_name text not null default '' check (char_length(contact_name) <= 200),
  contact_channel text not null default '' check (contact_channel in ('','email','phone','linkedin','video','in_person','other')),
  link text not null default '' check (link = '' or (char_length(link) <= 2000 and link ~* '^https?://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  check (starts_at is null or due_on is not null),
  check ((status = 'done') = (completed_at is not null))
);

create index application_activities_user_status_due on public.application_activities(user_id, status, due_on);
create index application_activities_application on public.application_activities(application_id);

create trigger set_updated_at before update on public.application_activities
  for each row execute function public.handle_updated_at();

-- At most 2,000 activities per user, enforced here because authenticated
-- users can insert directly. The per-user advisory lock serializes concurrent
-- inserts so two of them cannot both pass the count.
create function public.enforce_activity_limit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('application_activities:'||new.user_id::text,0));
  if (select count(*) from public.application_activities where user_id=new.user_id)>=2000 then
    raise exception 'Next steps limit reached (2000). Delete finished steps first.' using errcode='54000';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_activity_limit() from public,anon,authenticated;

create trigger enforce_activity_limit before insert on public.application_activities
  for each row execute function public.enforce_activity_limit();

alter table public.application_activities enable row level security;
revoke all on public.application_activities from public, anon, authenticated;
grant select, insert, update, delete on public.application_activities to authenticated;
grant all on public.application_activities to service_role;

create policy "Read own activities" on public.application_activities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own activities" on public.application_activities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own activities" on public.application_activities
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own activities" on public.application_activities
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
