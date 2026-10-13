# NEXORA HRM Core — Delivery Notes

## Included in this batch
- Dedicated employer HR workspace at `company-portal/hrm.html`.
- Supabase-authenticated sign-in and organisation selection.
- HR manager / owner access gate in the browser, backed by database RLS.
- Employee directory and creation/editing.
- Department management.
- Leave request entry and approve/reject workflow.
- Daily attendance register.
- Performance review records.
- Draft payroll period setup.
- Tenant-scoped core schema in migration `005_hrm_workforce_core.sql`.

## Apply migration carefully
1. Use a non-production Supabase project or a reviewed development branch first.
2. Confirm migrations 001–004 are applied.
3. Review and apply migration 005.
4. Confirm the signed-in user has an active `organization_members` row with role `owner` or `hr_manager` for an active organization.
5. Test tenant isolation using two test organizations and accounts before enabling production access.

## Security boundaries
- The client uses only the Supabase public anon key; database RLS is authoritative.
- All HRM tables are restricted to active organization owners / HR managers and platform admins through `can_manage_hr`.
- Payroll values must never be treated as verified salary calculations by this UI.
- Payroll tax and statutory logic is not implemented here. Validate current Kenyan PAYE, NSSF, SHIF, housing levy and any applicable employer rules before enabling calculation or payment.
- Do not store CVs, IDs, bank account details or other highly sensitive documents in employee notes. Use private storage with explicit access policies.
- The browser access gate is usability only; RLS policies enforce access at the database.

## Not yet production complete
- Employee invitation / self-service authentication.
- Payroll item calculation, approval, bank export and payslip delivery.
- Leave balances and accrual policies.
- Attendance devices, shift rosters and overtime calculation.
- Performance cycle templates, employee acknowledgement and audit trail.
- Email/SMS notifications, subscription enforcement, automated backups and monitoring.
- Full end-to-end tests against a deployed Supabase development project.

## Test checklist
- Sign in with a non-member: workspace must be denied.
- Sign in with an active owner / HR manager: organisation list is limited to memberships.
- Create department and employee; verify reload persistence.
- Try selecting a department from another organisation: database must reject it.
- Submit leave and approve/reject it.
- Record attendance and verify duplicate employee/day is rejected.
- Create a review with rating outside 1–5: reject it.
- Create payroll period with end date before start date: reject it.
- Confirm a user from organisation A cannot read or mutate organisation B records.
- Confirm anonymous access cannot select any HRM table.
