-- The browser extension: personal API tokens, and where applications came from.

-----------------------------------------------------------
-- EXTENSION TOKENS: the extension authenticates with one of these instead of
-- the user's Supabase session. Only a SHA-256 hash is stored; the token itself
-- is shown once, when it's created.
-----------------------------------------------------------
create table if not exists public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  name text not null default 'Chrome extension',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists extension_tokens_user_idx on public.extension_tokens (user_id);

alter table public.extension_tokens enable row level security;

-- Users see and revoke their own tokens. Requests from the extension are
-- checked on the server with the service role (src/server/extension/tokens.js).
drop policy if exists "Users can read own extension tokens" on public.extension_tokens;
create policy "Users can read own extension tokens"
  on public.extension_tokens for select using (auth.uid() = user_id);

drop policy if exists "Users can create own extension tokens" on public.extension_tokens;
create policy "Users can create own extension tokens"
  on public.extension_tokens for insert with check (auth.uid() = user_id);

drop policy if exists "Users can revoke own extension tokens" on public.extension_tokens;
create policy "Users can revoke own extension tokens"
  on public.extension_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-----------------------------------------------------------
-- APPLICATION SOURCE: how an application got into the tracker, so the app
-- can say "Added by the extension" and offer an undo
-----------------------------------------------------------
alter table public.applications
  add column if not exists source text;

alter table public.applications
  drop constraint if exists applications_source_known;
alter table public.applications
  add constraint applications_source_known
  check (source is null or source in ('manual', 'email', 'extension'));
