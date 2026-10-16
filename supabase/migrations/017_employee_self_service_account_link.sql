-- Safely link a signed-in employee to their existing HR record.
-- This never links by a user-supplied employee ID: it requires a confirmed Auth email,
-- an active employee membership in the same organisation, and exactly one matching
-- unlinked HR record. HR/elevated accounts are not eligible for this self-link.
create or replace function public.link_my_hr_employee_by_email()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_employee_id uuid;
  v_count integer;
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
  join public.organization_members m
    on m.organization_id = e.organization_id
   and m.user_id = auth.uid()
   and m.status = 'active'
   and m.role::text = 'employee'
  where lower(trim(e.email)) = v_email
    and (e.user_id is null or e.user_id = auth.uid())
    and e.employment_status not in ('terminated');

  if v_count = 0 then
    return null;
  end if;
  if v_count > 1 then
    raise exception 'More than one employee record matches this email. Ask HR to correct duplicate records before signing in.';
  end if;

  select e.id into v_employee_id
  from public.hr_employees e
  join public.organization_members m
    on m.organization_id = e.organization_id
   and m.user_id = auth.uid()
   and m.status = 'active'
   and m.role::text = 'employee'
  where lower(trim(e.email)) = v_email
    and (e.user_id is null or e.user_id = auth.uid())
    and e.employment_status not in ('terminated')
  limit 1;

  update public.hr_employees
     set user_id = auth.uid(), updated_at = now()
   where id = v_employee_id
     and (user_id is null or user_id = auth.uid());

  if not found then
    raise exception 'The employee record could not be linked safely. Contact HR.';
  end if;

  return v_employee_id;
end;
$$;

revoke all on function public.link_my_hr_employee_by_email() from public;
grant execute on function public.link_my_hr_employee_by_email() to authenticated;

comment on function public.link_my_hr_employee_by_email() is
  'Self-links only a confirmed-email Auth user with active employee membership to exactly one matching unlinked employee record in that organisation.';
