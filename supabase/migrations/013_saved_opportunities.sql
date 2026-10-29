-- Saved jobs are preparation, never application events. Apply after 012.
begin;

create table public.job_opportunities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  identity_key text not null check(length(identity_key) between 1 and 2500),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  resume_id uuid references public.resumes(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,identity_key)
);
create index job_opportunities_user_updated_idx on public.job_opportunities(user_id,updated_at desc);
create index job_opportunities_resume_idx on public.job_opportunities(resume_id) where resume_id is not null;
create index job_opportunities_application_idx on public.job_opportunities(application_id) where application_id is not null;
alter table public.job_opportunities enable row level security;
revoke all on public.job_opportunities from public,anon,authenticated;
grant select,delete on public.job_opportunities to authenticated;
grant all on public.job_opportunities to service_role;
create policy "Read own saved jobs" on public.job_opportunities for select to authenticated using ((select auth.uid())=user_id);
create policy "Delete own saved jobs" on public.job_opportunities for delete to authenticated using ((select auth.uid())=user_id);

create function public.opportunity_identity_key(p_url text)
returns text language sql immutable set search_path='' as $$
  select case when d->>'postingId' is not null then
    (d->>'platform')||':'||(d->>'namespace')||':'||(d->>'postingId')
    else 'url:'||(d->>'urlKey') end from (select public.posting_identity_key(p_url) d) s;
$$;
revoke all on function public.opportunity_identity_key(text) from public,anon,authenticated;

-- Exact posting evidence only. More than one candidate stays unlinked.
create function public.opportunity_application(p_user uuid,p_key text)
returns uuid language sql stable set search_path='' as $$
  with evidence as (
    select id,public.opportunity_identity_key(portal_link) url_key,
      case when posting_platform is not null and posting_namespace is not null and posting_id is not null
        then posting_platform||':'||posting_namespace||':'||posting_id
        else public.opportunity_identity_key(coalesce(nullif(posting_url_key,''),portal_link)) end stored_key
    from public.applications where user_id=p_user
      and coalesce(applied_date::timestamp at time zone 'UTC',created_at)>=now()-interval '120 days'
  )
  select case when count(*)=1 and count(*) filter(where url_key<>'url:' and stored_key<>'url:' and url_key<>stored_key)=0
    then (array_agg(id))[1] else null end
  from evidence where url_key=p_key or stored_key=p_key;
$$;
revoke all on function public.opportunity_application(uuid,text) from public,anon,authenticated;

create function public.save_job_opportunity(p_user_id uuid,p_payload jsonb,p_resume_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_key text; v_id uuid; v_result public.job_opportunities%rowtype; v_link text;
begin
  if p_user_id is null or (coalesce(auth.role(),'')<>'service_role' and auth.uid() is distinct from p_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>120000
    or coalesce(length(btrim(p_payload->>'company')),0) not between 1 and 200
    or coalesce(length(p_payload->>'role'),0)>200 or coalesce(length(p_payload->>'location'),0)>200
    or coalesce(length(p_payload->>'job_description'),0)>50000
    or coalesce(length(p_payload->>'portal_link'),0) not between 1 and 2000
    or (p_payload->>'portal_link') !~ '^https?://[^/[:space:]]+' then
    raise exception 'Invalid saved job' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  -- Lock the selected source against concurrent deletion until commit.
  if p_resume_id is not null then
    perform 1 from public.resumes where id=p_resume_id and user_id=p_user_id for key share;
    if not found then raise exception 'Resume not found' using errcode='P0002'; end if;
  end if;
  v_link:=public.posting_identity_key(p_payload->>'portal_link')->>'urlKey';
  v_key:=public.opportunity_identity_key(v_link);
  select id into v_id from public.job_opportunities where user_id=p_user_id and identity_key=v_key;
  if v_id is null and (select count(*) from public.job_opportunities where user_id=p_user_id)>=2000 then
    raise exception 'Saved jobs limit reached (2000). Remove older jobs first.' using errcode='54000';
  end if;
  insert into public.job_opportunities(user_id,identity_key,payload,resume_id,application_id)
    values(p_user_id,v_key,jsonb_set(p_payload,'{portal_link}',to_jsonb(v_link)),p_resume_id,public.opportunity_application(p_user_id,v_key))
    on conflict(user_id,identity_key) do update set payload=excluded.payload,resume_id=excluded.resume_id,
      application_id=excluded.application_id,updated_at=now()
    returning * into v_result;
  return to_jsonb(v_result);
end;
$$;
revoke all on function public.save_job_opportunity(uuid,jsonb,uuid) from public,anon;
grant execute on function public.save_job_opportunity(uuid,jsonb,uuid) to authenticated,service_role;

create function public.link_saved_opportunity()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_key text; v_old_key text; v_stored text; v_old_stored text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  v_key:=public.opportunity_identity_key(new.portal_link);
  v_stored:=coalesce(new.posting_platform||':'||new.posting_namespace||':'||new.posting_id,public.opportunity_identity_key(new.posting_url_key));
  if tg_op='UPDATE' then
    v_old_key:=public.opportunity_identity_key(old.portal_link);
    v_old_stored:=coalesce(old.posting_platform||':'||old.posting_namespace||':'||old.posting_id,public.opportunity_identity_key(old.posting_url_key));
  end if;
  update public.job_opportunities set application_id=public.opportunity_application(new.user_id,identity_key)
    where user_id=new.user_id and identity_key in (v_key,v_old_key,v_stored,v_old_stored);
  return new;
end;
$$;
revoke all on function public.link_saved_opportunity() from public,anon,authenticated;
create trigger applications_link_saved_job after insert or update of portal_link,applied_date,posting_platform,posting_namespace,posting_id,posting_url_key on public.applications
  for each row execute function public.link_saved_opportunity();

commit;
