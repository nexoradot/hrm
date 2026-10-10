-- NEXORA candidate, jobs marketplace, consent and support foundation.
create table if not exists public.candidate_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 phone text,
 location text,
 headline text,
 skills text,
 summary text,
 profile_visibility text not null default 'private' check (profile_visibility in ('private','discoverable')),
 consent_for_consultancy boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.candidate_documents (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null,
 file_name text not null,
 mime_type text,
 file_size bigint,
 document_type text not null default 'other',
 review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists public.candidate_consultancy_links (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references auth.users(id) on delete cascade,
 consultancy_organization_id uuid not null references public.organizations(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
 requested_by uuid references auth.users(id) on delete set null,
 candidate_consent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(candidate_id,consultancy_organization_id)
);
create table if not exists public.jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 title text not null,
 slug text not null unique,
 public_employer_name text,
 summary text,
 description text not null,
 requirements text not null default '',
 location text,
 country_code text not null default 'KE',
 employment_type text not null default 'full_time',
 workplace_type text not null default 'onsite',
 salary_min numeric,
 salary_max numeric,
 salary_currency text not null default 'KES',
 show_salary boolean not null default false,
 closing_date date,
 status text not null default 'pending_review' check (status in ('draft','pending_review','published','rejected','closed','suspended')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.job_applications (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 candidate_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'submitted' check (status in ('submitted','under_review','shortlisted','interview','offered','hired','rejected','withdrawn')),
 cover_letter text,
 candidate_withdrawn_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(job_id,candidate_id)
);
create table if not exists public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 requester_user_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete set null,
 subject text not null,
 description text not null,
 category text not null default 'general',
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 status text not null default 'open' check (status in ('open','in_progress','waiting','resolved','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.platform_modules (
 id uuid primary key default gen_random_uuid(),
 module_key text not null unique,
 name text not null,
 description text,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.subscription_plans (
 id uuid primary key default gen_random_uuid(),
 plan_key text not null unique,
 name text not null,
 monthly_price numeric not null default 0,
 currency text not null default 'KES',
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.organization_entitlements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 module_id uuid not null references public.platform_modules(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(organization_id,module_id)
);
create table if not exists public.platform_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 message text not null,
 audience text not null default 'all',
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);

create index if not exists jobs_public_listing_idx on public.jobs(status,published_at desc);
create index if not exists jobs_organization_idx on public.jobs(organization_id,created_at desc);
create index if not exists applications_candidate_idx on public.job_applications(candidate_id,created_at desc);
create index if not exists candidate_documents_candidate_idx on public.candidate_documents(candidate_id,created_at desc);
create index if not exists candidate_links_consultancy_idx on public.candidate_consultancy_links(consultancy_organization_id,status);

alter table public.candidate_profiles enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.candidate_consultancy_links enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.platform_modules enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.organization_entitlements enable row level security;
alter table public.platform_announcements enable row level security;

drop policy if exists candidate_profile_owner on public.candidate_profiles;
create policy candidate_profile_owner on public.candidate_profiles for all to authenticated using (user_id=auth.uid() or public.is_platform_admin()) with check (user_id=auth.uid() or public.is_platform_admin());
drop policy if exists candidate_profile_consented_discovery on public.candidate_profiles;
create policy candidate_profile_consented_discovery on public.candidate_profiles for select to authenticated using (profile_visibility='discoverable' and consent_for_consultancy=true and exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager','recruiter','consultant') and o.organization_type='consultancy' and o.status='active' and o.verification_status='verified'));

drop policy if exists candidate_document_owner on public.candidate_documents;
create policy candidate_document_owner on public.candidate_documents for all to authenticated using (candidate_id=auth.uid() or public.is_platform_admin()) with check (candidate_id=auth.uid() or public.is_platform_admin());
drop policy if exists candidate_document_consented_read on public.candidate_documents;
create policy candidate_document_consented_read on public.candidate_documents for select to authenticated using (exists(select 1 from public.candidate_consultancy_links l join public.organization_members m on m.organization_id=l.consultancy_organization_id where l.candidate_id=candidate_documents.candidate_id and l.status='accepted' and l.candidate_consent_at is not null and m.user_id=auth.uid() and m.status='active'));

drop policy if exists candidate_links_participant_read on public.candidate_consultancy_links;
create policy candidate_links_participant_read on public.candidate_consultancy_links for select to authenticated using (candidate_id=auth.uid() or exists(select 1 from public.organization_members m where m.organization_id=consultancy_organization_id and m.user_id=auth.uid() and m.status='active') or public.is_platform_admin());
drop policy if exists candidate_links_candidate_update on public.candidate_consultancy_links;
create policy candidate_links_candidate_update on public.candidate_consultancy_links for update to authenticated using (candidate_id=auth.uid()) with check (candidate_id=auth.uid());
drop policy if exists candidate_links_consultancy_insert on public.candidate_consultancy_links;
create policy candidate_links_consultancy_insert on public.candidate_consultancy_links for insert to authenticated with check (requested_by=auth.uid() and exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id where m.organization_id=consultancy_organization_id and m.user_id=auth.uid() and m.status='active' and o.organization_type='consultancy' and o.status='active' and o.verification_status='verified'));

drop policy if exists jobs_public_read on public.jobs;
create policy jobs_public_read on public.jobs for select to anon,authenticated using (status='published' and (closing_date is null or closing_date>=current_date));
drop policy if exists jobs_company_manage on public.jobs;
create policy jobs_company_manage on public.jobs for all to authenticated using (created_by=auth.uid() or public.is_platform_admin() or exists(select 1 from public.organization_members m where m.organization_id=jobs.organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager','recruiter'))) with check (created_by=auth.uid() or public.is_platform_admin() or exists(select 1 from public.organization_members m where m.organization_id=jobs.organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager','recruiter')));

drop policy if exists applications_candidate_manage on public.job_applications;
create policy applications_candidate_manage on public.job_applications for all to authenticated using (candidate_id=auth.uid() or public.is_platform_admin()) with check (candidate_id=auth.uid() or public.is_platform_admin());
drop policy if exists applications_employer_read on public.job_applications;
create policy applications_employer_read on public.job_applications for select to authenticated using (exists(select 1 from public.jobs j join public.organization_members m on m.organization_id=j.organization_id where j.id=job_applications.job_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager','recruiter')));
drop policy if exists applications_employer_update on public.job_applications;
create policy applications_employer_update on public.job_applications for update to authenticated using (exists(select 1 from public.jobs j join public.organization_members m on m.organization_id=j.organization_id where j.id=job_applications.job_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager','recruiter'))) with check (exists(select 1 from public.jobs j join public.organization_members m on m.organization_id=j.organization_id where j.id=job_applications.job_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','hr_manager','recruiter')));

drop policy if exists support_ticket_requester on public.support_tickets;
create policy support_ticket_requester on public.support_tickets for all to authenticated using (requester_user_id=auth.uid() or public.is_platform_admin()) with check (requester_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists platform_modules_admin on public.platform_modules;
create policy platform_modules_admin on public.platform_modules for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists plans_admin on public.subscription_plans;
create policy plans_admin on public.subscription_plans for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists entitlements_admin on public.organization_entitlements;
create policy entitlements_admin on public.organization_entitlements for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists announcements_admin on public.platform_announcements;
create policy announcements_admin on public.platform_announcements for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

grant select on public.jobs to anon,authenticated;
grant select,insert,update,delete on public.candidate_profiles,public.candidate_documents,public.candidate_consultancy_links,public.jobs,public.job_applications,public.support_tickets to authenticated;
grant select,insert,update,delete on public.platform_modules,public.subscription_plans,public.organization_entitlements,public.platform_announcements to authenticated;

insert into public.platform_modules(module_key,name,description) values
 ('core_hr','Core HR & employee records','Employee directory and core records'),
 ('leave_attendance','Leave & attendance','Leave, shifts and attendance'),
 ('payroll','Payroll & statutory reporting','Payroll and payslips'),
 ('recruitment','Recruitment & applicant tracking','Vacancies and applicant tracking'),
 ('performance','Performance & KPIs','Objectives and performance reviews'),
 ('learning','Learning & development','Training and certifications'),
 ('employee_welfare','Employee welfare & engagement','Welfare and engagement'),
 ('consultancy','HR consultancy services','Consultancy workflow tools')
on conflict(module_key) do nothing;

-- This RPC intentionally performs no privileged membership acceptance. It is a
-- compatibility hook for clients; actual invitations must be accepted through a
-- trusted, authenticated invitation workflow.
create or replace function public.accept_pending_memberships()
returns integer language sql security invoker set search_path=public
as $$ select 0 $$;

-- Private document bucket. Storage policies still require review in the target project.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('candidate-documents','candidate-documents',false,10485760,array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;
drop policy if exists candidate_document_storage_owner on storage.objects;
create policy candidate_document_storage_owner on storage.objects for all to authenticated using (bucket_id='candidate-documents' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='candidate-documents' and (storage.foldername(name))[1]=auth.uid()::text);
