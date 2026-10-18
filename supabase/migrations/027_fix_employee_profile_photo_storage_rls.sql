-- Fix employee profile-photo storage policy: the filename is not a third folder.
drop policy if exists nexora_hr_docs_employee_photo_insert on storage.objects;
create policy nexora_hr_docs_employee_photo_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nexora-hr-documents'
  and storage.filename(name) like 'profile-photo-%'
  and storage.filename(name) ~ '^profile-photo-[0-9]+\.(jpg|png|webp)$'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
  and exists (
    select 1 from public.hr_employees e
    where e.organization_id::text = (storage.foldername(name))[1]
      and e.id::text = (storage.foldername(name))[2]
      and e.user_id = (select auth.uid())
  )
);
