-- NEXORA HRM workforce core.
-- Apply after migrations 001-004 in a non-production project first.
-- All operational tables are tenant-scoped and protected by RLS.
create extension if not exists pgcrypto;

create or replace function public.can_manage_hr(target_org uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
 select public.is_platform_admin() or exists(
   select 1 from public.organization_members m
   where m.organization_id=target_org and m.user_id=auth.uid()
     and m.status='active' and m.role in ('owner','hr_manager')
 )
$$;

create table if not exists public.hr_departments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,
 code text,
 head_name text,
 description text,
 is_active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,name),
 unique(organization_id,code)
);

create table if not exists public.hr_employees (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 department_id uuid,
 user_id uuid references auth.users(id) on delete set null,
 employee_number text,
 full_name text not null,
 email text,
 phone text,
 job_title text not null,
 employment_type text not null default 'full_time' check(employment_type in ('full_time','part_time','contract','internship','casual')),
 employment_status text not null default 'active' check(employment_status in ('active','on_leave','probation','inactive','terminated')),
 start_date date,
 end_date date,
 date_of_birth date,
 gender text,
 work_location text,
 manager_employee_id uuid references public.hr_employees(id) on delete set null,
 notes text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,employee_number),
 constraint hr_employees_department_same_org foreign key(department_id) references public.hr_departments(id) on delete set null
);
create table if not exists public.hr_leave_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 employee_id uuid not null references public.hr_employees(id) on delete cascade,
 leave_type text not null default 'annual' check(leave_type in ('annual','sick','maternity','paternity','compassionate','unpaid','other')),
 start_date date not null,
 end_date date not null,
 days_requested numeric(6,2) not null check(days_requested>0),
 reason text,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 requested_by uuid references auth.users(id) on delete set null,
 decided_by uuid references auth.users(id) on delete set null,
 decided_at timestamptz,
 decision_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(end_date>=start_date)
);

create table if not exists public.hr_attendance_records (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 employee_id uuid not null references public.hr_employees(id) on delete cascade,
 work_date date not null default current_date,
 clock_in time,
 clock_out time,
 attendance_status text not null default 'present' check(attendance_status in ('present','absent','late','remote','leave','half_day')),
 notes text,
 recorded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,employee_id,work_date)
);

create table if not exists public.hr_performance_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 employee_id uuid not null references public.hr_employees(id) on delete cascade,
 review_period text not null,
 review_date date,
 rating numeric(2,1) not null check(rating>=1 and rating<=5),
 goals text,
 strengths text,
 development_actions text,
 comments text,
 reviewer_id uuid references auth.users(id) on delete set null,
 review_status text not null default 'draft' check(review_status in ('draft','completed','acknowledged')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.hr_payroll_periods (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 period_name text not null,
 period_start date not null,
 period_end date not null,
 payment_date date,
 status text not null default 'draft' check(status in ('draft','processing','review','approved','paid','cancelled')),
 employee_count integer not null default 0 check(employee_count>=0),
 gross_total numeric(14,2) not null default 0 check(gross_total>=0),
 deductions_total numeric(14,2) not null default 0 check(deductions_total>=0),
 net_total numeric(14,2) not null default 0 check(net_total>=0),
 notes text,
 created_by uuid references auth.users(id) on delete set null,
 approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,period_name),
 check(period_end>=period_start)
);

