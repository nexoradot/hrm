-- NEXORA employee registration matching AG German Institute's onboarding form.
-- Apply after reviewed migrations 005 and 006 in development first.
create table if not exists public.hr_employee_registrations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 submitted_by uuid not null references auth.users(id) on delete restrict,
 email text not null,
 first_name text not null,
 last_name text not null,
 phone_number text not null,
 home_address text not null,
 id_number text not null,
 kra_pin text,
 sha_number text,
 nssf_number text,
 beneficiary_name text,
 bank_name text,
 branch_code text,
 account_number text,
 emergency_contact_name text not null,
 emergency_contact_phone text not null,
 emergency_contact_address text not null,
 staff_beneficiary_name text not null,
 beneficiary_relationship text not null check(beneficiary_relationship in ('Spouse','Sibling','Parent','Other')),
 beneficiary_phone text not null,
 beneficiary_email text not null,
 professional_registration_number text,
 helb_beneficiary boolean not null,
 documents jsonb not null default '{}'::jsonb,
 declaration_confirmed boolean not null default false check(declaration_confirmed),
 status text not null default 'submitted' check(status in ('submitted','under_review','needs_changes','approved','rejected')),
 review_notes text,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 employee_id uuid references public.hr_employees(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,submitted_by,id),
 check(branch_code is null or branch_code ~ '^[0-9]{5}$')
);
create index if not exists hr_employee_registrations_org_status_idx on public.hr_employee_registrations(organization_id,status,created_at desc);
create index if not exists hr_employee_registrations_submitter_idx on public.hr_employee_registrations(submitted_by,created_at desc);
alter table public.hr_employee_registrations enable row level security;
drop policy if exists hr_employee_registrations_hr_manage on public.hr_employee_registrations;
create policy hr_employee_registrations_hr_manage on public.hr_employee_registrations
 for all to authenticated using(public.can_manage_hr(organization_id))
 with check(public.can_manage_hr(organization_id));
drop policy if exists hr_employee_registrations_member_insert on public.hr_employee_registrations;
create policy hr_employee_registrations_member_insert on public.hr_employee_registrations
 for insert to authenticated with check(
  submitted_by=auth.uid() and status='submitted' and declaration_confirmed=true
  and exists(select 1 from public.organization_members m
    where m.organization_id=hr_employee_registrations.organization_id
      and m.user_id=auth.uid() and m.status='active')
 );
drop policy if exists hr_employee_registrations_own_read on public.hr_employee_registrations;
create policy hr_employee_registrations_own_read on public.hr_employee_registrations
 for select to authenticated using(submitted_by=auth.uid());
drop policy if exists hr_employee_registrations_own_update on public.hr_employee_registrations;
create policy hr_employee_registrations_own_update on public.hr_employee_registrations
 for update to authenticated using(submitted_by=auth.uid() and status in ('needs_changes','submitted'))
 with check(submitted_by=auth.uid() and status in ('needs_changes','submitted') and declaration_confirmed=true);
grant select,insert,update on public.hr_employee_registrations to authenticated;

-- Private bucket; file paths must be: <organization UUID>/<authenticated user UUID>/<registration UUID>/<filename>
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hr-employee-documents','hr-employee-documents',false,10485760,
 array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=10485760,
 allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists hr_employee_docs_insert_own on storage.objects;
create policy hr_employee_docs_insert_own on storage.objects for insert to authenticated
 with check(bucket_id='hr-employee-documents'
  and (storage.foldername(name))[2]=auth.uid()::text
  and case when (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}
drop policy if exists hr_employee_docs_read_own_or_hr on storage.objects;
create policy hr_employee_docs_read_own_or_hr on storage.objects for select to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or case when (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}
 ));
drop policy if exists hr_employee_docs_update_own on storage.objects;
create policy hr_employee_docs_update_own on storage.objects for update to authenticated
 using(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text)
 with check(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists hr_employee_docs_delete_own_or_hr on storage.objects;
create policy hr_employee_docs_delete_own_or_hr on storage.objects for delete to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 ));

