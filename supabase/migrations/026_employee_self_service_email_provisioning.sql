-- Employee self-service provisioning from confirmed work email only.
create or replace function public.link_my_hr_employee_by_email()
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare v_email text; v_employee_id uuid; v_organization_id uuid; v_count integer;
begin
 if auth.uid() is null then raise exception 'Sign in before linking your employee profile.'; end if;
 select lower(trim(email)) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirm your sign-in email before linking your employee profile.'; end if;
 select count(*) into v_count from public.hr_employees e
 where lower(trim(e.email))=v_email and (e.user_id is null or e.user_id=auth.uid())
 and coalesce(e.employment_status,'active') not in ('terminated');
 if v_count=0 then return null; end if;
 if v_count>1 then raise exception 'More than one employee record matches this confirmed email. Ask HR to resolve duplicate records before signing in.'; end if;
 select e.id,e.organization_id into v_employee_id,v_organization_id from public.hr_employees e
 where lower(trim(e.email))=v_email and (e.user_id is null or e.user_id=auth.uid())
 and coalesce(e.employment_status,'active') not in ('terminated') limit 1;
 update public.hr_employees set user_id=auth.uid(),updated_at=now()
 where id=v_employee_id and (user_id is null or user_id=auth.uid());
 if not found then raise exception 'The employee record could not be linked safely. Contact HR.'; end if;
 insert into public.organization_members(organization_id,user_id,role,status,created_at,updated_at)
 values(v_organization_id,auth.uid(),'employee','active',now(),now())
 on conflict(organization_id,user_id) do nothing;
 return v_employee_id;
end; $$;
revoke all on function public.link_my_hr_employee_by_email() from public;
grant execute on function public.link_my_hr_employee_by_email() to authenticated;
comment on function public.link_my_hr_employee_by_email() is
'Links a confirmed-email Auth user only to one existing non-terminated HR employee record with exact same email; provisions least-privilege employee membership.';
