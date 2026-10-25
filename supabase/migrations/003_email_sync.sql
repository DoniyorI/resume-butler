-- Email Sync: Store user email connections and track processed emails

-----------------------------------------------------------
-- EMAIL CONNECTIONS (one per user)
-----------------------------------------------------------
create table public.email_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  imap_host text not null default 'imap.gmail.com',
  imap_port int not null default 993,
  email_address text not null,
  app_password text not null, -- Gmail App Password or IMAP password
  is_active boolean default true,
  last_scan_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-----------------------------------------------------------
-- PROCESSED EMAILS (track what we've already scanned)
-----------------------------------------------------------
create table public.processed_emails (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  email_subject text,
  email_from text,
  email_date timestamptz,
  classification jsonb, -- {is_job_related, company, position, status, confidence, summary}
  application_id uuid references public.applications(id) on delete set null,
  action_taken text, -- 'created', 'updated', 'skipped'
  processed_at timestamptz default now()
);

-- Prevent re-processing the same email for the same user
create unique index idx_processed_emails_user_msg
  on public.processed_emails(user_id, message_id);

-----------------------------------------------------------
-- ROW LEVEL SECURITY
-----------------------------------------------------------
alter table public.email_connections enable row level security;
alter table public.processed_emails enable row level security;

create policy "Users can manage own email connections"
  on public.email_connections for all using (auth.uid() = user_id);

create policy "Users can manage own processed emails"
  on public.processed_emails for all using (auth.uid() = user_id);

-- Auto-update timestamps
create trigger set_updated_at before update on public.email_connections
  for each row execute function public.handle_updated_at();
