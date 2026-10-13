-- NEXORA HRM expansion modules (migration 006)
-- Apply after migrations 001-005 in a development Supabase project first.
create table if not exists public.hr_operations_records (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 module_key text not null check(module_key in (
  'recruitment','onboarding','offboarding','documents','training','timesheets','shifts','benefits','compliance',
  'remittance','approvals','billing','simulator','wage_tracker','settings','go_live'
 )),
 title text not null,
 status text not null default 'open',
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 employee_id uuid references public.hr_employees(id) on delete set null,
 reference_code text,
 start_date date,
 end_date date,
 due_date date,
 amount numeric(14,2) check(amount is null or amount>=0),
 details jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>=start_date)
);
create index if not exists hr_operations_org_module_idx on public.hr_operations_records(organization_id,module_key,created_at desc);
create index if not exists hr_operations_org_status_idx on public.hr_operations_records(organization_id,status,due_date);
create index if not exists hr_operations_employee_idx on public.hr_operations_records(organization_id,employee_id);
alter table public.hr_operations_records enable row level security;
drop policy if exists hr_operations_records_hr_manager_all on public.hr_operations_records;
create policy hr_operations_records_hr_manager_all on public.hr_operations_records
 for all to authenticated
 using(public.can_manage_hr(organization_id))
 with check(public.can_manage_hr(organization_id));
grant select,insert,update,delete on public.hr_operations_records to authenticated;

create or replace function public.validate_hr_operation_employee_link()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
 if new.employee_id is not null and not exists(
  select 1 from public.hr_employees e
  where e.id=new.employee_id and e.organization_id=new.organization_id
 ) then
  raise exception 'Employee must belong to the same organisation';
 end if;
 new.updated_at=now();
 return new;
end $$;
drop trigger if exists hr_operations_employee_tenant_guard on public.hr_operations_records;
create trigger hr_operations_employee_tenant_guard
 before insert or update on public.hr_operations_records
 for each row execute function public.validate_hr_operation_employee_link();

comment on table public.hr_operations_records is
 'Tenant-scoped operational register for recruitment tracking, onboarding/offboarding tasks, shifts, benefits, compliance, remittance, approvals, billing, simulator assumptions, wage tracking and settings. Amounts are records only, not payroll calculations.';

-- Employee self-service policies. Employees must be explicitly linked by hr_employees.user_id.
-- These policies expose only the signed-in employee's own records; HR manager policies remain in place.
drop policy if exists hr_employees_self_read on public.hr_employees;
create policy hr_employees_self_read on public.hr_employees
 for select to authenticated using(user_id=auth.uid());

drop policy if exists hr_leave_requests_self_read on public.hr_leave_requests;
create policy hr_leave_requests_self_read on public.hr_leave_requests
 for select to authenticated using(exists(
  select 1 from public.hr_employees e where e.id=employee_id and e.user_id=auth.uid() and e.organization_id=hr_leave_requests.organization_id
 ));
drop policy if exists hr_leave_requests_self_insert on public.hr_leave_requests;
create policy hr_leave_requests_self_insert on public.hr_leave_requests
 for insert to authenticated with check(
  requested_by=auth.uid() and status='pending' and exists(
   select 1 from public.hr_employees e where e.id=employee_id and e.user_id=auth.uid() and e.organization_id=hr_leave_requests.organization_id
  )
);

drop policy if exists hr_attendance_records_self_read on public.hr_attendance_records;
create policy hr_attendance_records_self_read on public.hr_attendance_records
 for select to authenticated using(exists(
  select 1 from public.hr_employees e where e.id=employee_id and e.user_id=auth.uid() and e.organization_id=hr_attendance_records.organization_id
 ));

drop policy if exists hr_performance_reviews_self_read on public.hr_performance_reviews;
create policy hr_performance_reviews_self_read on public.hr_performance_reviews
 for select to authenticated using(exists(
  select 1 from public.hr_employees e where e.id=employee_id and e.user_id=auth.uid() and e.organization_id=hr_performance_reviews.organization_id
 ));

drop policy if exists hr_payroll_items_self_read on public.hr_payroll_items;
create policy hr_payroll_items_self_read on public.hr_payroll_items
 for select to authenticated using(exists(
  select 1 from public.hr_employees e where e.id=employee_id and e.user_id=auth.uid() and e.organization_id=hr_payroll_items.organization_id
 ));

drop policy if exists hr_payroll_periods_self_read on public.hr_payroll_periods;
create policy hr_payroll_periods_self_read on public.hr_payroll_periods
 for select to authenticated using(exists(
  select 1 from public.hr_payroll_items i join public.hr_employees e on e.id=i.employee_id
  where i.payroll_period_id=hr_payroll_periods.id and i.organization_id=hr_payroll_periods.organization_id and e.user_id=auth.uid()
 ));
