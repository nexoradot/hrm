-- Track probation and contract lifecycle without changing existing employee records.
alter table public.hr_employees
  add column if not exists probation_period_months integer not null default 3,
  add column if not exists probation_end_date date,
  add column if not exists contract_end_date date,
  add column if not exists contract_status text not null default 'not_uploaded'
    check (contract_status in ('not_uploaded','draft','active','renewal_due','expired','terminated'));

alter table public.hr_employees
  drop constraint if exists hr_employees_probation_period_months_check;
alter table public.hr_employees
  add constraint hr_employees_probation_period_months_check
  check (probation_period_months between 0 and 24);

create index if not exists hr_employees_org_probation_end_idx
  on public.hr_employees (organization_id, probation_end_date)
  where probation_end_date is not null;
create index if not exists hr_employees_org_contract_end_idx
  on public.hr_employees (organization_id, contract_end_date)
  where contract_end_date is not null;
