-- Secure employee self-service profile photo uploads.
-- Photo objects use the existing private employee-document bucket and tenant/employee folder convention.
drop policy if exists nexora_hr_docs_employee_photo_insert on storage.objects;
create policy nexora_hr_docs_employee_photo_insert on storage.objects
 for insert to authenticated
 with check (
   bucket_id = 'nexora-hr-documents'
   and (storage.foldername(name))[3] like 'profile-photo-%'
   and exists (
     select 1 from public.hr_employees e
     where e.organization_id::text = (storage.foldername(name))[1]
       and e.id::text = (storage.foldername(name))[2]
       and e.user_id = (select auth.uid())
   )
 );

create or replace function public.employee_update_my_profile_photo(photo_path text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare changed integer;
begin
 if photo_path is null or length(photo_path) > 500
    or photo_path !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/profile-photo-[0-9]+\\.(jpg|png|webp)$' then
   raise exception 'Invalid profile photo path';
 end if;
 update public.hr_employees e
 set profile_photo_url = photo_path, updated_at = now()
 where e.user_id = auth.uid()
   and e.organization_id::text = split_part(photo_path,'/',1)
   and e.id::text = split_part(photo_path,'/',2);
 get diagnostics changed = row_count;
 if changed <> 1 then raise exception 'No uniquely linked employee record found'; end if;
 return true;
end;
$$;
revoke all on function public.employee_update_my_profile_photo(text) from public;
grant execute on function public.employee_update_my_profile_photo(text) to authenticated;
