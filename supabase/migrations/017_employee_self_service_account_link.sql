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


-- Least-privilege self-service reads. Employee access is scoped through the
-- authenticated user's linked employee row; HR-manager policies remain separate.
drop policy if exists hr_employees_self_read on public.hr_employees;
create policy hr_employees_self_read on public.hr_employees
 for select to authenticated using (user_id = auth.uid());

drop policy if exists hr_departments_employee_read on public.hr_departments;
create policy hr_departments_employee_read on public.hr_departments
 for select to authenticated using (
   exists (select 1 from public.hr_employees e
           where e.department_id = hr_departments.id and e.user_id = auth.uid()
             and e.organization_id = hr_departments.organization_id)
 );

drop policy if exists hr_leave_employee_read on public.hr_leave_requests;
create policy hr_leave_employee_read on public.hr_leave_requests
 for select to authenticated using (
   exists (select 1 from public.hr_employees e
           where e.id = hr_leave_requests.employee_id
             and e.organization_id = hr_leave_requests.organization_id
             and e.user_id = auth.uid())
 );

drop policy if exists hr_leave_employee_insert on public.hr_leave_requests;
create policy hr_leave_employee_insert on public.hr_leave_requests
 for insert to authenticated with check (
   requested_by = auth.uid()
   and status = 'pending'
   and decided_by is null
   and decided_at is null
   and exists (select 1 from public.hr_employees e
               join public.organization_members m
                 on m.organization_id = e.organization_id
                and m.user_id = auth.uid()
                and m.status = 'active'
                and m.role::text = 'employee'
               where e.id = hr_leave_requests.employee_id
                 and e.organization_id = hr_leave_requests.organization_id
                 and e.user_id = auth.uid())
 );

drop policy if exists hr_attendance_employee_read on public.hr_attendance_records;
create policy hr_attendance_employee_read on public.hr_attendance_records
 for select to authenticated using (
   exists (select 1 from public.hr_employees e
           where e.id = hr_attendance_records.employee_id
             and e.organization_id = hr_attendance_records.organization_id
             and e.user_id = auth.uid())
 );

drop policy if exists hr_reviews_employee_read on public.hr_performance_reviews;
create policy hr_reviews_employee_read on public.hr_performance_reviews
 for select to authenticated using (
   exists (select 1 from public.hr_employees e
           where e.id = hr_performance_reviews.employee_id
             and e.organization_id = hr_performance_reviews.organization_id
             and e.user_id = auth.uid())
 );

drop policy if exists hr_payroll_items_employee_read on public.hr_payroll_items;
create policy hr_payroll_items_employee_read on public.hr_payroll_items
 for select to authenticated using (
   payment_status in ('approved','paid')
   and exists (select 1 from public.hr_employees e
               where e.id = hr_payroll_items.employee_id
                 and e.organization_id = hr_payroll_items.organization_id
                 and e.user_id = auth.uid())
 );

drop policy if exists hr_payroll_periods_employee_read on public.hr_payroll_periods;
create policy hr_payroll_periods_employee_read on public.hr_payroll_periods
 for select to authenticated using (
   status in ('approved','paid')
   and exists (select 1 from public.hr_payroll_items i
               join public.hr_employees e
                 on e.id = i.employee_id
                and e.organization_id = i.organization_id
               where i.payroll_period_id = hr_payroll_periods.id
                 and i.organization_id = hr_payroll_periods.organization_id
                 and i.payment_status in ('approved','paid')
                 and e.user_id = auth.uid())
 );

grant select on public.hr_employees, public.hr_departments,
  public.hr_leave_requests, public.hr_attendance_records,
  public.hr_performance_reviews, public.hr_payroll_items,
  public.hr_payroll_periods to authenticated;
grant insert on public.hr_leave_requests to authenticated;
