-- NEXORA HRM expansion modules (migration 024)
-- Adds tenant-scoped operations registers for expenses, assets, goals, employee relations,
-- helpdesk, integration inventory, workforce planning and workflow configuration.
alter table public.hr_operations_records
 drop constraint if exists hr_operations_records_module_key_check;
alter table public.hr_operations_records
 add constraint hr_operations_records_module_key_check
 check (module_key in (
  'recruitment','onboarding','offboarding','documents','training','timesheets','shifts','benefits','compliance',
  'remittance','approvals','billing','simulator','wage_tracker','settings','go_live',
  'expenses','assets','goals','employee_relations','helpdesk','integrations','workforce_planning','workflow_automation'
 ));
create index if not exists hr_operations_org_module_updated_idx
 on public.hr_operations_records(organization_id,module_key,updated_at desc);
create index if not exists hr_operations_org_due_idx
 on public.hr_operations_records(organization_id,due_date)
 where due_date is not null;
comment on column public.hr_operations_records.module_key is
 'Tenant-scoped HR operations module. Sensitive employee-relations case content must be limited to authorised HR roles.';
