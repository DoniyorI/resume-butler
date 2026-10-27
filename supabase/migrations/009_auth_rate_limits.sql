-- Rate limits for sign-in, sign-up and password reset. These run as Server
-- Actions, so Supabase Auth sees the server's IP for every visitor and its own
-- per-IP limits no longer tell visitors apart. The app counts attempts itself,
-- per visitor IP and per email address. Buckets are SHA-256 hashes (no raw IPs
-- or emails are stored), and only the server's service role can use them.

create table if not exists public.auth_rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

alter table public.auth_rate_limits enable row level security;
-- No policies: nobody but the service role (which bypasses RLS) can read or write it
revoke all on public.auth_rate_limits from anon, authenticated;

-- Counts one attempt for `p_bucket`; true while within `p_limit` per window
create or replace function public.consume_auth_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval := make_interval(secs => p_window_seconds);
  v_count integer;
begin
  insert into public.auth_rate_limits as r (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set count = case when r.window_start < now() - v_window then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - v_window then now() else r.window_start end
  returning count into v_count;

  -- Old buckets are only noise: clear out ones idle for a day, now and then
  if random() < 0.01 then
    delete from public.auth_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_auth_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, integer, integer) to service_role;
