-- Allow authenticated employees to submit their own goals and expense claims when their
-- HR employee record is linked to auth.uid() and their organization is active.
-- Do not require organization_members: employee portal accounts may not have a separate
-- workspace membership row. Keep tenant and employee ownership checks intact.
drop policy if exists employee_submit_own_goal on public.hr_operations_records;
create policy employee_submit_own_goal on public.hr_operations_records
for insert to authenticated
with check (
 module_key = 'goals'
 and employee_id is not null
 and status = 'submitted_for_review'
 and priority = any (array['low','normal','high'])
 and created_by = auth.uid()
 and updated_by = auth.uid()
 and exists (
   select 1 from public.hr_employees e
   join public.organizations o on o.id = e.organization_id
   where e.id = hr_operations_records.employee_id
     and e.organization_id = hr_operations_records.organization_id
     and e.user_id = auth.uid()
     and o.status = 'active'
 )
);
drop policy if exists employee_submit_own_expense_claim on public.hr_operations_records;
create policy employee_submit_own_expense_claim on public.hr_operations_records
for insert to authenticated
with check (
 module_key = 'expenses'
 and employee_id is not null
 and status = 'submitted'
 and priority = any (array['low','normal','high'])
 and amount is not null and amount > 0
 and created_by = auth.uid()
 and updated_by = auth.uid()
 and exists (
   select 1 from public.hr_employees e
   join public.organizations o on o.id = e.organization_id
   where e.id = hr_operations_records.employee_id
     and e.organization_id = hr_operations_records.organization_id
     and e.user_id = auth.uid()
     and o.status = 'active'
 )
);
