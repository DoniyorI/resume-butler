begin;

create or replace function public.cv_import_key(p_text text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(lower(btrim(coalesce(p_text,''))),'[[:space:]]+',' ','g');
$$;
revoke all on function public.cv_import_key(text) from public,anon,authenticated;

create or replace function public.cv_import_bullet_key(p_text text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(public.cv_import_key(p_text),'[.。]+$','');
$$;
revoke all on function public.cv_import_bullet_key(text) from public,anon,authenticated;

-- All writes are one transaction. No caller-supplied owner or table identifier.
create or replace function public.merge_resume_import(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_kind text; v_table text; v_identity text; v_entry jsonb;
  v_ids uuid[]; v_id uuid; v_start date; v_end date; v_order int; v_count int;
  v_bullet jsonb; v_text text; v_bullet_table text; v_parent text; v_exists boolean;
  v_added jsonb:='{"education":0,"experience":0,"projects":0,"skills":0}';
  v_merged jsonb:='{"education":0,"experience":0,"projects":0}';
  v_review jsonb:='{"education":0,"experience":0,"projects":0,"bullets":0}';
  v_bullets int:=0;
begin
  if v_user is null then raise exception 'Sign in to import a resume' using errcode='42501'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>1500000 then
    raise exception 'Invalid import payload' using errcode='22023';
  end if;
  foreach v_kind in array array['education','experience','projects','skills'] loop
    if jsonb_typeof(p_input->v_kind) is distinct from 'array'
      or jsonb_array_length(p_input->v_kind)>(case v_kind when 'education' then 10 when 'skills' then 200 else 30 end) then
      raise exception 'Invalid import entries' using errcode='22023';
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('cv-import:'||v_user::text,0));

  foreach v_kind in array array['education','experience','projects'] loop
    -- These identifiers/predicates are fixed constants, never input SQL.
    case v_kind
      when 'education' then
        v_table:='cv_education';
        v_identity:='public.cv_import_key(school)=public.cv_import_key($2->>''school'') and public.cv_import_key(degree_type)=public.cv_import_key($2->>''degree_type'') and (public.cv_import_key(major)=public.cv_import_key($2->>''major'') or public.cv_import_key(major)='''' or public.cv_import_key($2->>''major'')='''')';
      when 'experience' then
        v_table:='cv_experience';
        v_identity:='public.cv_import_key(company)=public.cv_import_key($2->>''company'') and public.cv_import_key(position)=public.cv_import_key($2->>''position'')';
      when 'projects' then
        v_table:='cv_projects';
        v_identity:='public.cv_import_key(name)=public.cv_import_key($2->>''name'')';
    end case;
    for v_entry in select value from jsonb_array_elements(p_input->v_kind) loop
      if jsonb_typeof(v_entry)<>'object' or length(coalesce(v_entry->>'location',''))>200
        or length(coalesce(v_entry->>'company',''))>200 or length(coalesce(v_entry->>'position',''))>200
        or length(coalesce(v_entry->>'school',''))>200 or length(coalesce(v_entry->>'major',''))>200
        or length(coalesce(v_entry->>'name',''))>200 or length(coalesce(v_entry->>'degree_type',''))>50
        or length(coalesce(v_entry->>'type',''))>50 or length(coalesce(v_entry->>'description',''))>2000 then
        raise exception 'Invalid import entry' using errcode='22023';
      end if;
      if (v_kind='education' and public.cv_import_key(v_entry->>'school')='')
        or (v_kind='experience' and (public.cv_import_key(v_entry->>'company')='' or public.cv_import_key(v_entry->>'position')=''))
        or (v_kind='projects' and public.cv_import_key(v_entry->>'name')='') then
        v_review:=jsonb_set(v_review,array[v_kind],to_jsonb((v_review->>v_kind)::int+1)); continue;
      end if;
      v_start:=nullif(v_entry->>'start_date','')::date;
      v_end:=nullif(v_entry->>'end_date','')::date;
      if v_kind='experience' and coalesce((v_entry->>'currently_working')::boolean,false) then v_end:=null; end if;
      execute format('select array(select id from public.%I where user_id=$1 and %s
        and (start_date is null or $3 is null or date_trunc(''month'',start_date)=date_trunc(''month'',$3))
        and (end_date is null or $4 is null or date_trunc(''month'',end_date)=date_trunc(''month'',$4))
        order by id for update)',v_table,v_identity)
        into v_ids using v_user,v_entry,v_start,v_end;
      if cardinality(v_ids)>1 then
        v_review:=jsonb_set(v_review,array[v_kind],to_jsonb((v_review->>v_kind)::int+1)); continue;
      end if;
      if cardinality(v_ids)=0 then
        execute format('select count(*),coalesce(max(sort_order),-1)+1 from public.%I where user_id=$1',v_table)
          into v_count,v_order using v_user;
        if v_count>=100 then
          v_review:=jsonb_set(v_review,array[v_kind],to_jsonb((v_review->>v_kind)::int+1)); continue;
        end if;
        case v_kind
          when 'education' then
            if (v_entry->>'gpa')::numeric not between 0 and 10 then raise exception 'Invalid GPA' using errcode='22023'; end if;
            insert into public.cv_education(user_id,school,degree_type,major,location,gpa,start_date,end_date,sort_order)
              values(v_user,btrim(v_entry->>'school'),v_entry->>'degree_type',v_entry->>'major',v_entry->>'location',(v_entry->>'gpa')::numeric,v_start,v_end,v_order) returning id into v_id;
          when 'experience' then
            insert into public.cv_experience(user_id,company,position,location,type,start_date,end_date,currently_working,sort_order)
              values(v_user,btrim(v_entry->>'company'),v_entry->>'position',v_entry->>'location',v_entry->>'type',v_start,v_end,coalesce((v_entry->>'currently_working')::boolean,false),v_order) returning id into v_id;
          when 'projects' then
            insert into public.cv_projects(user_id,name,description,start_date,end_date,sort_order)
              values(v_user,btrim(v_entry->>'name'),v_entry->>'description',v_start,v_end,v_order) returning id into v_id;
        end case;
        v_added:=jsonb_set(v_added,array[v_kind],to_jsonb((v_added->>v_kind)::int+1));
      else
        v_id:=v_ids[1];
        case v_kind
          when 'education' then
            if (v_entry->>'gpa')::numeric not between 0 and 10 then raise exception 'Invalid GPA' using errcode='22023'; end if;
            update public.cv_education set
              location=coalesce(nullif(btrim(location),''),v_entry->>'location'),
              major=coalesce(nullif(btrim(major),''),v_entry->>'major'),
              gpa=coalesce(gpa,(v_entry->>'gpa')::numeric),start_date=coalesce(start_date,v_start),end_date=coalesce(end_date,v_end)
              where user_id=v_user and id=v_id;
          when 'experience' then
            update public.cv_experience set
              location=coalesce(nullif(btrim(location),''),v_entry->>'location'),type=coalesce(nullif(btrim(type),''),v_entry->>'type'),
              start_date=coalesce(start_date,v_start),end_date=case when currently_working then end_date else coalesce(end_date,v_end) end
              where user_id=v_user and id=v_id;
          when 'projects' then
            update public.cv_projects set description=coalesce(nullif(btrim(description),''),v_entry->>'description'),
              start_date=coalesce(start_date,v_start),end_date=case when currently_working then end_date else coalesce(end_date,v_end) end
              where user_id=v_user and id=v_id;
        end case;
        v_merged:=jsonb_set(v_merged,array[v_kind],to_jsonb((v_merged->>v_kind)::int+1));
      end if;
      if v_kind in ('experience','projects') then
        if coalesce(jsonb_typeof(v_entry->'bullets'),'array')<>'array' or jsonb_array_length(coalesce(v_entry->'bullets','[]'))>20 then
          raise exception 'Invalid import bullets' using errcode='22023';
        end if;
        v_bullet_table:=case v_kind when 'experience' then 'cv_experience_bullets' else 'cv_project_bullets' end;
        v_parent:=case v_kind when 'experience' then 'experience_id' else 'project_id' end;
        for v_bullet in select value from jsonb_array_elements(coalesce(v_entry->'bullets','[]')) loop
          if jsonb_typeof(v_bullet)<>'string' then raise exception 'Invalid bullet text' using errcode='22023'; end if;
          v_text:=btrim(v_bullet#>>'{}');
          if length(v_text)>1000 then raise exception 'Import bullet too long' using errcode='22023'; end if;
          if v_text='' then continue; end if;
          execute format('select exists(select 1 from public.%I where %I=$1 and public.cv_import_bullet_key(content)=public.cv_import_bullet_key($2))',v_bullet_table,v_parent)
            into v_exists using v_id,v_text;
          if v_exists then continue; end if;
          execute format('select count(*),coalesce(max(sort_order),-1)+1 from public.%I where %I=$1',v_bullet_table,v_parent)
            into v_count,v_order using v_id;
          if v_count>=50 then v_review:=jsonb_set(v_review,'{bullets}',to_jsonb((v_review->>'bullets')::int+1)); continue; end if;
          execute format('insert into public.%I(%I,content,sort_order) values($1,$2,$3)',v_bullet_table,v_parent)
            using v_id,v_text,v_order;
          v_bullets:=v_bullets+1;
        end loop;
      end if;
    end loop;
  end loop;
  for v_entry in select value from jsonb_array_elements(p_input->'skills') loop
    if jsonb_typeof(v_entry)<>'string' then raise exception 'Invalid skill text' using errcode='22023'; end if;
    v_text:=btrim(v_entry#>>'{}');
    if length(v_text)>100 then raise exception 'Import skill too long' using errcode='22023'; end if;
    if v_text='' or exists(select 1 from public.cv_skills where user_id=v_user and public.cv_import_key(name)=public.cv_import_key(v_text)) then continue; end if;
    select coalesce(max(sort_order),-1)+1 into v_order from public.cv_skills where user_id=v_user;
    insert into public.cv_skills(user_id,name,sort_order) values(v_user,v_text,v_order);
    v_added:=jsonb_set(v_added,'{skills}',to_jsonb((v_added->>'skills')::int+1));
  end loop;
  return jsonb_build_object('added',v_added,'merged',v_merged,'bulletsAdded',v_bullets,'needsReview',v_review);
end;
$$;
revoke all on function public.merge_resume_import(jsonb) from public,anon,authenticated;
grant execute on function public.merge_resume_import(jsonb) to authenticated;

commit;
