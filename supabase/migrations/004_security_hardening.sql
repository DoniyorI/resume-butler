-- Security hardening: per-user rate limits for expensive API routes, pinned
-- search_path on SECURITY DEFINER functions, and data checks on applications.

-----------------------------------------------------------
-- RATE LIMITS
-----------------------------------------------------------
create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (user_id, key)
);

-- RLS on with no policies: the table is only reachable through the function below
alter table public.api_rate_limits enable row level security;

-- Counts one request for the calling user and returns whether it is within the
-- limit (fixed window). Called by the API routes via supabase.rpc(). Limits are
-- defined here, not passed in, so a user calling the function directly can't
-- pick a tiny window to reset their own counter.
create or replace function public.consume_rate_limit(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_window interval;
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  case p_key
    when 'generate-resume' then v_limit := 20; v_window := interval '1 hour';
    when 'generate-cover-letter' then v_limit := 20; v_window := interval '1 hour';
    when 'suggest-bullets' then v_limit := 30; v_window := interval '1 hour';
    when 'parse-resume' then v_limit := 10; v_window := interval '1 hour';
    when 'scan-emails' then v_limit := 10; v_window := interval '1 hour';
    when 'download-resume' then v_limit := 60; v_window := interval '1 hour';
    else raise exception 'Unknown rate limit key: %', p_key;
  end case;

  insert into public.api_rate_limits as r (user_id, key, window_start, count)
  values (v_user, p_key, now(), 1)
  on conflict (user_id, key) do update
    set count = case when r.window_start < now() - v_window then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - v_window then now() else r.window_start end
  returning count into v_count;

  return v_count <= v_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

-----------------------------------------------------------
-- SECURITY DEFINER FUNCTIONS: pin search_path
-----------------------------------------------------------
-- Without a fixed search_path, a SECURITY DEFINER function can be tricked into
-- resolving names to objects in another schema. These bodies already use
-- fully qualified names, so an empty search_path is safe.
alter function public.handle_new_user() set search_path = '';
alter function public.log_status_change() set search_path = '';
alter function public.log_initial_status() set search_path = '';
alter function public.handle_updated_at() set search_path = '';

-----------------------------------------------------------
-- APPLICATION DATA CHECKS
-----------------------------------------------------------
-- Email sync, AI and (later) the browser extension write applications, so the
-- database enforces the basics too. NOT VALID skips existing rows.
alter table public.applications
  add constraint applications_portal_link_http
  check (portal_link is null or portal_link = '' or portal_link ~* '^https?://')
  not valid;

alter table public.applications
  add constraint applications_status_known
  check (status in ('Applied', 'Interviewed', 'Pending', 'Offered', 'Rejected', 'Withdrew', 'Reached Out'))
  not valid;
