-- Separate regular gross salary used for Affordable Housing Levy from total taxable cash pay.
-- The historical backfill uses basic pay plus regular cash allowances; Finance should review
-- existing records before using them for statutory filings.
alter table public.hr_payroll_items
  add column if not exists other_taxable_cash_earnings numeric(12,2),
  add column if not exists housing_levy_pensionable_pay numeric(12,2);

update public.hr_payroll_items
set other_taxable_cash_earnings = coalesce(other_taxable_cash_earnings, 0),
    housing_levy_pensionable_pay = coalesce(
      housing_levy_pensionable_pay,
      coalesce(basic_pay, 0) + coalesce(allowances, 0)
    )
where other_taxable_cash_earnings is null
   or housing_levy_pensionable_pay is null;

alter table public.hr_payroll_items
  alter column other_taxable_cash_earnings set default 0,
  alter column other_taxable_cash_earnings set not null,
  alter column housing_levy_pensionable_pay set default 0,
  alter column housing_levy_pensionable_pay set not null;

comment on column public.hr_payroll_items.other_taxable_cash_earnings is
  'Taxable cash earnings beyond basic pay, regular cash allowances and overtime, e.g. bonuses or commissions.';
comment on column public.hr_payroll_items.housing_levy_pensionable_pay is
  'Affordable Housing Levy base: basic pay plus regular cash allowances; excludes non-cash and irregular payments under KRA guidance.';
