# Database migrations

Review and apply migrations in numeric order in a development Supabase project before considering production.

1. `001_core_platform.sql` — organizations, memberships, platform admins, audit events and helper policies.
2. `002_organization_admin_fields.sql` — compatibility fields for organization management.
3. `003_platform_marketplace.sql` — candidates, jobs, applications, consultancy links, support and initial policies.
4. `004_portal_runtime_compatibility.sql` — fields, discovery cards and private document bucket expected by the current portal JavaScript.
5. `005_hrm_workforce_core.sql` — tenant-scoped departments, employee records, leave requests, attendance, performance reviews and draft payroll periods.
6. `006_hrm_expansion_modules.sql` — tenant-scoped operations register for recruitment tracking, onboarding/offboarding, shift planning, benefits, compliance, remittance, approvals, billing, wage tracking and go-live tasks.
7. `007_ag_german_employee_registration.sql` — exact AG German Institute onboarding fields, private document bucket, submission workflow, HR review and employee record creation.
8. `009_atomic_payroll_workflow.sql` — atomic payroll-period status transitions and line status synchronisation; requires migration 005 and does not calculate statutory deductions or send payments.

## Deployment safety
- Migration 009 must be tested with draft, processing, review, approved and paid periods, including empty periods, held lines, missing payment dates, invalid transitions, and users from a different organisation.
- These files were added to version control after the live project had already been configured manually. The migration ledger in Supabase may not match this folder. Never blindly rerun migrations against production.
- Apply and test migrations 005–007 in a development project first; compare live schema and back up data before production changes.
- Migration 005–006 tests: use at least two organisations and separate accounts; verify all cross-organisation employee/department/leave/attendance/review/payroll/operations links are rejected or isolated.
- Migration 007 creates `hr_employee_registrations` and a private `hr-employee-documents` bucket (10 MB maximum per file). Object paths are `<organization UUID>/<submitter user UUID>/<registration UUID>/<category>/<filename>`. Check storage policies using an employee account, an authorised HR manager, a non-HR member and an unrelated organisation account.
- Registration records contain highly sensitive identity, tax, health-insurance, social-security, bank and beneficiary information. The database policy limits record access to the submitter and authorised HR managers. Do not expose this table in general employee exports or public APIs.
- HR review is the point at which a basic employee record is created. It does not automatically link the employee to an Auth account; use an approved invitation/account-linking workflow for My Portal.
- Payroll entries are manual draft records, not Kenyan statutory calculations or remittance. The operations registers do not execute external payments, statutory submissions, marketplace publication or a configurable approval engine.
- Never expose the Supabase service-role key. Verify all file downloads use short-lived signed URLs.
