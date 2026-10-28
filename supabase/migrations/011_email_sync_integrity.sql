-- Concurrency protection and transactional suggestion approval.
-- Additive migration: older application code can continue to use the tables.
begin;

alter table public.email_connections
  add column if not exists last_auto_sync_attempt_at timestamptz;

create index if not exists email_connections_auto_sync_attempt_idx
  on public.email_connections (last_auto_sync_attempt_at nulls first)
  where auto_sync and is_active;

create table if not exists public.email_sync_locks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lease_token uuid not null,
  expires_at timestamptz not null
);
alter table public.email_sync_locks enable row level security;
revoke all on public.email_sync_locks from anon, authenticated;

create or replace function public.acquire_email_sync_lock(p_user_id uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from p_user_id and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.email_sync_locks as current_lock (user_id, lease_token, expires_at)
    values (p_user_id, p_token, now() + interval '90 seconds')
    on conflict (user_id) do update
      set lease_token = excluded.lease_token, expires_at = excluded.expires_at
      where current_lock.expires_at <= now();
  return found;
end;
$$;

create or replace function public.release_email_sync_lock(p_user_id uuid, p_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from p_user_id and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.email_sync_locks where user_id = p_user_id and lease_token = p_token;
end;
$$;

revoke all on function public.acquire_email_sync_lock(uuid, uuid) from public, anon;
revoke all on function public.release_email_sync_lock(uuid, uuid) from public, anon;
grant execute on function public.acquire_email_sync_lock(uuid, uuid) to authenticated, service_role;
grant execute on function public.release_email_sync_lock(uuid, uuid) to authenticated, service_role;

-- Private helpers mirror matching.js normalization for exact approval dedupe.
create or replace function public.email_company_key(value text)
returns text language sql immutable set search_path = '' as $$
  select case when length(value) > 100 then '' else
    trim(regexp_replace(regexp_replace(regexp_replace(lower(value), '[^a-z0-9& ]', ' ', 'g'),
      '\m(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc)\M', ' ', 'g'), '\s+', ' ', 'g')) end;
$$;
create or replace function public.email_role_key(value text)
returns text language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(value), '[^a-z0-9]+', ' ', 'g'));
$$;
revoke all on function public.email_company_key(text) from public, anon, authenticated;
revoke all on function public.email_role_key(text) from public, anon, authenticated;

create or replace function public.approve_application_suggestion(
  p_suggestion_id uuid, p_company text, p_role text, p_status text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_suggestion public.application_suggestions%rowtype;
  v_application public.applications%rowtype;
  v_application_id uuid;
  v_company text := btrim(p_company);
  v_role text := btrim(coalesce(p_role, ''));
  v_company_key text;
  v_role_key text;
  v_event timestamptz;
  v_count integer;
  v_progress text[] := array['Applied', 'Reached Out', 'Pending', 'Interviewed', 'Offered'];
begin
  if v_user is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_company is null or length(v_company) not between 1 and 200 or length(v_role) > 200
      or p_status is null or p_status not in ('Applied', 'Reached Out', 'Pending', 'Interviewed', 'Offered', 'Rejected', 'Withdrew') then
    raise exception 'Invalid suggestion fields' using errcode = '22023';
  end if;

  -- Two different pending suggestions for one user must not race to insert
  -- the same application. The lock ends with this transaction, even on error.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into v_suggestion from public.application_suggestions
    where id = p_suggestion_id and user_id = v_user for update;
  if not found then raise exception 'Suggestion not found' using errcode = 'P0002'; end if;
  if v_suggestion.state = 'approved' then
    select id into v_application_id from public.applications
      where id = v_suggestion.application_id and user_id = v_user;
    if found then return v_application_id; end if;
  end if;
  if v_suggestion.state <> 'pending' then
    raise exception 'This suggestion was already handled' using errcode = '55000';
  end if;

  v_event := least(coalesce(v_suggestion.email_date, now()), now());
  if v_suggestion.kind = 'update' then
    select * into v_application from public.applications
      where id = v_suggestion.application_id and user_id = v_user for update;
    if not found then raise exception 'This application was deleted' using errcode = 'P0002'; end if;
  else
    v_company_key := public.email_company_key(v_company);
    v_role_key := public.email_role_key(v_role);
    if length(v_company_key) >= 2 and v_company_key <> 'unknown' then
      -- Only exact roles are deduplicated during approval of a new suggestion.
      -- A role-less email can reuse one unambiguous recent open application.
      select count(*) into v_count from public.applications a
        where a.user_id = v_user and public.email_company_key(a.company) = v_company_key
          and a.status not in ('Rejected', 'Withdrew')
          and coalesce(a.applied_date::timestamp at time zone 'UTC', a.created_at) >= v_event - interval '120 days'
          and coalesce(a.applied_date, (a.created_at at time zone 'UTC')::date) <= (v_event at time zone 'UTC')::date
          and (v_role_key = '' or public.email_role_key(a.role) = v_role_key);
      if v_count > 0 and (v_role_key <> '' or v_count = 1) then
        select * into v_application from public.applications a
          where a.user_id = v_user and public.email_company_key(a.company) = v_company_key
            and a.status not in ('Rejected', 'Withdrew')
            and coalesce(a.applied_date::timestamp at time zone 'UTC', a.created_at) >= v_event - interval '120 days'
            and coalesce(a.applied_date, (a.created_at at time zone 'UTC')::date) <= (v_event at time zone 'UTC')::date
            and (v_role_key = '' or public.email_role_key(a.role) = v_role_key)
          order by a.applied_date desc nulls last, a.created_at desc limit 1 for update;
      end if;
    end if;
  end if;

  if v_application.id is not null then
    v_application_id := v_application.id;
    if v_application.status <> p_status then
      if array_position(v_progress, v_application.status) is null
          or (p_status = 'Rejected' and v_application.status = 'Offered')
          or (p_status <> 'Rejected' and coalesce(array_position(v_progress, p_status), 0)
              <= array_position(v_progress, v_application.status)) then
        raise exception 'The application status changed since this email was scanned' using errcode = '55000';
      end if;
      update public.applications set status = p_status where id = v_application_id and user_id = v_user;
    end if;
  else
    insert into public.applications (user_id, company, role, status, applied_date, source, comments)
      values (v_user, v_company, v_role, p_status, (v_event at time zone 'UTC')::date, 'email',
        case when v_suggestion.summary is null then '' else 'From email: ' || left(v_suggestion.summary, 500) end)
      returning id into v_application_id;
  end if;

  update public.application_suggestions
    set state = 'approved', resolved_at = now(), application_id = v_application_id
    where id = p_suggestion_id and user_id = v_user;
  return v_application_id;
end;
$$;
revoke all on function public.approve_application_suggestion(uuid, text, text, text) from public, anon;
grant execute on function public.approve_application_suggestion(uuid, text, text, text) to authenticated;

commit;
