-- Allow employees to submit and read only their own expense claims.
-- HR continues to manage/review all claims through the existing HR operations module.
drop policy if exists employee_submit_own_expense_claim on public.hr_operations_records;
create policy employee_submit_own_expense_claim
on public.hr_operations_records
for insert to authenticated
with check (
 module_key = 'expenses'
 and status = 'submitted'
 and priority in ('low','normal','high')
 and amount is not null and amount > 0
 and employee_id is not null
 and created_by = auth.uid()
 and updated_by = auth.uid()
 and exists (
   select 1 from public.hr_employees e
   join public.organizations o on o.id = e.organization_id
   join public.organization_members m on m.organization_id = o.id
   where e.id = hr_operations_records.employee_id
     and e.organization_id = hr_operations_records.organization_id
     and e.user_id = auth.uid()
     and o.status = 'active'
     and m.user_id = auth.uid()
     and m.status = 'active'
 )
);
drop policy if exists employee_read_own_expense_claims on public.hr_operations_records;
create policy employee_read_own_expense_claims
on public.hr_operations_records
for select to authenticated
using (
 module_key = 'expenses'
 and employee_id is not null
 and exists (
   select 1 from public.hr_employees e
   join public.organizations o on o.id = e.organization_id
   join public.organization_members m on m.organization_id = o.id
   where e.id = hr_operations_records.employee_id
     and e.organization_id = hr_operations_records.organization_id
     and e.user_id = auth.uid()
     and o.status = 'active'
     and m.user_id = auth.uid()
     and m.status = 'active'
 )
);
