-- Versioned manual resume sections and Master CV settings. Apply after 013.
begin;
alter table public.profiles add column cv_sections jsonb not null default '{"revision":0,"titles":{},"customSections":[]}';

create function public.guard_resume_document_version()
returns trigger language plpgsql set search_path='' as $$
begin
  if coalesce((old.content->>'schemaVersion')::integer,1)>=2 and new.content is distinct from old.content then
    if coalesce(new.content->>'schemaVersion','')<>'2' or coalesce((new.content->>'revision')::integer,-1)<>coalesce((old.content->>'revision')::integer,0)+1 then
      raise exception 'Resume changed or client is out of date' using errcode='55000';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_resume_document_version() from public,anon,authenticated;
create trigger resumes_guard_document before update of content on public.resumes for each row execute function public.guard_resume_document_version();

create function public.save_resume_document(p_resume_id uuid,p_content jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_current jsonb; v_revision integer;
begin
  if v_user is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_content is null or jsonb_typeof(p_content)<>'object' or coalesce(p_content->>'schemaVersion','')<>'2'
    or p_expected_revision is null or p_expected_revision<0 or octet_length(p_content::text)>1000000
    or coalesce(jsonb_typeof(p_content->'customSections'),'')<>'array'
    or coalesce(jsonb_typeof(p_content->'order'),'')<>'array'
    or coalesce((p_content->>'revision')::integer,-1)<>p_expected_revision then
    raise exception 'Invalid document' using errcode='22023';
  end if;
  select content into v_current from public.resumes where id=p_resume_id and user_id=v_user for update;
  if not found then raise exception 'Resume not found' using errcode='P0002'; end if;
  v_revision:=coalesce((v_current->>'revision')::integer,0);
  if v_revision<>p_expected_revision or coalesce((v_current->>'schemaVersion')::integer,1)>2 then
    raise exception 'Resume changed or newer format' using errcode='55000';
  end if;
  update public.resumes set content=jsonb_set(p_content,'{revision}',to_jsonb(v_revision+1)) where id=p_resume_id and user_id=v_user;
  return jsonb_build_object('revision',v_revision+1);
end;
$$;
revoke all on function public.save_resume_document(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_resume_document(uuid,jsonb,integer) to authenticated;

create function public.save_cv_sections(p_content jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_current jsonb; v_revision integer;
begin
  if v_user is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>1000000
    or coalesce(jsonb_typeof(p_content->'customSections'),'')<>'array'
    or coalesce(jsonb_typeof(p_content->'titles'),'')<>'object'
    or p_expected_revision is null or p_expected_revision<0 or coalesce((p_content->>'revision')::integer,-1)<>p_expected_revision then
    raise exception 'Invalid CV sections' using errcode='22023';
  end if;
  select cv_sections into v_current from public.profiles where id=v_user for update;
  if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
  v_revision:=coalesce((v_current->>'revision')::integer,0);
  if v_revision<>p_expected_revision then raise exception 'CV sections changed' using errcode='55000'; end if;
  update public.profiles set cv_sections=jsonb_set(p_content,'{revision}',to_jsonb(v_revision+1)) where id=v_user;
  return jsonb_build_object('revision',v_revision+1);
end;
$$;
revoke all on function public.save_cv_sections(jsonb,integer) from public,anon;
grant execute on function public.save_cv_sections(jsonb,integer) to authenticated;
commit;
