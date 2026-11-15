-- Gmail message ids a scan has fully handled, so later scans read only new mail (Gmail allows each
-- user a limited number of reads a second). Newest first, capped by the server at 3000 ids.
-- Additive; before it runs, every scan reads the whole window as before.

alter table public.email_connections
  add column if not exists gmail_seen_ids text[] not null default '{}';
