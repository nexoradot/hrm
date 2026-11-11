-- VELNORA job marketplace category support.
-- Existing vacancies are retained under the neutral "general" category until employers classify them.
alter table public.jobs
  add column if not exists category text not null default 'general';

update public.jobs
set category = 'general'
where category is null or btrim(category) = '';

create index if not exists jobs_category_status_closing_idx
  on public.jobs (category, status, closing_date);

comment on column public.jobs.category is
  'Employer-selected marketplace category used for public job discovery and filtering.';
