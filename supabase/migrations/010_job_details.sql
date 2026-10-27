-- Job details kept with each application, so they survive the posting being
-- taken down and are at hand for interviews and salary talks: the pay range,
-- employment and workplace type, and the site the application was made on
-- (filled in by the browser extension; editable on the application page).

alter table public.applications
  add column if not exists salary_min integer check (salary_min is null or salary_min >= 0),
  add column if not exists salary_max integer check (salary_max is null or salary_max >= 0),
  add column if not exists salary_currency text check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$'),
  add column if not exists salary_period text check (salary_period is null or salary_period in ('hour', 'day', 'week', 'month', 'year')),
  add column if not exists employment_type text check (employment_type is null or char_length(employment_type) <= 40),
  add column if not exists workplace_type text check (workplace_type is null or workplace_type in ('remote', 'hybrid', 'onsite')),
  add column if not exists source_site text check (source_site is null or char_length(source_site) <= 40);

alter table public.applications
  drop constraint if exists applications_salary_range_check;
alter table public.applications
  add constraint applications_salary_range_check check (salary_min is null or salary_max is null or salary_min <= salary_max);
