begin;

create function public.valid_reusable_answer(p jsonb) returns boolean language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_typeof(p)='object' and octet_length(p::text)<=80000
    and (p-array['label','question','answer','category','tags','sourceNote','sourceUrl'])='{}'::jsonb
    and jsonb_typeof(p->'label')='string' and char_length(trim(p->>'label')) between 1 and 120
    and jsonb_typeof(p->'question')='string' and char_length(trim(p->>'question')) between 1 and 1000
    and jsonb_typeof(p->'answer')='string' and char_length(trim(p->>'answer')) between 1 and 10000
    and p->>'category' in ('general','project','behavioral','availability','compensation','eligibility','other')
    and jsonb_typeof(p->'sourceNote')='string' and char_length(p->>'sourceNote')<=2000
    and jsonb_typeof(p->'sourceUrl')='string' and char_length(p->>'sourceUrl')<=2000
    and (p->>'sourceUrl'='' or p->>'sourceUrl' ~* '^https?://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$')
    and case when jsonb_typeof(p->'tags')='array' then jsonb_array_length(p->'tags')<=8 and not exists(
      select 1 from jsonb_array_elements(p->'tags') t where jsonb_typeof(t)<>'string' or char_length(trim(t#>>'{}')) not between 1 and 32
    ) else false end,false)
$$;
revoke all on function public.valid_reusable_answer(jsonb) from public,anon,authenticated;
grant execute on function public.valid_reusable_answer(jsonb) to service_role;

create table public.reusable_answers (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null, question text not null, answer text not null,
  category text not null, tags jsonb not null,
  source_note text not null, source_url text not null,
  revision integer not null check(revision>0),
  approved_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(public.valid_reusable_answer(jsonb_build_object('label',label,'question',question,'answer',answer,'category',category,'tags',tags,'sourceNote',source_note,'sourceUrl',source_url)))
);
create index reusable_answers_owner_updated on public.reusable_answers(user_id,updated_at desc,id);
create table public.reusable_answer_versions (
  answer_id uuid not null references public.reusable_answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null,
  event_id uuid not null, request_hash text not null,
  action text not null check(action in ('draft','approve','archive','restore')),
  content jsonb not null, approved_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(answer_id,revision), unique(user_id,event_id)
);
create index reusable_answer_versions_owner on public.reusable_answer_versions(user_id,answer_id,revision);
-- Keep only IDs after permanent deletion so delayed create retries cannot revive text.
create table public.reusable_answer_tombstones (
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer_id uuid not null, deleted_at timestamptz not null default now(),
  primary key(user_id,answer_id)
);
alter table public.reusable_answers enable row level security;
alter table public.reusable_answer_versions enable row level security;
alter table public.reusable_answer_tombstones enable row level security;
create policy reusable_answers_read_own on public.reusable_answers for select to authenticated using(user_id=auth.uid());
create policy reusable_answer_versions_read_own on public.reusable_answer_versions for select to authenticated using(user_id=auth.uid());
create policy reusable_answer_tombstones_read_own on public.reusable_answer_tombstones for select to authenticated using(user_id=auth.uid());
revoke all on public.reusable_answers,public.reusable_answer_versions,public.reusable_answer_tombstones from public,anon,authenticated;
grant select on public.reusable_answers,public.reusable_answer_versions,public.reusable_answer_tombstones to authenticated;
grant all on public.reusable_answers,public.reusable_answer_versions,public.reusable_answer_tombstones to service_role;

create function public.save_reusable_answer(p_answer_id uuid,p_event_id uuid,p_expected_revision integer,p_action text,p_content jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_user uuid:=auth.uid(); v_current public.reusable_answers%rowtype;
  v_receipt public.reusable_answer_versions%rowtype; v_hash text; v_content jsonb;
begin
  if v_user is null then raise exception using errcode='42501',message='Sign in required'; end if;
  if p_answer_id is null or p_event_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>1000000000 or p_action is null or p_action not in ('draft','approve','archive','restore') or p_content is null or octet_length(p_content::text)>80000 then
    raise exception using errcode='22023',message='Invalid command';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('answer:'||v_user::text||':'||p_answer_id::text,0));
  v_hash:=encode(sha256(convert_to(jsonb_build_object('id',p_answer_id,'revision',p_expected_revision,'action',p_action,'content',p_content)::text,'UTF8')),'hex');
  select * into v_receipt from public.reusable_answer_versions where user_id=v_user and event_id=p_event_id;
  if found then
    if v_receipt.request_hash<>v_hash then raise exception using errcode='55000',message='Command changed'; end if;
    return jsonb_build_object('id',v_receipt.answer_id,'revision',v_receipt.revision);
  end if;
  if exists(select 1 from public.reusable_answer_tombstones where user_id=v_user and answer_id=p_answer_id) then
    raise exception using errcode='P0002',message='Answer deleted';
  end if;
  if p_action in ('draft','approve') then
    if not public.valid_reusable_answer(p_content) then raise exception using errcode='22023',message='Invalid content'; end if;
  elsif p_content<>'{}'::jsonb then raise exception using errcode='22023',message='Unexpected content'; end if;
  select * into v_current from public.reusable_answers where id=p_answer_id and user_id=v_user for update;
  if not found then
    if p_expected_revision<>0 or p_action not in ('draft','approve') or exists(select 1 from public.reusable_answers where id=p_answer_id) then
      raise exception using errcode='P0002',message='Answer unavailable';
    end if;
    insert into public.reusable_answers(id,user_id,label,question,answer,category,tags,source_note,source_url,revision,approved_at)
    values(p_answer_id,v_user,p_content->>'label',p_content->>'question',p_content->>'answer',p_content->>'category',p_content->'tags',p_content->>'sourceNote',p_content->>'sourceUrl',1,case when p_action='approve' then now() else null end)
    returning * into v_current;
  else
    if v_current.revision<>p_expected_revision then raise exception using errcode='55000',message='Revision conflict'; end if;
    if p_action in ('draft','approve') and v_current.archived_at is not null then raise exception using errcode='55000',message='Restore before editing'; end if;
    if p_action in ('draft','approve') then
      update public.reusable_answers set label=p_content->>'label',question=p_content->>'question',answer=p_content->>'answer',category=p_content->>'category',tags=p_content->'tags',source_note=p_content->>'sourceNote',source_url=p_content->>'sourceUrl',approved_at=case when p_action='approve' then now() else null end,revision=revision+1,updated_at=now()
      where id=p_answer_id and user_id=v_user returning * into v_current;
    else
      update public.reusable_answers set approved_at=null,archived_at=case when p_action='archive' then now() else null end,revision=revision+1,updated_at=now()
      where id=p_answer_id and user_id=v_user returning * into v_current;
    end if;
  end if;
  v_content:=jsonb_build_object('label',v_current.label,'question',v_current.question,'answer',v_current.answer,'category',v_current.category,'tags',v_current.tags,'sourceNote',v_current.source_note,'sourceUrl',v_current.source_url);
  insert into public.reusable_answer_versions(answer_id,user_id,revision,event_id,request_hash,action,content,approved_at,archived_at)
  values(v_current.id,v_user,v_current.revision,p_event_id,v_hash,p_action,v_content,v_current.approved_at,v_current.archived_at);
  return jsonb_build_object('id',v_current.id,'revision',v_current.revision);
end $$;

create function public.delete_reusable_answer(p_answer_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_revision integer;
begin
  if v_user is null then raise exception using errcode='42501',message='Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('answer:'||v_user::text||':'||p_answer_id::text,0));
  select revision into v_revision from public.reusable_answers where id=p_answer_id and user_id=v_user for update;
  if not found then
    if exists(select 1 from public.reusable_answer_tombstones where user_id=v_user and answer_id=p_answer_id) then return jsonb_build_object('id',p_answer_id); end if;
    raise exception using errcode='P0002',message='Answer unavailable';
  end if;
  if v_revision is distinct from p_expected_revision then raise exception using errcode='55000',message='Revision conflict'; end if;
  insert into public.reusable_answer_tombstones(user_id,answer_id) values(v_user,p_answer_id) on conflict do nothing;
  delete from public.reusable_answers where id=p_answer_id and user_id=v_user;
  return jsonb_build_object('id',p_answer_id);
end $$;
revoke all on function public.save_reusable_answer(uuid,uuid,integer,text,jsonb) from public,anon;
revoke all on function public.delete_reusable_answer(uuid,integer) from public,anon;
grant execute on function public.save_reusable_answer(uuid,uuid,integer,text,jsonb) to authenticated;
grant execute on function public.delete_reusable_answer(uuid,integer) to authenticated;

create or replace function public.capture_application_submission(p_user_id uuid,p_event_id uuid,p_input jsonb,p_pdf bytea default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_record public.application_submissions%rowtype;
  v_app public.applications%rowtype;
  v_file public.resume_artifacts%rowtype;
  v_resume public.resumes%rowtype;
  v_kind text:=p_input->>'kind';
  v_parent uuid:=nullif(p_input->>'supersedesId','')::uuid;
  v_answers jsonb:=p_input->'answers';
  v_selections jsonb:=coalesce(p_input->'answerSelections','[]'::jsonb);
  v_selection jsonb;
  v_answer public.reusable_answers%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('resume-archive:'||p_user_id::text,0));
  -- Replay precedes source lookups: a successful retry survives later deletes.
  select * into v_record from public.application_submissions where user_id=p_user_id and event_id=p_event_id;
  if found then
    if v_record.request_hash is distinct from p_input->>'requestHash' then
      raise exception using errcode='55000',message='Capture request changed';
    end if;
    return jsonb_build_object('id',v_record.id);
  end if;
  if v_kind is null or v_kind not in ('export','upload','selected','unknown') or p_event_id is null or coalesce(p_input->>'requestHash','')!~'^[0-9a-f]{64}$' or char_length(coalesce(p_input->>'notes',''))>5000 or jsonb_typeof(p_input->'answers') is distinct from 'array' or jsonb_array_length(p_input->'answers')>30 or octet_length(p_input::text)>400000 then
    raise exception using errcode='22023',message='Invalid capture';
  end if;
  select * into v_app from public.applications where id=(p_input->>'applicationId')::uuid and user_id=p_user_id for share;
  if not found then raise exception using errcode='P0002',message='Application unavailable'; end if;
  if v_parent is not null and not exists(select 1 from public.application_submissions where id=v_parent and user_id=p_user_id and application_id=v_app.id) then
    raise exception using errcode='P0002',message='Correction source unavailable';
  end if;
  if (v_kind='export' and (p_input->>'artifactId' is null or p_input->>'resumeId' is not null)) or (v_kind='selected' and (p_input->>'resumeId' is null or p_input->>'artifactId' is not null)) or (v_kind in ('upload','unknown') and (p_input->>'artifactId' is not null or p_input->>'resumeId' is not null)) or (v_kind<>'upload' and p_pdf is not null) then
    raise exception using errcode='22023',message='Conflicting source choices';
  end if;
  if jsonb_typeof(v_selections) is distinct from 'array' then raise exception using errcode='22023',message='Invalid answer selection'; end if;
  if jsonb_array_length(v_selections)>20 or jsonb_array_length(v_selections)+jsonb_array_length(v_answers)>30 or (select count(distinct value->>'id') from jsonb_array_elements(v_selections))<>jsonb_array_length(v_selections) then
    raise exception using errcode='22023',message='Invalid answer selection';
  end if;
  for v_selection in select value from jsonb_array_elements(v_selections) loop
    select * into v_answer from public.reusable_answers where id=(v_selection->>'id')::uuid and user_id=p_user_id for share;
    if not found then raise exception using errcode='P0002',message='Answer unavailable'; end if;
    if v_answer.revision is distinct from (v_selection->>'revision')::integer or v_answer.approved_at is null or v_answer.archived_at is not null then
      raise exception using errcode='40001',message='Answer changed or unapproved';
    end if;
    v_answers:=v_answers||jsonb_build_array(jsonb_build_object('question',v_answer.question,'answer',v_answer.answer,'sourceAnswerId',v_answer.id,'sourceRevision',v_answer.revision,'sourceNote',v_answer.source_note,'sourceUrl',v_answer.source_url));
  end loop;
  if v_kind='export' then
    select * into v_file from public.resume_artifacts where id=(p_input->>'artifactId')::uuid and user_id=p_user_id and provenance='export';
    if not found then raise exception using errcode='P0002',message='Export unavailable'; end if;
  elsif v_kind='upload' then
    if p_pdf is null or octet_length(p_pdf) not between 16 and 3145728 or coalesce(p_input->>'filename','')='' or p_input->>'pdfSha256' is null or encode(sha256(p_pdf),'hex')<>p_input->>'pdfSha256' then
      raise exception using errcode='22023',message='Invalid upload';
    end if;
    if (select coalesce(sum(size_bytes),0) from public.resume_artifacts where user_id=p_user_id)+octet_length(p_pdf)>209715200 then
      raise exception using errcode='54000',message='Archive capacity reached';
    end if;
    insert into public.resume_artifacts(user_id,provenance,title,filename,pdf_bytes,sha256)
    values(p_user_id,'upload',p_input->>'filename',p_input->>'filename',p_pdf,p_input->>'pdfSha256') returning * into v_file;
  elsif v_kind='selected' then
    select * into v_resume from public.resumes where id=(p_input->>'resumeId')::uuid and user_id=p_user_id for share;
    if not found then raise exception using errcode='P0002',message='Resume unavailable'; end if;
  end if;
  insert into public.application_submissions(user_id,event_id,request_hash,application_id,artifact_id,source_resume_id,kind,submitted_on,application_snapshot,job_description,resume_title,resume_snapshot,answers,notes,supersedes_id)
  values(p_user_id,p_event_id,p_input->>'requestHash',v_app.id,v_file.id,coalesce(v_file.source_resume_id,v_resume.id),v_kind,(p_input->>'submittedOn')::date,to_jsonb(v_app)-'user_id'-'job_description',coalesce(v_app.job_description,''),coalesce(v_file.title,v_resume.title),case when v_kind='selected' then coalesce(v_resume.content,'null'::jsonb) else null end,v_answers,coalesce(p_input->>'notes',''),v_parent)
  returning * into v_record;
  return jsonb_build_object('id',v_record.id);
end $$;

create function public.export_reusable_answers() returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
  select jsonb_build_object('schemaVersion',1,'exportedAt',now(),
    'answers',coalesce((select jsonb_agg(to_jsonb(a)-'user_id' order by a.id) from public.reusable_answers a where user_id=auth.uid()),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(to_jsonb(v)-'user_id' order by v.answer_id,v.revision) from public.reusable_answer_versions v where user_id=auth.uid()),'[]'::jsonb))
$$;
revoke all on function public.export_reusable_answers() from public,anon;
grant execute on function public.export_reusable_answers() to authenticated;

commit;
