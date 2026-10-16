-- Employee self-service document access and employee announcements.
-- Employee document metadata and file bytes remain private and are scoped to the
-- authenticated user's linked employee record in the same organisation.

drop policy if exists hr_employee_documents_employee_read on public.hr_employee_documents;
create policy hr_employee_documents_employee_read on public.hr_employee_documents
 for select to authenticated
 using (
   exists (
     select 1 from public.hr_employees e
     where e.id = hr_employee_documents.employee_id
       and e.organization_id = hr_employee_documents.organization_id
       and e.user_id = (select auth.uid())
   )
 );

grant select on public.hr_employee_documents to authenticated;

-- Storage object paths use organisation UUID / employee UUID / filename.
-- Match the folder strings to database IDs rather than casting arbitrary paths.
drop policy if exists nexora_hr_docs_employee_select on storage.objects;
create policy nexora_hr_docs_employee_select on storage.objects
 for select to authenticated
 using (
   bucket_id = 'nexora-hr-documents'
   and exists (
     select 1 from public.hr_employees e
     where e.organization_id::text = (storage.foldername(name))[1]
       and e.id::text = (storage.foldername(name))[2]
       and e.user_id = (select auth.uid())
   )
 );

-- Let platform administrators publish employee-targeted notices using the
-- existing announcements manager while preserving the current audience values.
alter table public.platform_announcements
 drop constraint if exists platform_announcements_audience_check;
alter table public.platform_announcements
 add constraint platform_announcements_audience_check
 check (audience = any (array['all','companies','candidates','consultancies','internal_admins','employees']::text[]));

drop policy if exists announcements_read_published on public.platform_announcements;
create policy announcements_read_published on public.platform_announcements
 for select to authenticated
 using (
   status = 'published'
   and (publish_at is null or publish_at <= now())
   and audience = any (array['all','candidates','employees']::text[])
 );
