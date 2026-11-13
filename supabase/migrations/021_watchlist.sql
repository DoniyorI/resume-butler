-- Watchlist: companies whose public Greenhouse, Lever or Ashby job board the
-- server reads, and the open postings that match the user's title keywords.
-- Apply after 020.
--
-- The composite foreign key (company_id, user_id) is what stops a posting
-- being attached to another user's company, so it needs a unique key on
-- watched_companies(id, user_id) to point at. Caps: 20 companies and 2,500
-- postings per user, enforced here because authenticated users can insert
-- directly.
begin;

create table public.watched_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('greenhouse','lever','ashby')),
  board_token text not null check (board_token ~ '^[A-Za-z0-9_-]{1,100}$'),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  title_keywords text[] not null default '{}' check (cardinality(title_keywords) <= 12 and char_length(array_to_string(title_keywords, ',')) <= 800),
  last_checked_at timestamptz,
  last_error text not null default '' check (char_length(last_error) <= 300),
  open_count integer check (open_count is null or open_count >= 0),   -- open postings on the board at the last check
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, board_token)
);
create unique index watched_companies_id_owner on public.watched_companies(id, user_id);

create table public.watched_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null,
  posting_id text not null check (char_length(posting_id) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  location text not null default '' check (char_length(location) <= 300),
  url text not null check (char_length(url) <= 2000 and url ~* '^https://'),
  description text not null default '' check (char_length(description) <= 20000),
  workplace_type text not null default '' check (workplace_type in ('','remote','hybrid','onsite')),
  employment_type text not null default '' check (char_length(employment_type) <= 40),
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  dismissed_at timestamptz,
  saved_at timestamptz,
  foreign key (company_id, user_id) references public.watched_companies(id, user_id) on delete cascade,
  unique (company_id, posting_id)
);

create index watched_postings_user_seen on public.watched_postings(user_id, first_seen_at desc);
create index watched_postings_company on public.watched_postings(company_id);

create trigger set_updated_at before update on public.watched_companies
  for each row execute function public.handle_updated_at();

-- The per-user advisory locks serialize concurrent inserts so two of them
-- cannot both pass the count.
create function public.enforce_watched_company_limit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('watched_companies:'||new.user_id::text,0));
  if (select count(*) from public.watched_companies where user_id=new.user_id)>=20 then
    raise exception 'Watchlist limit reached (20 companies). Remove one first.' using errcode='54000';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_watched_company_limit() from public,anon,authenticated;

create trigger enforce_watched_company_limit before insert on public.watched_companies
  for each row execute function public.enforce_watched_company_limit();

create function public.enforce_watched_posting_limit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('watched_postings:'||new.user_id::text,0));
  if (select count(*) from public.watched_postings where user_id=new.user_id)>=2500 then
    raise exception 'Watched postings limit reached (2500).' using errcode='54000';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_watched_posting_limit() from public,anon,authenticated;

create trigger enforce_watched_posting_limit before insert on public.watched_postings
  for each row execute function public.enforce_watched_posting_limit();

alter table public.watched_companies enable row level security;
alter table public.watched_postings enable row level security;
revoke all on public.watched_companies from public, anon, authenticated;
revoke all on public.watched_postings from public, anon, authenticated;
-- Users choose what to watch (name, keywords); the server records checks. Column
-- grants keep last_checked_at, last_error and open_count out of their reach
-- (they would defeat the refresh throttle and the cron's oldest-first order):
-- those change only through record_watch_check below.
grant select, delete on public.watched_companies to authenticated;
grant insert (user_id, platform, board_token, name, title_keywords) on public.watched_companies to authenticated;
grant update (name, title_keywords) on public.watched_companies to authenticated;
grant select, insert, update, delete on public.watched_postings to authenticated;
grant all on public.watched_companies to service_role;
grant all on public.watched_postings to service_role;

create policy "Read own watched companies" on public.watched_companies
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own watched companies" on public.watched_companies
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own watched companies" on public.watched_companies
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own watched companies" on public.watched_companies
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own watched postings" on public.watched_postings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own watched postings" on public.watched_postings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own watched postings" on public.watched_postings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own watched postings" on public.watched_postings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Records that a company's board was just read. last_checked_at only ever moves
-- to now(); open_count changes only for a valid count.
create function public.record_watch_check(p_company_id uuid, p_error text, p_open_count integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_updated integer;
begin
  update public.watched_companies set
    last_checked_at=now(),
    last_error=left(coalesce(p_error,''),300),
    open_count=case when p_open_count is not null and p_open_count>=0 then p_open_count else open_count end
  where id=p_company_id and (user_id=auth.uid() or coalesce(auth.role(),'')='service_role');
  get diagnostics v_updated=row_count;
  if v_updated=0 then raise exception 'Company not found' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.record_watch_check(uuid,text,integer) from public,anon;
grant execute on function public.record_watch_check(uuid,text,integer) to authenticated,service_role;

-- The per-user limiter gains two keys for the watchlist: the body is the one
-- from 015 with 'watchlist-add' (20 an hour) and 'watchlist-check' (60 an hour).
create or replace function public.consume_rate_limit(p_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_limit integer; v_count integer; v_window interval:=interval '1 hour';
begin
  if v_user is null then return false; end if;
  case p_key
    when 'generate-resume' then v_limit:=20;
    when 'generate-cover-letter' then v_limit:=20;
    when 'suggest-bullets' then v_limit:=30;
    when 'rewrite-bullet' then v_limit:=120;
    when 'parse-resume' then v_limit:=10;
    when 'scan-emails' then v_limit:=10;
    when 'download-resume' then v_limit:=60;
    when 'submission-capture' then v_limit:=60;
    when 'watchlist-add' then v_limit:=20;
    when 'watchlist-check' then v_limit:=60;
    else raise exception 'Unknown rate limit key: %',p_key;
  end case;
  insert into public.api_rate_limits as r(user_id,key,window_start,count) values(v_user,p_key,now(),1)
  on conflict(user_id,key) do update
    set count=case when r.window_start<now()-v_window then 1 else r.count+1 end,
        window_start=case when r.window_start<now()-v_window then now() else r.window_start end
  returning count into v_count;
  return v_count<=v_limit;
end $$;
revoke all on function public.consume_rate_limit(text) from public,anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

commit;
