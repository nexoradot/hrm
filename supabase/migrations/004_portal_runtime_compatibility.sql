-- NEXORA portal compatibility layer for the current browser portal.js.
-- Review and apply only after migrations 001-003 have been reviewed in a test project.

alter table public.candidate_profiles add column if not exists country_code text not null default 'KE';
alter table public.candidate_profiles add column if not exists experience_years numeric;
alter table public.candidate_profiles add column if not exists consultancy_discovery_opt_in boolean not null default false;
alter table public.candidate_profiles add column if not exists completed_profile boolean not null default false;

alter table public.candidate_profiles drop constraint if exists candidate_profiles_profile_visibility_check;
alter table public.candidate_profiles add constraint candidate_profiles_profile_visibility_check
 check (profile_visibility in ('private','discoverable','marketplace'));

alter table public.candidate_documents add column if not exists file_size_bytes bigint;
update public.candidate_documents set file_size_bytes=file_size where file_size_bytes is null and file_size is not null;

create table if not exists public.candidate_discovery_cards (
 candidate_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 headline text,
 location text,
 country_code text not null default 'KE',
 skills text[] not null default '{}',
 experience_years numeric,
 consent_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.candidate_discovery_cards enable row level security;
drop policy if exists discovery_card_candidate_manage on public.candidate_discovery_cards;
create policy discovery_card_candidate_manage on public.candidate_discovery_cards
 for all to authenticated using (candidate_id=auth.uid() or public.is_platform_admin())
 with check (candidate_id=auth.uid() or public.is_platform_admin());
drop policy if exists discovery_card_consultancy_read on public.candidate_discovery_cards;
create policy discovery_card_consultancy_read on public.candidate_discovery_cards
 for select to authenticated using (
  consent_enabled=true and exists(
   select 1 from public.organization_members m
   join public.organizations o on o.id=m.organization_id
   where m.user_id=auth.uid() and m.status='active'
    and m.role in ('owner','hr_manager','recruiter','consultant')
    and o.organization_type='consultancy' and o.status='active' and o.verification_status='verified'
  )
 );
grant select,insert,update,delete on public.candidate_discovery_cards to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('candidate-private-documents','candidate-private-documents',false,10485760,
 array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do nothing;

drop policy if exists candidate_private_documents_owner on storage.objects;
create policy candidate_private_documents_owner on storage.objects for all to authenticated
 using (bucket_id='candidate-private-documents' and (storage.foldername(name))[1]=auth.uid()::text)
 with check (bucket_id='candidate-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists candidate_private_documents_consented_read on storage.objects;
create policy candidate_private_documents_consented_read on storage.objects for select to authenticated
 using (
  bucket_id='candidate-private-documents'
  and exists (
   select 1 from public.candidate_documents d
   join public.candidate_consultancy_links l on l.candidate_id=d.candidate_id
   join public.organization_members m on m.organization_id=l.consultancy_organization_id
   where d.storage_path=name and l.status='accepted' and l.candidate_consent_at is not null
    and m.user_id=auth.uid() and m.status='active'
  )
 );

-- The compatibility migration intentionally does not automatically publish profiles,
-- jobs or announcements and does not create organization memberships.
