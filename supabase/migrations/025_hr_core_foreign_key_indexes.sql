-- Improve joins and delete/update checks on core tenant-scoped HR records.
-- These indexes do not change row-level security or data semantics.
create index if not exists hr_attendance_employee_id_idx on public.hr_attendance_records(employee_id);
create index if not exists hr_employee_documents_employee_id_idx on public.hr_employee_documents(employee_id);
create index if not exists hr_employee_documents_uploaded_by_idx on public.hr_employee_documents(uploaded_by);
create index if not exists hr_employee_documents_verified_by_idx on public.hr_employee_documents(verified_by);
create index if not exists hr_employee_registrations_employee_id_idx on public.hr_employee_registrations(employee_id);
create index if not exists hr_employee_registrations_reviewed_by_idx on public.hr_employee_registrations(reviewed_by);
create index if not exists hr_operations_employee_id_idx on public.hr_operations_records(employee_id);
create index if not exists hr_payroll_audit_actor_id_idx on public.hr_payroll_audit_events(actor_id);
create index if not exists hr_payroll_audit_item_id_idx on public.hr_payroll_audit_events(payroll_item_id);
create index if not exists hr_payroll_audit_period_id_idx on public.hr_payroll_audit_events(payroll_period_id);
