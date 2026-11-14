-- Offer closure: the terms of a job offer and the decision on it, one record
-- per application. Also adds the rate limit keys for data export and
-- application import. Apply after 021.
--
-- The decide-by date is not stored here: it is the open "offer_deadline" step
-- in application_activities. The composite foreign key (application_id,
-- user_id) stops an offer being attached to another user's application; it
-- uses the unique index applications(id, user_id) created by migration 020.
begin;

create table public.application_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null,
  base_amount integer check (base_amount is null or base_amount >= 0),
  base_period text not null default 'year' check (base_period in ('hour','day','week','month','year')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  bonus text not null default '' check (char_length(bonus) <= 500),
  equity text not null default '' check (char_length(equity) <= 500),
  benefits text not null default '' check (char_length(benefits) <= 1000),
  start_date date,
  received_on date,
  decision text not null default 'pending' check (decision in ('pending','accepted','declined')),
  decided_on date,
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  unique (application_id),
  check ((decision = 'pending') = (decided_on is null))
);

create index application_offers_user_decision on public.application_offers(user_id, decision);

create trigger set_updated_at before update on public.application_offers
  for each row execute function public.handle_updated_at();

alter table public.application_offers enable row level security;
revoke all on public.application_offers from public, anon, authenticated;
grant select, insert, update, delete on public.application_offers to authenticated;
grant all on public.application_offers to service_role;

create policy "Read own offers" on public.application_offers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own offers" on public.application_offers
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own offers" on public.application_offers
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own offers" on public.application_offers
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The per-user limiter gains two keys: the body is the one from 021 with
-- 'export-data' and 'import-applications' (10 an hour each).
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
    when 'export-data' then v_limit:=10;
    when 'import-applications' then v_limit:=10;
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
