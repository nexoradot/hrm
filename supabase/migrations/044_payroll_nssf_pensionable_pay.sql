-- Persist the pensionable-pay basis used for NSSF on each payroll line.
-- The default backfill uses basic pay only; HR must include only fixed pensionable
-- contractual earnings and exclude fluctuating emoluments under the applicable regulations.
alter table public.hr_payroll_items
  add column if not exists nssf_pensionable_pay numeric(12,2);

update public.hr_payroll_items
set nssf_pensionable_pay = coalesce(basic_pay, 0)
where nssf_pensionable_pay is null;

alter table public.hr_payroll_items
  alter column nssf_pensionable_pay set default 0,
  alter column nssf_pensionable_pay set not null;

comment on column public.hr_payroll_items.nssf_pensionable_pay is
  'Pensionable earnings used for NSSF; excludes fluctuating emoluments. HR must verify against contract and applicable NSSF regulations.';
