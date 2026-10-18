-- NEXORA HRM: allow employees to submit their own private documents.
-- Apply after migration 016. Employees can insert/read their own document records;
-- HR retains organisation-scoped management through existing policies.
drop policy if exists hr_employee_documents_employee_read on public.hr_employee_documents;
create policy hr_employee_documents_employee_read on public.hr_employee_documents
 for select to authenticated
 using (exists (
  select 1 from public.hr_employees e
  where e.id = hr_employee_documents.employee_id
    and e.organization_id = hr_employee_documents.organization_id
    and e.user_id = auth.uid()
 ));

drop policy if exists hr_employee_documents_employee_insert on public.hr_employee_documents;
create policy hr_employee_documents_employee_insert on public.hr_employee_documents
 for insert to authenticated
 with check (
  uploaded_by = auth.uid()
  and verification_status = 'pending'
  and verified_by is null
  and verified_at is null
  and exists (
   select 1 from public.hr_employees e
   where e.id = hr_employee_documents.employee_id
     and e.organization_id = hr_employee_documents.organization_id
     and e.user_id = auth.uid()
  )
 );

-- The object path is organization_id/employee_id/random_filename.
-- Preserve the existing HR access policies and add narrowly scoped employee access.
drop policy if exists nexora_hr_docs_employee_select on storage.objects;
create policy nexora_hr_docs_employee_select on storage.objects
 for select to authenticated
 using (
  bucket_id = 'nexora-hr-documents'
  and exists (
   select 1 from public.hr_employees e
   where e.organization_id::text = (storage.foldername(name))[1]
     and e.id::text = (storage.foldername(name))[2]
     and e.user_id = auth.uid()
  )
 );

drop policy if exists nexora_hr_docs_employee_insert on storage.objects;
create policy nexora_hr_docs_employee_insert on storage.objects
 for insert to authenticated
 with check (
  bucket_id = 'nexora-hr-documents'
  and exists (
   select 1 from public.hr_employees e
   where e.organization_id::text = (storage.foldername(name))[1]
     and e.id::text = (storage.foldername(name))[2]
     and e.user_id = auth.uid()
  )
 );
