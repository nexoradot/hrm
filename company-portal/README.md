# Company HR portal

Purpose: company workspace, job creation, applicant review and future workforce-management modules.

Tenant isolation is mandatory: each organisation must only access records belonging to that organisation unless a specific authorised platform operation permits otherwise. Enforce this in Supabase policies and trusted backend logic.

## HRM expansion modules

The premium HRM workspace includes operational registers for recruitment tracking, onboarding/offboarding, shift planning, benefits, compliance, remittance follow-up, approvals, billing references, payroll-scenario notes, wage tracking, workspace settings and go-live readiness, plus CSV reports and a help/API guidance area. These registers use `hr_operations_records` from migration `006_hrm_expansion_modules.sql` and are scoped by organisation RLS.

**Not represented as finished integrations:** candidate application workflows remain in the recruitment marketplace; employee self-service needs a separate employee-authenticated route and own-record RLS; payroll statutory calculations, payslips, payment collection, statutory remittance submission, API keys/webhooks and configurable approval rules need separate implementations and verification.
