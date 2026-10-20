-- Align payroll audit action constraint with executive review/payment RPCs.
-- Existing audit history is preserved; this only expands the accepted action values.
alter table public.hr_payroll_audit_events
  drop constraint if exists hr_payroll_audit_events_action_check;

alter table public.hr_payroll_audit_events
  add constraint hr_payroll_audit_events_action_check
  check (action = any (array[
    'period_created',
    'payroll_generated',
    'line_calculated',
    'line_edited',
    'submitted_for_review',
    'payroll_approved',
    'payment_recorded',
    'payslip_viewed',
    'executive_payroll_approved',
    'executive_payroll_returned',
    'executive_payroll_rejected',
    'executive_payment_recorded'
  ]::text[]));
