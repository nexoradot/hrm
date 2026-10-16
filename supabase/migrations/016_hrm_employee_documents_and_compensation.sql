-- NEXORA HRM priority release: employee compensation and private document storage.
-- Apply after migrations 001-015 in a development Supabase project first.
alter table public.hr_employees
 add column if not exists basic_salary numeric(14,2) not null default 0 check (basic_salary >= 0),
 add column if not exists payroll_reference text,
 add column if not exists staff_reference text;

create table if not exists public.hr_employee_documents (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 employee_id uuid not null references public.hr_employees(id) on delete cascade,
 document_type text not null check (document_type in ('national_id','cv','certificate','contract','kra_pin','nssf','shif','bank_details','passport_photo','medical','other')),
 document_name text not null,
 storage_path text not null unique,
 original_file_name text not null,
 content_type text,
 file_size_bytes bigint not null check(file_size_bytes > 0 and file_size_bytes <= 10485760),
 document_reference text,
 issue_date date,
 expiry_date date,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected','expired')),
 notes text,
 uploaded_by uuid references auth.users(id) on delete set null,
 verified_by uuid references auth.users(id) on delete set null,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists hr_employee_documents_org_employee_idx on public.hr_employee_documents(organization_id,employee_id,created_at desc);
create index if not exists hr_employee_documents_org_expiry_idx on public.hr_employee_documents(organization_id,expiry_date) where expiry_date is not null;
alter table public.hr_employee_documents enable row level security;
drop policy if exists hr_employee_documents_hr_manage on public.hr_employee_documents;
create policy hr_employee_documents_hr_manage on public.hr_employee_documents
 for all to authenticated using (public.can_manage_hr(organization_id)) with check (public.can_manage_hr(organization_id));
grant select,insert,update,delete on public.hr_employee_documents to authenticated;

create or replace function public.validate_hr_employee_document_link()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
 if not exists(select 1 from public.hr_employees e where e.id=new.employee_id and e.organization_id=new.organization_id) then
  raise exception 'Employee document must belong to an employee in the same organisation';
 end if;
 new.updated_at=now();
 return new;
end $$;
drop trigger if exists hr_employee_document_tenant_guard on public.hr_employee_documents;
create trigger hr_employee_document_tenant_guard before insert or update of organization_id,employee_id on public.hr_employee_documents
 for each row execute function public.validate_hr_employee_document_link();

-- Private bucket: 10 MB maximum; common HR document formats only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nexora-hr-documents','nexora-hr-documents',false,10485760,
 array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists nexora_hr_docs_select on storage.objects;
create policy nexora_hr_docs_select on storage.objects for select to authenticated
 using(bucket_id='nexora-hr-documents' and public.can_manage_hr(((storage.foldername(name))[1])::uuid));
drop policy if exists nexora_hr_docs_insert on storage.objects;
create policy nexora_hr_docs_insert on storage.objects for insert to authenticated
 with check(bucket_id='nexora-hr-documents' and public.can_manage_hr(((storage.foldername(name))[1])::uuid));
drop policy if exists nexora_hr_docs_update on storage.objects;
create policy nexora_hr_docs_update on storage.objects for update to authenticated
 using(bucket_id='nexora-hr-documents' and public.can_manage_hr(((storage.foldername(name))[1])::uuid))
 with check(bucket_id='nexora-hr-documents' and public.can_manage_hr(((storage.foldername(name))[1])::uuid));
drop policy if exists nexora_hr_docs_delete on storage.objects;
create policy nexora_hr_docs_delete on storage.objects for delete to authenticated
 using(bucket_id='nexora-hr-documents' and public.can_manage_hr(((storage.foldername(name))[1])::uuid));

comment on table public.hr_employee_documents is 'Private employee document metadata. File bytes are stored in the private nexora-hr-documents bucket and accessed with short-lived signed URLs.';
comment on column public.hr_employees.basic_salary is 'Configured monthly basic salary in the workspace currency. This is not a statutory payroll calculation.';
