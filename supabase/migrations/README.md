# Database migrations

Review and apply migrations in numeric order in a development Supabase project before considering production.

1. `001_core_platform.sql` — organizations, memberships, platform admins, audit events and helper policies.
2. `002_organization_admin_fields.sql` — compatibility fields for organization management.
3. `003_platform_marketplace.sql` — candidates, jobs, applications, consultancy links, support and initial policies.
4. `004_portal_runtime_compatibility.sql` — fields, discovery cards and private document bucket expected by the current portal JavaScript.
5. `005_hrm_workforce_core.sql` — tenant-scoped departments, employee records, leave requests, attendance, performance reviews and draft payroll periods.
6. `006_hrm_expansion_modules.sql` — tenant-scoped operations register for recruitment tracking, onboarding/offboarding, shift planning, benefits, compliance, remittance, approvals, billing, wage tracking and go-live tasks.
7. `007_ag_german_employee_registration.sql` — exact AG German Institute onboarding fields, private document bucket, submission workflow, HR review and employee record creation.
8. `008_hr_employee_invitations.sql` — secure, expiring, single-use employee invitations.
9. `009_atomic_payroll_workflow.sql` — atomic payroll-period status transitions and line status synchronisation; requires migration 005 and does not calculate statutory deductions or send payments.
10. `010_hr_workspace_settings.sql` — persistent organisation-scoped HR preferences and RLS policies; requires migration 005 (for `public.can_manage_hr`).
11–15. Platform security, candidate profile and professional-reference migrations; review each numbered SQL file and validate dependencies before application.
16. `016_hrm_employee_documents_and_compensation.sql` — monthly basic salary and payroll reference fields, organisation-scoped employee document metadata, and a private `nexora-hr-documents` Storage bucket with HR-manager-only policies. Requires `public.can_manage_hr` from migration 005 and Supabase Storage. Files are limited to 10 MB and common PDF, Word and image formats.

17. `017_employee_self_service_account_link.sql` — safe self-link RPC for confirmed employee email + active employee membership, only when exactly one unlinked employee record matches. Requires migrations 001, 005 and 008/employee membership data.

## Deployment safety
- Migration 009 must be tested with draft, processing, review, approved and paid periods, including empty periods, held lines, missing payment dates, invalid transitions, and users from a different organisation.
- These files were added to version control after the live project had already been configured manually. The migration ledger in Supabase may not match this folder. Never blindly rerun migrations against production.
- Apply and test migrations 005–016 in numeric order in a development project first; compare the live schema and migration ledger and back up data before production changes. In particular, verify the private document bucket and cross-organisation storage policies before uploading real staff files. The HR workspace Settings page checks table access and will show missing tables or schema-cache/permission errors.
- Migration 005–006 tests: use at least two organisations and separate accounts; verify all cross-organisation employee/department/leave/attendance/review/payroll/operations links are rejected or isolated.
- Migration 007 creates `hr_employee_registrations` and a private `hr-employee-documents` bucket (10 MB maximum per file). Object paths are `<organization UUID>/<submitter user UUID>/<registration UUID>/<category>/<filename>`. Check storage policies using an employee account, an authorised HR manager, a non-HR member and an unrelated organisation account.
- Registration records contain highly sensitive identity, tax, health-insurance, social-security, bank and beneficiary information. The database policy limits record access to the submitter and authorised HR managers. Do not expose this table in general employee exports or public APIs.
- HR review is the point at which a basic employee record is created. It does not automatically link the employee to an Auth account; use the approved employee invitation/account-linking workflow for My Portal. Migration 017 supports safe self-linking only after the employee has an active `employee` membership and a confirmed email matching exactly one HR record; it does not replace invitation/approval or grant membership by itself.
- Payroll entries are manual draft records, not Kenyan statutory calculations or remittance. The operations registers do not execute external payments, statutory submissions, marketplace publication or a configurable approval engine.
- Never expose the Supabase service-role key. Verify all file downloads use short-lived signed URLs.
