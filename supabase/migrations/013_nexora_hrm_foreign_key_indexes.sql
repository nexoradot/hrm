-- NEXORA HRM: index HR foreign-key columns for faster joins and deletes.
-- Additive and safe: no table data is changed.
create index if not exists hr_attendance_recorded_by_idx on public.hr_attendance_records(recorded_by) where recorded_by is not null;
create index if not exists hr_departments_created_by_idx on public.hr_departments(created_by) where created_by is not null;
create index if not exists hr_employee_invitations_created_by_idx on public.hr_employee_invitations(created_by) where created_by is not null;
create index if not exists hr_employee_invitations_redeemed_by_idx on public.hr_employee_invitations(redeemed_by) where redeemed_by is not null;
create index if not exists hr_employees_department_idx on public.hr_employees(department_id) where department_id is not null;
create index if not exists hr_employees_user_idx on public.hr_employees(user_id) where user_id is not null;
create index if not exists hr_employees_manager_idx on public.hr_employees(manager_employee_id) where manager_employee_id is not null;
create index if not exists hr_employees_created_by_idx on public.hr_employees(created_by) where created_by is not null;
create index if not exists hr_leave_employee_idx on public.hr_leave_requests(employee_id);
create index if not exists hr_leave_requested_by_idx on public.hr_leave_requests(requested_by) where requested_by is not null;
create index if not exists hr_leave_decided_by_idx on public.hr_leave_requests(decided_by) where decided_by is not null;
create index if not exists hr_operations_created_by_idx on public.hr_operations_records(created_by) where created_by is not null;
create index if not exists hr_operations_updated_by_idx on public.hr_operations_records(updated_by) where updated_by is not null;
create index if not exists hr_payroll_items_employee_idx on public.hr_payroll_items(employee_id);
create index if not exists hr_payroll_periods_created_by_idx on public.hr_payroll_periods(created_by) where created_by is not null;
create index if not exists hr_payroll_periods_approved_by_idx on public.hr_payroll_periods(approved_by) where approved_by is not null;
create index if not exists hr_performance_reviews_employee_idx on public.hr_performance_reviews(employee_id);
create index if not exists hr_performance_reviews_reviewer_idx on public.hr_performance_reviews(reviewer_id) where reviewer_id is not null;
create index if not exists hr_workspace_settings_updated_by_idx on public.hr_workspace_settings(updated_by) where updated_by is not null;
