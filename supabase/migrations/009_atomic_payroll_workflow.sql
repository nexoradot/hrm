-- Atomic payroll workflow transitions for NEXORA HRM.
-- Apply only after reviewing migrations 001-006 in a development Supabase project.
-- This function changes workflow state; it does not calculate statutory deductions,
-- transfer funds, or submit returns to external agencies.

create or replace function public.advance_hr_payroll_period(
  p_period_id uuid,
  p_next_status text
)
returns public.hr_payroll_periods
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period public.hr_payroll_periods%rowtype;
  v_expected text;
  v_count integer;
  v_held integer;
begin
  select * into v_period
  from public.hr_payroll_periods
  where id = p_period_id
  for update;

  if not found then
    raise exception 'Payroll period not found or not accessible';
  end if;

  if not public.can_manage_hr(v_period.organization_id) then
    raise exception 'You are not authorised to manage payroll for this organisation';
  end if;

  v_expected := case v_period.status
    when 'draft' then 'processing'
    when 'processing' then 'review'
    when 'review' then 'approved'
    when 'approved' then 'paid'
    else null
  end;

  if v_expected is null or p_next_status is distinct from v_expected then
    raise exception 'Invalid payroll transition from % to %', v_period.status, p_next_status;
  end if;

  select count(*), count(*) filter (where payment_status = 'held')
    into v_count, v_held
  from public.hr_payroll_items
  where organization_id = v_period.organization_id
    and payroll_period_id = v_period.id;

  if p_next_status in ('review', 'approved', 'paid') and v_count = 0 then
    raise exception 'Add at least one employee payroll line before review or approval';
  end if;

  if p_next_status = 'approved' and v_held > 0 then
    raise exception 'Resolve held payroll lines before approving this period';
  end if;

  if p_next_status = 'paid' then
    if v_period.payment_date is null then
      raise exception 'Set a payment date before marking payroll paid';
    end if;
    if exists (
      select 1 from public.hr_payroll_items
      where organization_id = v_period.organization_id
        and payroll_period_id = v_period.id
        and payment_status <> 'approved'
    ) then
      raise exception 'All payroll lines must be approved before the period can be marked paid';
    end if;
  end if;

  if p_next_status = 'approved' then
    update public.hr_payroll_items
    set payment_status = 'approved', updated_at = now()
    where organization_id = v_period.organization_id
      and payroll_period_id = v_period.id
      and payment_status = 'draft';
  elsif p_next_status = 'paid' then
    update public.hr_payroll_items
    set payment_status = 'paid', updated_at = now()
    where organization_id = v_period.organization_id
      and payroll_period_id = v_period.id
      and payment_status = 'approved';
  end if;

  update public.hr_payroll_periods p
  set status = p_next_status,
      approved_by = case when p_next_status = 'approved' then auth.uid() else p.approved_by end,
      approved_at = case when p_next_status = 'approved' then now() else p.approved_at end,
      employee_count = totals.employee_count,
      gross_total = totals.gross_total,
      deductions_total = totals.deductions_total,
      net_total = totals.net_total,
      updated_at = now()
  from (
    select count(*)::integer as employee_count,
           coalesce(sum(gross_pay), 0)::numeric(14,2) as gross_total,
           coalesce(sum(paye + nssf + shif + housing_levy + other_deductions), 0)::numeric(14,2) as deductions_total,
           coalesce(sum(net_pay), 0)::numeric(14,2) as net_total
    from public.hr_payroll_items
    where organization_id = v_period.organization_id
      and payroll_period_id = v_period.id
  ) totals
  where p.id = v_period.id
    and p.organization_id = v_period.organization_id
  returning p.* into v_period;

  return v_period;
end;
$$;

revoke all on function public.advance_hr_payroll_period(uuid, text) from public;
grant execute on function public.advance_hr_payroll_period(uuid, text) to authenticated;

comment on function public.advance_hr_payroll_period(uuid, text) is
  'Atomically validates and advances an organisation-scoped payroll period and its line statuses. Does not calculate statutory deductions or transfer money.';
