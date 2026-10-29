begin;

-- Keep ingestion payloads/event hashes unchanged and preserve function grants.
-- Derive attribution from the validated posting link, never a free-text label.
do $migration$
declare
  v_sql text;
  v_old text := '''Added by the browser extension''';
  v_new text := $replacement$(case public.posting_identity_key(p_payload->>'portal_link')->>'platform'
    when 'linkedin' then 'Added from LinkedIn'
    when 'greenhouse' then 'Added from Greenhouse'
    when 'lever' then 'Added from Lever'
    when 'ashby' then 'Added from Ashby'
    else 'Added by the browser extension' end)$replacement$;
begin
  v_sql := pg_catalog.pg_get_functiondef('public.write_extension_application(uuid,jsonb,uuid)'::pg_catalog.regprocedure);
  if length(v_sql)-length(replace(v_sql,v_old,'')) <> length(v_old) then
    raise exception 'Expected exactly one generic extension note; migration not applied';
  end if;
  execute replace(v_sql,v_old,v_new);
end
$migration$;

-- Only replace untouched generated notes. User-written or edited notes remain.
update public.applications
set comments = case public.posting_identity_key(portal_link)->>'platform'
  when 'linkedin' then 'Added from LinkedIn'
  when 'greenhouse' then 'Added from Greenhouse'
  when 'lever' then 'Added from Lever'
  when 'ashby' then 'Added from Ashby'
  else comments end
where source='extension' and comments='Added by the browser extension';

commit;