comment on table public.hr_employee_registrations is 'Confidential employee onboarding submissions matching AG German Institute registration form. Contains highly sensitive identity, tax, bank and beneficiary details; expose only to the submitter and authorised HR managers.';

drop policy if exists hr_employee_registrations_own_delete on public.hr_employee_registrations;
create policy hr_employee_registrations_own_delete on public.hr_employee_registrations
 for delete to authenticated using(submitted_by=auth.uid() and status='submitted');
 then
   exists(select 1 from public.organization_members m
    where m.organization_id=((storage.foldername(name))[1])::uuid and m.user_id=auth.uid() and m.status='active')
   else false end);
drop policy if exists hr_employee_docs_read_own_or_hr on storage.objects;
create policy hr_employee_docs_read_own_or_hr on storage.objects for select to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 ));
drop policy if exists hr_employee_docs_update_own on storage.objects;
create policy hr_employee_docs_update_own on storage.objects for update to authenticated
 using(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text)
 with check(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists hr_employee_docs_delete_own_or_hr on storage.objects;
create policy hr_employee_docs_delete_own_or_hr on storage.objects for delete to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 ));

comment on table public.hr_employee_registrations is 'Confidential employee onboarding submissions matching AG German Institute registration form. Contains highly sensitive identity, tax, bank and beneficiary details; expose only to the submitter and authorised HR managers.';

drop policy if exists hr_employee_registrations_own_delete on public.hr_employee_registrations;
create policy hr_employee_registrations_own_delete on public.hr_employee_registrations
 for delete to authenticated using(submitted_by=auth.uid() and status='submitted');
 then public.can_manage_hr(((storage.foldername(name))[1])::uuid) else false end
 ));
drop policy if exists hr_employee_docs_update_own on storage.objects;
create policy hr_employee_docs_update_own on storage.objects for update to authenticated
 using(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text)
 with check(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists hr_employee_docs_delete_own_or_hr on storage.objects;
create policy hr_employee_docs_delete_own_or_hr on storage.objects for delete to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 ));

comment on table public.hr_employee_registrations is 'Confidential employee onboarding submissions matching AG German Institute registration form. Contains highly sensitive identity, tax, bank and beneficiary details; expose only to the submitter and authorised HR managers.';

drop policy if exists hr_employee_registrations_own_delete on public.hr_employee_registrations;
create policy hr_employee_registrations_own_delete on public.hr_employee_registrations
 for delete to authenticated using(submitted_by=auth.uid() and status='submitted');
 then
   exists(select 1 from public.organization_members m
    where m.organization_id=((storage.foldername(name))[1])::uuid and m.user_id=auth.uid() and m.status='active')
   else false end);
drop policy if exists hr_employee_docs_read_own_or_hr on storage.objects;
create policy hr_employee_docs_read_own_or_hr on storage.objects for select to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 ));
drop policy if exists hr_employee_docs_update_own on storage.objects;
create policy hr_employee_docs_update_own on storage.objects for update to authenticated
 using(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text)
 with check(bucket_id='hr-employee-documents' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists hr_employee_docs_delete_own_or_hr on storage.objects;
create policy hr_employee_docs_delete_own_or_hr on storage.objects for delete to authenticated
 using(bucket_id='hr-employee-documents' and (
  (storage.foldername(name))[2]=auth.uid()::text
  or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 ));

comment on table public.hr_employee_registrations is 'Confidential employee onboarding submissions matching AG German Institute registration form. Contains highly sensitive identity, tax, bank and beneficiary details; expose only to the submitter and authorised HR managers.';

drop policy if exists hr_employee_registrations_own_delete on public.hr_employee_registrations;
create policy hr_employee_registrations_own_delete on public.hr_employee_registrations
 for delete to authenticated using(submitted_by=auth.uid() and status='submitted');
