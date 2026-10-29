begin;

-- A stale approved-answer choice is a business conflict, not a serialization
-- failure. PostgREST may retry40001 automatically, producing gateway timeouts.
-- Patch the installed016 definition without changing its ownership or grants.
do $migration$
declare
  v_sql text;
  v_old text := 'errcode=''40001'',message=''Answer changed or unapproved''';
  v_new text := 'errcode=''PT409'',message=''Answer changed or unapproved''';
begin
  v_sql := pg_catalog.pg_get_functiondef('public.capture_application_submission(uuid,uuid,jsonb,bytea)'::pg_catalog.regprocedure);
  if length(v_sql)-length(replace(v_sql,v_old,'')) <> length(v_old) then
    raise exception 'Expected exactly one016 stale-answer error branch; migration not applied';
  end if;
  execute replace(v_sql,v_old,v_new);
end
$migration$;

commit;
