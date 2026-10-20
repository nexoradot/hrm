-- Allow employees to submit and update only their own goal/KPI records.
drop policy if exists employee_submit_own_goal on public.hr_operations_records;
create policy employee_submit_own_goal on public.hr_operations_records for insert to authenticated with check (
 module_key='goals' and employee_id is not null and status='submitted_for_review'
 and priority=any(array['low','normal','high']) and created_by=auth.uid() and updated_by=auth.uid()
 and exists (select 1 from public.hr_employees e join public.organizations o on o.id=e.organization_id join public.organization_members m on m.organization_id=o.id where e.id=hr_operations_records.employee_id and e.organization_id=hr_operations_records.organization_id and e.user_id=auth.uid() and o.status='active' and m.user_id=auth.uid() and m.status='active')
);
drop policy if exists employee_update_own_goal_progress on public.hr_operations_records;
create policy employee_update_own_goal_progress on public.hr_operations_records for update to authenticated
using (
 module_key='goals' and employee_id is not null and status not in ('achieved','missed','archived','rejected')
 and exists (select 1 from public.hr_employees e join public.organizations o on o.id=e.organization_id join public.organization_members m on m.organization_id=o.id where e.id=hr_operations_records.employee_id and e.organization_id=hr_operations_records.organization_id and e.user_id=auth.uid() and o.status='active' and m.user_id=auth.uid() and m.status='active')
)
with check (
 module_key='goals' and employee_id is not null and updated_by=auth.uid()
 and exists (select 1 from public.hr_employees e join public.organizations o on o.id=e.organization_id join public.organization_members m on m.organization_id=o.id where e.id=hr_operations_records.employee_id and e.organization_id=hr_operations_records.organization_id and e.user_id=auth.uid() and o.status='active' and m.user_id=auth.uid() and m.status='active')
);