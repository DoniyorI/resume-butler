-- Posting identity and durable extension submission receipts. Additive to 011.
begin;

alter table public.applications
  add column if not exists posting_platform text,
  add column if not exists posting_namespace text,
  add column if not exists posting_id text,
  add column if not exists posting_url_key text;
create index if not exists applications_posting_identity_idx
  on public.applications(user_id, posting_platform, posting_namespace, posting_id);

alter table public.application_suggestions
  add column if not exists match_reason text,
  add column if not exists match_candidate_ids uuid[];

create table if not exists public.application_ingest_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'extension' check (source = 'extension'),
  event_id uuid not null,
  payload_hash text not null,
  application_id uuid references public.applications(id) on delete set null,
  state text not null check (state in ('needs_matching','recorded','deleted')),
  created_application boolean not null default false,
  pending_payload jsonb,
  candidate_ids uuid[] not null default '{}',
  match_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key(user_id,source,event_id),
  check (pending_payload is null or octet_length(pending_payload::text) <= 120000)
);
alter table public.application_ingest_events enable row level security;
revoke all on public.application_ingest_events from public, anon, authenticated;
create index if not exists application_ingest_events_pending_idx
  on public.application_ingest_events(user_id,created_at) where state='needs_matching';

-- Mirror supported URL identities without fetching any external address.
create or replace function public.posting_identity_key(p_url text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_url text:=coalesce(p_url,''); v_host text; v_path text; v_platform text;
  v_namespace text; v_id text; v_key text; v_uuid text:='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
begin
  v_url:=split_part(v_url,'#',1);
  v_host:=lower(substring(v_url from '^https?://([^/?:#]+)(?:[/?#]|$)'));
  v_path:=substring(v_url from '^https?://[^/]+(/[^?#]*)');
  if v_host='www.linkedin.com' then
    v_platform:='linkedin'; v_namespace:='global';
    v_id:=substring(v_path from '^/jobs/view/(?:[^/]*-)?([0-9]+)(?:/|$)');
    if v_id is null and v_path like '/jobs/%' then v_id:=substring(v_url from '[?&]currentJobId=([0-9]+)(?:&|$)'); end if;
    v_key:='https://www.linkedin.com/jobs/view/'||v_id||'/';
  elsif v_host in ('boards.greenhouse.io','job-boards.greenhouse.io') then
    v_platform:='greenhouse';
    if v_path like '/embed/%' then
      v_namespace:=substring(v_url from '[?&]for=([A-Za-z0-9_-]+)(?:&|$)');
      v_id:=substring(v_url from '[?&]token=([0-9]+)(?:&|$)');
    else
      v_namespace:=substring(v_path from '^/([A-Za-z0-9_-]+)/jobs/[0-9]+(?:/|$)');
      v_id:=substring(v_path from '^/[A-Za-z0-9_-]+/jobs/([0-9]+)(?:/|$)');
    end if;
    v_key:='https://job-boards.greenhouse.io/'||v_namespace||'/jobs/'||v_id;
  elsif v_host in ('jobs.lever.co','jobs.ashbyhq.com') then
    v_platform:=case when v_host='jobs.lever.co' then 'lever' else 'ashby' end;
    v_namespace:=substring(v_path from '^/([A-Za-z0-9_-]+)/'||v_uuid||'(?:/|$)');
    v_id:=lower(substring(v_path from '^/[A-Za-z0-9_-]+/('||v_uuid||')(?:/|$)'));
    v_key:='https://'||v_host||'/'||v_namespace||'/'||v_id;
  end if;
  if v_id is null or v_namespace is null or length(v_id)>200 or length(v_namespace)>200 then
    v_platform:=null; v_namespace:=null; v_id:=null;
    v_key:=regexp_replace(v_url,'([?&])(utm_[^=&#]+|trk|trackingId|gh_src|lever-source)=[^&#]*','\1','gi');
    v_key:=regexp_replace(regexp_replace(v_key,'[?&]+$','','g'),'([?&])&+','\1','g');
  end if;
  return jsonb_build_object('platform',v_platform,'namespace',v_namespace,'postingId',v_id,'urlKey',v_key);
end;
$$;
revoke all on function public.posting_identity_key(text) from public,anon,authenticated;

create or replace function public.extension_match_decision(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare a public.applications%rowtype; d jsonb; c jsonb; incoming jsonb;
  strong uuid[]:='{}'; weak uuid[]:='{}'; conflicting uuid[]:='{}'; chosen uuid[];
  same_id boolean; same_url boolean; same_names boolean; inconsistent boolean;
begin
  incoming:=public.posting_identity_key(p_payload->>'portal_link');
  for a in select * from public.applications where user_id=p_user
    and status not in ('Rejected','Withdrew')
    and coalesce(applied_date::timestamp at time zone 'UTC',created_at)>=now()-interval '120 days'
    order by id
  loop
    d:=public.posting_identity_key(a.portal_link);
    c:=case when a.posting_platform is not null and a.posting_namespace is not null and a.posting_id is not null
      then jsonb_build_object('platform',a.posting_platform,'namespace',a.posting_namespace,'postingId',a.posting_id,'urlKey',coalesce(a.posting_url_key,d->>'urlKey')) else d end;
    same_id:=coalesce(incoming->>'platform'=c->>'platform' and incoming->>'namespace'=c->>'namespace' and incoming->>'postingId'=c->>'postingId',false);
    same_url:=coalesce(incoming->>'urlKey'<>'',false) and incoming->>'urlKey'=c->>'urlKey';
    same_names:=length(public.email_company_key(p_payload->>'company'))>=2
      and public.email_role_key(p_payload->>'role')<>''
      and public.email_company_key(a.company)=public.email_company_key(p_payload->>'company')
      and public.email_role_key(a.role)=public.email_role_key(p_payload->>'role');
    inconsistent:=d->>'platform' is not null and c->>'platform' is not null
      and (d->>'platform',d->>'namespace',d->>'postingId') is distinct from (c->>'platform',c->>'namespace',c->>'postingId');
    if inconsistent and (same_id or same_url or same_names) then conflicting:=array_append(conflicting,a.id); continue; end if;
    if incoming->>'platform' is not null and c->>'platform' is not null and not same_id then continue; end if;
    if same_id or same_url then strong:=array_append(strong,a.id); continue; end if;
    if coalesce(incoming->>'urlKey','')<>'' and coalesce(c->>'urlKey','')<>'' and incoming->>'urlKey'<>c->>'urlKey' then continue; end if;
    if same_names then weak:=array_append(weak,a.id); end if;
  end loop;
  if cardinality(conflicting)>0 then return jsonb_build_object('kind','ambiguous','candidateIds',to_jsonb(conflicting||strong),'reason','conflicting_identity'); end if;
  chosen:=case when cardinality(strong)>0 then strong else weak end;
  if cardinality(chosen)>1 then return jsonb_build_object('kind','ambiguous','candidateIds',to_jsonb(chosen),'reason','multiple_candidates'); end if;
  if cardinality(chosen)=1 then return jsonb_build_object('kind','matched','applicationId',chosen[1]); end if;
  return jsonb_build_object('kind','new');
end;
$$;
revoke all on function public.extension_match_decision(uuid,jsonb) from public,anon,authenticated;

create or replace function public.write_extension_application(p_user uuid,p_payload jsonb,p_target uuid)
returns uuid language plpgsql set search_path='' as $$
declare a public.applications%rowtype; v_id uuid;
begin
  if p_target is null then
    insert into public.applications(user_id,company,role,location,portal_link,job_description,applied_date,status,source,
      posting_platform,posting_namespace,posting_id,posting_url_key,salary_min,salary_max,salary_currency,salary_period,workplace_type,employment_type,source_site,comments)
    values(p_user,p_payload->>'company',p_payload->>'role',p_payload->>'location',nullif(p_payload->>'portal_link',''),nullif(p_payload->>'job_description',''),
      (p_payload->>'applied_date')::date,'Applied','extension',p_payload->>'posting_platform',p_payload->>'posting_namespace',p_payload->>'posting_id',p_payload->>'posting_url_key',
      (p_payload->>'salary_min')::numeric,(p_payload->>'salary_max')::numeric,coalesce(p_payload->>'salary_currency','USD'),coalesce(p_payload->>'salary_period','year'),
      p_payload->>'workplace_type',p_payload->>'employment_type',p_payload->>'source_site','Added by the browser extension') returning id into v_id;
    return v_id;
  end if;
  select * into a from public.applications where id=p_target and user_id=p_user for update;
  if not found then raise exception 'Application is no longer available' using errcode='55000'; end if;
  update public.applications set
    portal_link=coalesce(nullif(a.portal_link,''),nullif(p_payload->>'portal_link','')),
    job_description=coalesce(nullif(a.job_description,''),nullif(p_payload->>'job_description','')),
    location=coalesce(nullif(a.location,''),p_payload->>'location'),
    posting_platform=coalesce(a.posting_platform,p_payload->>'posting_platform'),
    posting_namespace=coalesce(a.posting_namespace,p_payload->>'posting_namespace'),
    posting_id=coalesce(a.posting_id,p_payload->>'posting_id'),
    posting_url_key=coalesce(a.posting_url_key,p_payload->>'posting_url_key'),
    salary_min=case when a.salary_min is null and a.salary_max is null then (p_payload->>'salary_min')::numeric else a.salary_min end,
    salary_max=case when a.salary_min is null and a.salary_max is null then (p_payload->>'salary_max')::numeric else a.salary_max end,
    salary_currency=case when a.salary_min is null and a.salary_max is null then coalesce(p_payload->>'salary_currency',a.salary_currency) else a.salary_currency end,
    salary_period=case when a.salary_min is null and a.salary_max is null then coalesce(p_payload->>'salary_period',a.salary_period) else a.salary_period end,
    workplace_type=coalesce(a.workplace_type,p_payload->>'workplace_type'),
    employment_type=coalesce(a.employment_type,p_payload->>'employment_type'),
    source_site=coalesce(a.source_site,p_payload->>'source_site')
  where id=p_target and user_id=p_user;
  return p_target;
end;
$$;
revoke all on function public.write_extension_application(uuid,jsonb,uuid) from public,anon,authenticated;

create or replace function public.extension_record_result(p_user uuid,p_application uuid,p_created boolean)
returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('application',jsonb_build_object('id',id,'company',company,'role',coalesce(role,''),'status',status,'appliedDate',applied_date),'created',p_created)
  from public.applications where user_id=p_user and id=p_application;
$$;
revoke all on function public.extension_record_result(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function public.record_extension_application(p_user_id uuid,p_event_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.application_ingest_events%rowtype; d jsonb; identity jsonb; v_id uuid; v_hash text; v_created boolean; v_count integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_user_id is null or p_event_id is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>120000
    or coalesce(length(btrim(p_payload->>'company')),0) not between 1 and 200 or coalesce(length(p_payload->>'role'),0)>200
    or coalesce(length(p_payload->>'location'),0)>200 or coalesce(length(p_payload->>'portal_link'),0)>2000
    or coalesce(length(p_payload->>'job_description'),0)>50000
    or coalesce(length(p_payload->>'posting_id'),0)>200 or coalesce(length(p_payload->>'posting_namespace'),0)>200
    or coalesce(length(p_payload->>'posting_platform'),0)>40
    or coalesce(length(p_payload->>'employment_type'),0)>40 or coalesce(length(p_payload->>'source_site'),0)>50
    or coalesce(p_payload->>'workplace_type','') not in ('','remote','hybrid','onsite')
    or coalesce(p_payload->>'salary_currency','USD')!~'^[A-Z]{3}$'
    or coalesce(p_payload->>'salary_period','year') not in ('hour','day','week','month','year')
    or coalesce(p_payload->>'applied_date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  then raise exception 'Invalid application fields' using errcode='22023'; end if;
  if (p_payload->>'salary_min')::numeric<0 or (p_payload->>'salary_max')::numeric<0
    or (p_payload->>'salary_min')::numeric>10000000 or (p_payload->>'salary_max')::numeric>10000000 then
    raise exception 'Invalid salary' using errcode='22023'; end if;
  identity:=public.posting_identity_key(p_payload->>'portal_link');
  if (p_payload->>'posting_platform',p_payload->>'posting_namespace',p_payload->>'posting_id') is distinct from
    (identity->>'platform',identity->>'namespace',identity->>'postingId') then raise exception 'Conflicting identity' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  v_hash:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  select * into e from public.application_ingest_events where user_id=p_user_id and source='extension' and event_id=p_event_id for update;
  if found then
    if e.payload_hash<>v_hash then raise exception 'The event payload changed' using errcode='55000'; end if;
    if e.state='needs_matching' then return jsonb_build_object('status','needs_matching','eventId',p_event_id); end if;
    if e.application_id is null or e.state='deleted' then raise exception 'Application was removed' using errcode='55000'; end if;
    return public.extension_record_result(p_user_id,e.application_id,e.created_application);
  end if;
  select count(*) into v_count from public.application_ingest_events where user_id=p_user_id and created_at>=now()-interval '1 hour';
  if v_count>=60 then raise exception 'Too many submissions' using errcode='54000'; end if;
  d:=public.extension_match_decision(p_user_id,p_payload);
  if d->>'kind'='ambiguous' then
    insert into public.application_ingest_events(user_id,event_id,payload_hash,state,pending_payload,candidate_ids,match_reason)
      values(p_user_id,p_event_id,v_hash,'needs_matching',p_payload,array(select jsonb_array_elements_text(d->'candidateIds')::uuid),d->>'reason');
    return jsonb_build_object('status','needs_matching','eventId',p_event_id);
  end if;
  v_created:=d->>'kind'='new';
  v_id:=public.write_extension_application(p_user_id,p_payload,(d->>'applicationId')::uuid);
  insert into public.application_ingest_events(user_id,event_id,payload_hash,application_id,state,created_application,resolved_at)
    values(p_user_id,p_event_id,v_hash,v_id,'recorded',v_created,now());
  return public.extension_record_result(p_user_id,v_id,v_created);
end;
$$;
revoke all on function public.record_extension_application(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_extension_application(uuid,uuid,jsonb) to service_role;

create or replace function public.list_unresolved_extension_events()
returns jsonb language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('eventId',e.event_id,'company',e.pending_payload->>'company','role',e.pending_payload->>'role',
    'appliedDate',e.pending_payload->>'applied_date','url',e.pending_payload->>'portal_link','reason',e.match_reason,
    'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'company',a.company,'role',a.role,'appliedDate',a.applied_date,'url',a.portal_link,'status',a.status)),'[]')
      from public.applications a where a.user_id=auth.uid() and a.id=any(e.candidate_ids))) order by e.created_at),'[]')
  from public.application_ingest_events e where e.user_id=auth.uid() and e.state='needs_matching';
$$;
revoke all on function public.list_unresolved_extension_events() from public,anon;
grant execute on function public.list_unresolved_extension_events() to authenticated;

create or replace function public.resolve_extension_application_event(p_event_id uuid,p_target_application_id uuid,p_create_new boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); e public.application_ingest_events%rowtype; a public.applications%rowtype; d jsonb; v_id uuid;
begin
  if v_user is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_create_new is null or p_create_new=(p_target_application_id is not null) then raise exception 'Choose one resolution' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select * into e from public.application_ingest_events where user_id=v_user and source='extension' and event_id=p_event_id for update;
  if not found then raise exception 'Submission not found' using errcode='P0002'; end if;
  if e.state='recorded' and e.application_id is not null then return public.extension_record_result(v_user,e.application_id,e.created_application); end if;
  if e.state<>'needs_matching' then raise exception 'Submission changed or was removed' using errcode='55000'; end if;
  if not p_create_new then
    select * into a from public.applications where id=p_target_application_id and user_id=v_user for update;
    if not found or not a.id=any(e.candidate_ids) then raise exception 'Application is no longer available' using errcode='P0002'; end if;
    if a.status in ('Rejected','Withdrew') or coalesce(a.applied_date::timestamp at time zone 'UTC',a.created_at)<now()-interval '120 days' then
      raise exception 'Application changed; review again' using errcode='55000'; end if;
    d:=public.posting_identity_key(a.portal_link);
    if (a.posting_id is not null and e.pending_payload->>'posting_id' is not null and (a.posting_platform,a.posting_namespace,a.posting_id) is distinct from
      (e.pending_payload->>'posting_platform',e.pending_payload->>'posting_namespace',e.pending_payload->>'posting_id'))
      or (d->>'platform' is not null and e.pending_payload->>'posting_platform' is not null and
        (d->>'platform',d->>'namespace',d->>'postingId') is distinct from
        (e.pending_payload->>'posting_platform',e.pending_payload->>'posting_namespace',e.pending_payload->>'posting_id')) then
      raise exception 'Different posting identities cannot be combined' using errcode='55000'; end if;
  end if;
  v_id:=public.write_extension_application(v_user,e.pending_payload,p_target_application_id);
  update public.application_ingest_events set state='recorded',application_id=v_id,created_application=p_create_new,pending_payload=null,
    resolved_at=now() where user_id=v_user and source='extension' and event_id=p_event_id;
  return public.extension_record_result(v_user,v_id,p_create_new);
end;
$$;
revoke all on function public.resolve_extension_application_event(uuid,uuid,boolean) from public,anon;
grant execute on function public.resolve_extension_application_event(uuid,uuid,boolean) to authenticated;

-- Recompute email eligibility inside the approval transaction. Exact roles win
-- over partial titles, and an email cannot update a later application cycle.
create or replace function public.email_resolution_candidates(p_user uuid,p_company text,p_role text,p_event timestamptz)
returns uuid[] language sql stable set search_path='' as $$
  with eligible as (
    select id, public.email_role_key(role) as role_key from public.applications
    where user_id=p_user
      and length(public.email_company_key(p_company))>=2
      and public.email_company_key(p_company)<>'unknown'
      and public.email_company_key(company)=public.email_company_key(p_company)
      and status not in ('Rejected','Withdrew')
      and coalesce(applied_date::timestamp at time zone 'UTC',created_at)>=p_event-interval '120 days'
      and coalesce(applied_date,(created_at at time zone 'UTC')::date)<=(p_event at time zone 'UTC')::date
  ), exact as (select id from eligible where role_key=public.email_role_key(p_role))
  select coalesce(array_agg(id order by id),'{}'::uuid[]) from eligible
  where coalesce(public.email_role_key(p_role),'')=''
    or (exists(select 1 from exact) and id in (select id from exact))
    or (not exists(select 1 from exact) and role_key<>'' and
      (position(' '||public.email_role_key(p_role)||' ' in ' '||role_key||' ')>0
       or position(' '||role_key||' ' in ' '||public.email_role_key(p_role)||' ')>0));
$$;
revoke all on function public.email_resolution_candidates(uuid,text,text,timestamptz) from public,anon,authenticated;

-- Null is a durable transition to matching review, never an approval.
-- One internal approval transaction supports ordinary and explicit matching.
create or replace function public.apply_suggestion_resolution(p_id uuid,p_company text,p_role text,p_status text,p_target uuid,p_create boolean,p_explicit boolean)
returns uuid language plpgsql set search_path='' as $$
declare v_user uuid:=auth.uid(); s public.application_suggestions%rowtype; a public.applications%rowtype; v_id uuid;
  v_event timestamptz; v_candidates uuid[]; v_progress text[]:=array['Applied','Reached Out','Pending','Interviewed','Offered'];
begin
  if v_user is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if coalesce(length(btrim(p_company)),0) not between 1 and 200 or length(coalesce(p_role,''))>200 or p_status is null
    or p_status not in ('Applied','Reached Out','Pending','Interviewed','Offered','Rejected','Withdrew') then
    raise exception 'Invalid suggestion' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select * into s from public.application_suggestions where id=p_id and user_id=v_user for update;
  if not found then raise exception 'Suggestion not found' using errcode='P0002'; end if;
  if s.state='approved' then
    select id into v_id from public.applications where id=s.application_id and user_id=v_user;
    if found then return v_id; end if;
  end if;
  if s.state<>'pending' then raise exception 'Suggestion already handled' using errcode='55000'; end if;
  if s.match_reason is not null and not p_explicit then raise exception 'Choose the correct application' using errcode='55000'; end if;
  v_event:=least(coalesce(s.email_date,now()),now());
  v_candidates:=public.email_resolution_candidates(v_user,
    case when s.kind='update' or p_explicit then s.company else p_company end,
    case when s.kind='update' or p_explicit then s.role else p_role end,v_event);
  if not p_explicit and (cardinality(v_candidates)>1 or
      (s.kind='update' and not coalesce(s.application_id=any(v_candidates),false))) then
    update public.application_suggestions set match_reason=case when cardinality(v_candidates)>1 then 'multiple_candidates' else 'application_changed' end,
      match_candidate_ids=v_candidates where id=p_id and user_id=v_user;
    return null;
  end if;
  if p_explicit then
    if p_create is null or p_create=(p_target is not null) then raise exception 'Choose one resolution' using errcode='22023'; end if;
    if p_target is not null then
      if not coalesce(p_target=any(s.match_candidate_ids),false) then raise exception 'Invalid application choice' using errcode='P0002'; end if;
      select * into a from public.applications where id=p_target and user_id=v_user for update;
      if not found or not coalesce(a.id=any(v_candidates),false) then raise exception 'Application changed' using errcode='55000'; end if;
    end if;
  elsif s.kind='update' then
    select * into a from public.applications where id=s.application_id and user_id=v_user for update;
    if not found then raise exception 'Application deleted' using errcode='P0002'; end if;
  else
    if cardinality(v_candidates)=1 then select * into a from public.applications where id=v_candidates[1] and user_id=v_user for update; end if;
  end if;
  if a.id is not null then
    v_id:=a.id;
    if a.status<>p_status then
      if array_position(v_progress,a.status) is null or (p_status='Rejected' and a.status='Offered')
        or (p_status<>'Rejected' and coalesce(array_position(v_progress,p_status),0)<=array_position(v_progress,a.status)) then
        raise exception 'Application status changed' using errcode='55000'; end if;
      update public.applications set status=p_status where id=v_id and user_id=v_user;
    end if;
  else
    insert into public.applications(user_id,company,role,status,applied_date,source,comments)
      values(v_user,btrim(p_company),btrim(coalesce(p_role,'')),p_status,(v_event at time zone 'UTC')::date,'email',coalesce('From email: '||left(s.summary,500),'')) returning id into v_id;
  end if;
  update public.application_suggestions set state='approved',resolved_at=now(),application_id=v_id,
    match_reason=case when p_explicit then 'resolved_by_user' else match_reason end where id=p_id and user_id=v_user;
  return v_id;
end;
$$;
revoke all on function public.apply_suggestion_resolution(uuid,text,text,text,uuid,boolean,boolean) from public,anon,authenticated;

create or replace function public.approve_application_suggestion(p_suggestion_id uuid,p_company text,p_role text,p_status text)
returns uuid language sql security definer set search_path='' as $$
  select public.apply_suggestion_resolution(p_suggestion_id,p_company,p_role,p_status,null,false,false);
$$;
revoke all on function public.approve_application_suggestion(uuid,text,text,text) from public,anon;
grant execute on function public.approve_application_suggestion(uuid,text,text,text) to authenticated;

create or replace function public.resolve_application_suggestion(p_suggestion_id uuid,p_target_application_id uuid,p_create_new boolean,p_company text,p_role text,p_status text)
returns uuid language sql security definer set search_path='' as $$
  select public.apply_suggestion_resolution(p_suggestion_id,p_company,p_role,p_status,p_target_application_id,p_create_new,true);
$$;
revoke all on function public.resolve_application_suggestion(uuid,uuid,boolean,text,text,text) from public,anon;
grant execute on function public.resolve_application_suggestion(uuid,uuid,boolean,text,text,text) to authenticated;

-- Explicit protocol version lets new clients fail closed before migration 012,
-- while the four-argument interface remains safe for existing clients.
create or replace function public.approve_application_suggestion(p_suggestion_id uuid,p_company text,p_role text,p_status text,p_identity_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if p_identity_version is distinct from 1 then raise exception 'Unsupported matching version' using errcode='22023'; end if;
  return public.apply_suggestion_resolution(p_suggestion_id,p_company,p_role,p_status,null,false,false);
end;
$$;
revoke all on function public.approve_application_suggestion(uuid,text,text,text,integer) from public,anon;
grant execute on function public.approve_application_suggestion(uuid,text,text,text,integer) to authenticated;

commit;
