begin;

-- Private, immutable file artifacts and user-reported submission records.
-- Service-only writes: user IDs must come from the authenticated server session.
create table public.resume_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid,
  source_resume_id uuid, -- Deliberately survives deletion of the working resume.
  provenance text not null check (provenance in ('export','upload')),
  title text not null,
  filename text not null check (char_length(filename) between 1 and 200),
  content jsonb,
  pdf_bytes bytea not null check (octet_length(pdf_bytes) between 16 and 3145728),
  size_bytes integer generated always as (octet_length(pdf_bytes)) stored,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique(user_id,event_id),
  check (encode(sha256(pdf_bytes),'hex')=sha256)
);
create index resume_artifacts_owner_created on public.resume_artifacts(user_id,created_at desc);

create table public.application_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  application_id uuid references public.applications(id) on delete set null,
  -- Deferred NO ACTION lets account deletion cascade both files and records.
  artifact_id uuid references public.resume_artifacts(id) deferrable initially deferred,
  source_resume_id uuid,
  kind text not null check (kind in ('export','upload','selected','unknown')),
  submitted_on date not null,
  application_snapshot jsonb not null,
  job_description text not null default '',
  resume_title text,
  resume_snapshot jsonb,
  answers jsonb not null default '[]' check (jsonb_typeof(answers)='array'),
  notes text not null default '' check (char_length(notes)<=5000),
  supersedes_id uuid references public.application_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id,event_id),
  check ((kind in ('export','upload'))=(artifact_id is not null)),
  check ((kind='selected')=(resume_snapshot is not null))
);
create index application_submissions_owner_created on public.application_submissions(user_id,created_at desc);
create index application_submissions_application on public.application_submissions(application_id);

alter table public.resume_artifacts enable row level security;
alter table public.application_submissions enable row level security;
create policy resume_artifacts_read_own on public.resume_artifacts for select to authenticated using (user_id=auth.uid());
create policy application_submissions_read_own on public.application_submissions for select to authenticated using (user_id=auth.uid());
revoke all on public.resume_artifacts,public.application_submissions from public,anon,authenticated;
grant select on public.resume_artifacts,public.application_submissions to authenticated;
grant all on public.resume_artifacts,public.application_submissions to service_role;

create function public.record_resume_export(
  p_user_id uuid,p_event_id uuid,p_resume_id uuid,p_title text,p_content jsonb,p_pdf bytea,p_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_file public.resume_artifacts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('resume-archive:'||p_user_id::text,0));
  select * into v_file from public.resume_artifacts where user_id=p_user_id and event_id=p_event_id;
  if found then
    if v_file.sha256<>p_sha256 or v_file.source_resume_id is distinct from p_resume_id or v_file.content is distinct from p_content or v_file.title is distinct from p_title then
      raise exception using errcode='55000',message='Export request changed';
    end if;
  else
    -- The owned document was loaded before compilation. It may have been
    -- deleted while the compiler ran; a surviving foreign source is rejected.
    if p_resume_id is null or exists(select 1 from public.resumes where id=p_resume_id and user_id<>p_user_id) then
      raise exception using errcode='P0002',message='Source unavailable';
    end if;
    if p_title is null or char_length(p_title)>2000 or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>1048576 or p_pdf is null or octet_length(p_pdf) not between 16 and 3145728 or p_sha256 is null or encode(sha256(p_pdf),'hex')<>p_sha256 then
      raise exception using errcode='22023',message='Invalid export';
    end if;
    if (select coalesce(sum(size_bytes),0) from public.resume_artifacts where user_id=p_user_id)+octet_length(p_pdf)>209715200 then
      raise exception using errcode='54000',message='Archive capacity reached';
    end if;
    insert into public.resume_artifacts(user_id,event_id,source_resume_id,provenance,title,filename,content,pdf_bytes,sha256)
    values(p_user_id,p_event_id,p_resume_id,'export',p_title,left(regexp_replace(coalesce(nullif(p_title,''),'resume'),'\.pdf$','','i'),196)||'.pdf',p_content,p_pdf,p_sha256)
    returning * into v_file;
  end if;
  return jsonb_build_object('id',v_file.id,'filename',v_file.filename,'sha256',v_file.sha256,'size_bytes',v_file.size_bytes);
end $$;

create function public.capture_application_submission(p_user_id uuid,p_event_id uuid,p_input jsonb,p_pdf bytea default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_record public.application_submissions%rowtype;
  v_app public.applications%rowtype;
  v_file public.resume_artifacts%rowtype;
  v_resume public.resumes%rowtype;
  v_kind text:=p_input->>'kind';
  v_parent uuid:=nullif(p_input->>'supersedesId','')::uuid;
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
  values(p_user_id,p_event_id,p_input->>'requestHash',v_app.id,v_file.id,coalesce(v_file.source_resume_id,v_resume.id),v_kind,(p_input->>'submittedOn')::date,to_jsonb(v_app)-'user_id'-'job_description',coalesce(v_app.job_description,''),coalesce(v_file.title,v_resume.title),case when v_kind='selected' then coalesce(v_resume.content,'null'::jsonb) else null end,p_input->'answers',coalesce(p_input->>'notes',''),v_parent)
  returning * into v_record;
  return jsonb_build_object('id',v_record.id);
end $$;

revoke all on function public.record_resume_export(uuid,uuid,uuid,text,jsonb,bytea,text) from public,anon,authenticated;
revoke all on function public.capture_application_submission(uuid,uuid,jsonb,bytea) from public,anon,authenticated;
grant execute on function public.record_resume_export(uuid,uuid,uuid,text,jsonb,bytea,text) to service_role;
grant execute on function public.capture_application_submission(uuid,uuid,jsonb,bytea) to service_role;

-- Independent capture quota; PDF fit checks retain their existing allowance.
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
