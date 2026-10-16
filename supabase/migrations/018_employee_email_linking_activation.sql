-- Allow a confirmed employee email to activate its one matching HR record.
-- The function never accepts an employee ID from the browser and refuses duplicates
-- or any existing elevated membership.
create or replace function public.link_my_hr_employee_by_email()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_employee_id uuid;
  v_org_id uuid;
  v_count integer;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before linking your employee profile.';
  end if;

  select lower(trim(email))
    into v_email
  from auth.users
  where id = auth.uid()
    and email_confirmed_at is not null;

  if v_email is null then
    raise exception 'Confirm your sign-in email before linking your employee profile.';
  end if;

  select count(*)
    into v_count
  from public.hr_employees e
  where lower(trim(e.email)) = v_email
    and (e.user_id is null or e.user_id = auth.uid())
    and e.employment_status not in ('terminated');

  if v_count = 0 then return null; end if;
  if v_count > 1 then
    raise exception 'More than one employee record matches this email. Ask HR to correct duplicate records before signing in.';
  end if;

  select e.id, e.organization_id
    into v_employee_id, v_org_id
  from public.hr_employees e
  where lower(trim(e.email)) = v_email
    and (e.user_id is null or e.user_id = auth.uid())
    and e.employment_status not in ('terminated')
  limit 1;

  select m.role into v_role
  from public.organization_members m
  where m.organization_id = v_org_id and m.user_id = auth.uid()
  for update;

  if found and v_role <> 'employee' then
    raise exception 'This account already has an elevated organisation role. Contact the platform administrator to link the employee profile safely.';
  end if;

  if found then
    update public.organization_members
       set status = 'active', updated_at = now()
     where organization_id = v_org_id and user_id = auth.uid();
  else
    insert into public.organization_members(organization_id,user_id,role,status)
    values(v_org_id,auth.uid(),'employee','active');
  end if;

  update public.hr_employees
     set user_id = auth.uid(), updated_at = now()
   where id = v_employee_id
     and (user_id is null or user_id = auth.uid());

  if not found then raise exception 'The employee record could not be linked safely. Contact HR.'; end if;
  return v_employee_id;
end;
$$;

revoke all on function public.link_my_hr_employee_by_email() from public;
revoke all on function public.link_my_hr_employee_by_email() from anon;
grant execute on function public.link_my_hr_employee_by_email() to authenticated;
