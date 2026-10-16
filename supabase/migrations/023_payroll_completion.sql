-- NEXORA HRM payroll completion: employee tax settings, employer costs and audit trail.
alter table public.hr_employees
  add column if not exists tax_residency text not null default 'resident'
    check (tax_residency in ('resident','non_resident')),
  add column if not exists employee_pension_contribution numeric(14,2) not null default 0
    check (employee_pension_contribution >= 0),
  add column if not exists insurance_premiums_monthly numeric(14,2) not null default 0
    check (insurance_premiums_monthly >= 0);

alter table public.hr_payroll_items
  add column if not exists employer_nssf numeric(14,2) not null default 0 check (employer_nssf >= 0),
  add column if not exists employer_housing_levy numeric(14,2) not null default 0 check (employer_housing_levy >= 0),
  add column if not exists employee_pension_contribution numeric(14,2) not null default 0 check (employee_pension_contribution >= 0),
  add column if not exists payslip_number text,
  add column if not exists calculation_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_reference text;

create unique index if not exists hr_payroll_items_payslip_number_uidx
  on public.hr_payroll_items(organization_id,payslip_number)
  where payslip_number is not null;

create table if not exists public.hr_payroll_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_period_id uuid references public.hr_payroll_periods(id) on delete set null,
  payroll_item_id uuid references public.hr_payroll_items(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('period_created','payroll_generated','line_calculated','line_edited','submitted_for_review','payroll_approved','payment_recorded','payslip_viewed')),
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hr_payroll_audit_org_created_idx
  on public.hr_payroll_audit_events(organization_id,created_at desc);
alter table public.hr_payroll_audit_events enable row level security;
drop policy if exists hr_payroll_audit_hr_manager_all on public.hr_payroll_audit_events;
create policy hr_payroll_audit_hr_manager_all on public.hr_payroll_audit_events
  for all to authenticated using(public.can_manage_hr(organization_id))
  with check(public.can_manage_hr(organization_id));
grant select,insert on public.hr_payroll_audit_events to authenticated;

create or replace function public.validate_hr_payroll_audit_links()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
  if new.payroll_period_id is not null and not exists (
    select 1 from public.hr_payroll_periods p where p.id=new.payroll_period_id and p.organization_id=new.organization_id
  ) then raise exception 'Payroll audit period must belong to the same organisation'; end if;
  if new.payroll_item_id is not null and not exists (
    select 1 from public.hr_payroll_items i where i.id=new.payroll_item_id and i.organization_id=new.organization_id
  ) then raise exception 'Payroll audit item must belong to the same organisation'; end if;
  return new;
end $$;
drop trigger if exists hr_payroll_audit_tenant_guard on public.hr_payroll_audit_events;
create trigger hr_payroll_audit_tenant_guard before insert or update on public.hr_payroll_audit_events
for each row execute function public.validate_hr_payroll_audit_links();

comment on column public.hr_payroll_items.calculation_snapshot is 'Snapshot of statutory rule version and calculation inputs used to produce this payroll line.';
comment on table public.hr_payroll_audit_events is 'Organisation-scoped audit trail for payroll calculations, approvals, payslip access and payment status recording.';
