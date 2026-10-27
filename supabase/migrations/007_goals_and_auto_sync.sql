-- Application goals and the daily email auto-sync.

-----------------------------------------------------------
-- GOALS: "apply to N jobs a day / a week", shown on the dashboard
-----------------------------------------------------------
alter table public.profiles
  add column if not exists goal_period text,
  add column if not exists goal_target integer;

alter table public.profiles
  drop constraint if exists profiles_goal_check;
alter table public.profiles
  add constraint profiles_goal_check check (
    (goal_period is null and goal_target is null)
    or (goal_period in ('day', 'week') and goal_target between 1 and 200)
  );

-----------------------------------------------------------
-- AUTO-SYNC: a daily job (/api/cron/email-sync, Vercel Cron) scans the inbox
-- of everyone who turned it on. Like a manual scan, it only creates
-- suggestions for the user to review.
-----------------------------------------------------------
alter table public.email_connections
  add column if not exists auto_sync boolean not null default false,
  add column if not exists last_auto_sync_at timestamptz,
  add column if not exists last_auto_sync_error text;

-- The job looks up opted-in connections, oldest sync first
create index if not exists email_connections_auto_sync_idx
  on public.email_connections (last_auto_sync_at nulls first)
  where auto_sync and is_active;
