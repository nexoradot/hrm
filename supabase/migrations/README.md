# Database migrations

Review and apply migrations in numeric order in a development Supabase project before considering production.

1. `001_core_platform.sql` — organizations, memberships, platform admins, audit events and helper policies.
2. `002_organization_admin_fields.sql` — compatibility fields for organization management.
3. `003_platform_marketplace.sql` — candidates, jobs, applications, consultancy links, support and initial policies.
4. `004_portal_runtime_compatibility.sql` — fields, discovery cards and private document bucket expected by the current portal JavaScript.
5. `005_hrm_workforce_core.sql` — tenant-scoped departments, employee records, leave requests, attendance, performance reviews and draft payroll periods. Includes RLS and same-organisation relationship guards.
6. `006_hrm_expansion_modules.sql` — tenant-scoped operations register used by recruitment tracking, onboarding/offboarding tasks, shift planning, benefits, compliance, remittance, approvals, billing, payroll-scenario notes, wage tracking, settings and go-live tasks.

Important:
- These files were added to version control after the live project had already been configured manually. The migration ledger in Supabase may not match this folder. Do not blindly rerun migrations against production.
- Compare the live schema with the migrations first, back up data, and test RLS using separate candidate, consultancy, employer and platform-admin accounts.
- Never expose the service-role key.
- Confirm storage bucket policies and candidate consent behavior before using real CVs or identity documents.
- For migration 005, test with at least two separate organisations and accounts. Verify employee, department, leave, attendance, review and payroll-item links cannot cross organisation boundaries.
- Payroll calculations and Kenyan statutory processing are not implemented by migration 005; do not use its totals as calculated payroll.
- Migration 006 enables employee self-service only for employees whose `hr_employees.user_id` is linked to their authenticated account. Test own-record access and attempts to read another employee's profile, leave, attendance, reviews and payroll items.
- Migration 006 operational registers do not publish vacancies, submit statutory remittances, collect payments, calculate statutory payroll or enforce a configurable approval engine.
- Migration 006 adds a general operational register, not external integrations: it does not publish vacancies, submit statutory remittances, collect payments, calculate payroll, or enforce a configurable approval engine.
- Test migration 006 with at least two organisations, including attempts to attach a record to an employee from another organisation. Confirm all operations are rejected or isolated by RLS and the employee-link trigger.
- `supabase/schema.sql` is a non-destructive note/entry point, not a substitute for these migrations.
