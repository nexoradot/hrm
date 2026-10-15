-- NEXORA candidate career profile, saved jobs and job alerts.
create table if not exists public.candidate_career_details (
  candidate_id uuid primary key references auth.users(id) on delete cascade,
  work_experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  associations jsonb not null default '[]'::jsonb,
  certificates jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  cover_letter text,
  gender text,
  date_of_birth date,
  disability_status text,
  internally_displaced boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.candidate_saved_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(candidate_id, job_id)
);
create table if not exists public.candidate_job_alerts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  alert_name text not null default 'My job alert',
  keywords text,
  location text,
  workplace_type text not null default 'all' check (workplace_type in ('all','remote','hybrid','onsite')),
  employment_type text not null default 'all',
  frequency text not null default 'weekly' check (frequency in ('daily','weekly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.candidate_career_details enable row level security;
alter table public.candidate_saved_jobs enable row level security;
alter table public.candidate_job_alerts enable row level security;
drop policy if exists candidate_career_details_owner on public.candidate_career_details;
create policy candidate_career_details_owner on public.candidate_career_details for all to authenticated using (candidate_id=auth.uid() or public.is_platform_admin()) with check (candidate_id=auth.uid() or public.is_platform_admin());
drop policy if exists candidate_saved_jobs_owner on public.candidate_saved_jobs;
create policy candidate_saved_jobs_owner on public.candidate_saved_jobs for all to authenticated using (candidate_id=auth.uid() or public.is_platform_admin()) with check (candidate_id=auth.uid() or public.is_platform_admin());
drop policy if exists candidate_job_alerts_owner on public.candidate_job_alerts;
create policy candidate_job_alerts_owner on public.candidate_job_alerts for all to authenticated using (candidate_id=auth.uid() or public.is_platform_admin()) with check (candidate_id=auth.uid() or public.is_platform_admin());
create index if not exists candidate_saved_jobs_owner_idx on public.candidate_saved_jobs(candidate_id,created_at desc);
create index if not exists candidate_job_alerts_owner_idx on public.candidate_job_alerts(candidate_id,created_at desc);
grant select,insert,update,delete on public.candidate_career_details,public.candidate_saved_jobs,public.candidate_job_alerts to authenticated;
