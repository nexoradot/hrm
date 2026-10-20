-- Permanent-employment leave eligibility. Existing employee data is preserved.
alter table public.hr_employees
  add column if not exists is_permanent boolean not null default false;

create or replace function public.enforce_hr_leave_employee_eligibility()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  employee_status text;
  permanent_flag boolean;
begin
  select e.employment_status, e.is_permanent
    into employee_status, permanent_flag
  from public.hr_employees e
  where e.id = new.employee_id and e.organization_id = new.organization_id;

  if not found then
    raise exception 'Leave request blocked: employee was not found in this organisation.';
  end if;

  if lower(coalesce(employee_status,'')) = 'probation' and not coalesce(permanent_flag,false) then
    raise exception 'Leave is not available during probation. HR must mark the employee as permanent before leave can be requested or approved.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hr_leave_employee_eligibility on public.hr_leave_requests;
create trigger trg_hr_leave_employee_eligibility
before insert or update of employee_id, status
on public.hr_leave_requests
for each row execute function public.enforce_hr_leave_employee_eligibility();
