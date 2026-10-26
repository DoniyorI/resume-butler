-- Rate limit for the resume editor's one-bullet rewrite (/api/rewrite-bullet).
-- It's a small request made often while editing, so it gets its own, larger
-- limit instead of sharing suggest-bullets'. Same function as 004 plus one key.

create or replace function public.consume_rate_limit(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_window interval;
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  case p_key
    when 'generate-resume' then v_limit := 20; v_window := interval '1 hour';
    when 'generate-cover-letter' then v_limit := 20; v_window := interval '1 hour';
    when 'suggest-bullets' then v_limit := 30; v_window := interval '1 hour';
    when 'rewrite-bullet' then v_limit := 120; v_window := interval '1 hour';
    when 'parse-resume' then v_limit := 10; v_window := interval '1 hour';
    when 'scan-emails' then v_limit := 10; v_window := interval '1 hour';
    when 'download-resume' then v_limit := 60; v_window := interval '1 hour';
    else raise exception 'Unknown rate limit key: %', p_key;
  end case;

  insert into public.api_rate_limits as r (user_id, key, window_start, count)
  values (v_user, p_key, now(), 1)
  on conflict (user_id, key) do update
    set count = case when r.window_start < now() - v_window then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - v_window then now() else r.window_start end
  returning count into v_count;

  return v_count <= v_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