create table if not exists public.hr_payroll_items (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 payroll_period_id uuid not null references public.hr_payroll_periods(id) on delete cascade,
 employee_id uuid not null references public.hr_employees(id) on delete restrict,
 basic_pay numeric(14,2) not null default 0 check(basic_pay>=0),
 allowances numeric(14,2) not null default 0 check(allowances>=0),
 overtime_pay numeric(14,2) not null default 0 check(overtime_pay>=0),
 gross_pay numeric(14,2) not null default 0 check(gross_pay>=0),
 paye numeric(14,2) not null default 0 check(paye>=0),
 nssf numeric(14,2) not null default 0 check(nssf>=0),
 shif numeric(14,2) not null default 0 check(shif>=0),
 housing_levy numeric(14,2) not null default 0 check(housing_levy>=0),
 other_deductions numeric(14,2) not null default 0 check(other_deductions>=0),
 net_pay numeric(14,2) not null default 0 check(net_pay>=0),
 payment_status text not null default 'draft' check(payment_status in ('draft','approved','paid','held')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(payroll_period_id,employee_id)
);

create index if not exists hr_employees_org_status_idx on public.hr_employees(organization_id,employment_status);
create index if not exists hr_leave_org_status_idx on public.hr_leave_requests(organization_id,status,start_date);
create index if not exists hr_attendance_org_date_idx on public.hr_attendance_records(organization_id,work_date);
create index if not exists hr_reviews_org_date_idx on public.hr_performance_reviews(organization_id,review_date);
create index if not exists hr_payroll_org_period_idx on public.hr_payroll_periods(organization_id,period_start desc);
create index if not exists hr_payroll_items_period_idx on public.hr_payroll_items(organization_id,payroll_period_id);

do $$ declare t text; begin
 foreach t in array array['hr_departments','hr_employees','hr_leave_requests','hr_attendance_records','hr_performance_reviews','hr_payroll_periods','hr_payroll_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_hr_manager_all',t);
  execute format('create policy %I on public.%I for all to authenticated using (public.can_manage_hr(organization_id)) with check (public.can_manage_hr(organization_id))',t||'_hr_manager_all',t);
 end loop;
end $$;

grant select,insert,update,delete on public.hr_departments,public.hr_employees,public.hr_leave_requests,public.hr_attendance_records,public.hr_performance_reviews,public.hr_payroll_periods,public.hr_payroll_items to authenticated;

-- Cross-tenant links must not be possible even if a buggy client submits foreign IDs.
create or replace function public.validate_hr_employee_links()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
 if new.department_id is not null and not exists(select 1 from public.hr_departments d where d.id=new.department_id and d.organization_id=new.organization_id) then
  raise exception 'Department must belong to the same organisation';
 end if;
 return new;
end $$;
drop trigger if exists hr_employee_department_tenant_guard on public.hr_employees;
create trigger hr_employee_department_tenant_guard before insert or update of organization_id,department_id on public.hr_employees for each row execute function public.validate_hr_employee_links();

-- Ensure all child records reference an employee from the same tenant.
create or replace function public.validate_hr_child_employee_tenant()
returns trigger language plpgsql security invoker set search_path=public
as $
begin
 if not exists(select 1 from public.hr_employees e where e.id=new.employee_id and e.organization_id=new.organization_id) then
  raise exception 'Employee must belong to the same organisation';
 end if;
 return new;
end $;
drop trigger if exists hr_leave_employee_tenant_guard on public.hr_leave_requests;
create trigger hr_leave_employee_tenant_guard before insert or update of organization_id,employee_id on public.hr_leave_requests for each row execute function public.validate_hr_child_employee_tenant();
drop trigger if exists hr_attendance_employee_tenant_guard on public.hr_attendance_records;
create trigger hr_attendance_employee_tenant_guard before insert or update of organization_id,employee_id on public.hr_attendance_records for each row execute function public.validate_hr_child_employee_tenant();
drop trigger if exists hr_review_employee_tenant_guard on public.hr_performance_reviews;
create trigger hr_review_employee_tenant_guard before insert or update of organization_id,employee_id on public.hr_performance_reviews for each row execute function public.validate_hr_child_employee_tenant();

create or replace function public.validate_hr_payroll_links()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
 if not exists(select 1 from public.hr_payroll_periods p where p.id=new.payroll_period_id and p.organization_id=new.organization_id) then
  raise exception 'Payroll period must belong to the same organisation';
 end if;
 if not exists(select 1 from public.hr_employees e where e.id=new.employee_id and e.organization_id=new.organization_id) then
  raise exception 'Employee must belong to the same organisation';
 end if;
 return new;
end $$;
drop trigger if exists hr_payroll_item_tenant_guard on public.hr_payroll_items;
create trigger hr_payroll_item_tenant_guard before insert or update on public.hr_payroll_items for each row execute function public.validate_hr_payroll_links();

comment on table public.hr_employees is 'Tenant-scoped HR employee records; access restricted to organisation owners and HR managers.';
comment on table public.hr_payroll_items is 'Sensitive payroll line items; do not expose through public APIs or untrusted client contexts.';
