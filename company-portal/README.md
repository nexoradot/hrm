# Company HR portal

Purpose: company workspace, job creation, applicant review and future workforce-management modules.

Tenant isolation is mandatory: each organisation must only access records belonging to that organisation unless a specific authorised platform operation permits otherwise. Enforce this in Supabase policies and trusted backend logic.

## HRM workspace entry points

- HR administrator workspace: `hrm.html`
- Employee self-service portal: `my-portal.html` (requires `hr_employees.user_id` to be linked to the employee's authenticated account)
- Expansion migration: `../supabase/migrations/006_hrm_expansion_modules.sql`

The administrator workspace includes tenant-scoped operational registers and CSV reporting. The employee portal supports own-record profile, leave request submission, attendance, performance and payroll-record viewing when migration 006 is installed and the employee account is linked. The expansion registers are not external integrations; statutory payroll calculation, private document storage, payment collection, statutory remittance submission, API/webhook delivery and configurable approvals still require separate implementation and verification.

## HRM expansion modules

The premium HRM workspace includes operational registers for recruitment tracking, onboarding/offboarding, shift planning, benefits, compliance, remittance follow-up, approvals, billing references, payroll-scenario notes, wage tracking, workspace settings and go-live readiness, plus CSV reports and a help/API guidance area. These registers use `hr_operations_records` from migration `006_hrm_expansion_modules.sql` and are scoped by organisation RLS.

**Not represented as finished integrations:** candidate application workflows remain in the recruitment marketplace; employee self-service needs a separate employee-authenticated route and own-record RLS; payroll statutory calculations, payslips, payment collection, statutory remittance submission, API keys/webhooks and configurable approval rules need separate implementations and verification.
