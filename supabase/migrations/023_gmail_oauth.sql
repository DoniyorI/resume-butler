-- Gmail through Google sign-in (OAuth), next to the IMAP app-password connection.
-- Additive: existing rows become provider 'imap' and keep their app password.
-- The app works before this runs (every connection is treated as IMAP and the Google button reports
-- that this migration is needed).

alter table public.email_connections
  add column if not exists provider text not null default 'imap',
  -- Google refresh token, AES-256-GCM encrypted by the server (APP_ENCRYPTION_KEY); never exported
  add column if not exists oauth_refresh_token text;

alter table public.email_connections drop constraint if exists email_connections_provider_check;
alter table public.email_connections
  add constraint email_connections_provider_check check (provider in ('imap', 'gmail'));

-- A Gmail connection has no app password
alter table public.email_connections alter column app_password drop not null;

-- Each kind of connection carries its own secret
alter table public.email_connections drop constraint if exists email_connections_secret_check;
alter table public.email_connections
  add constraint email_connections_secret_check check (
    (provider = 'imap' and app_password is not null)
    or (provider = 'gmail' and oauth_refresh_token is not null)
  );
