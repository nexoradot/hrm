# Database migrations

Review and apply migrations in numeric order in a development Supabase project before considering production.

1. `001_core_platform.sql` — organizations, memberships, platform admins, audit events and helper policies.
2. `002_organization_admin_fields.sql` — compatibility fields for organization management.
3. `003_platform_marketplace.sql` — candidates, jobs, applications, consultancy links, support and initial policies.
4. `004_portal_runtime_compatibility.sql` — fields, discovery cards and private document bucket expected by the current portal JavaScript.

Important:
- These files were added to version control after the live project had already been configured manually. The migration ledger in Supabase may not match this folder. Do not blindly rerun migrations against production.
- Compare the live schema with the migrations first, back up data, and test RLS using separate candidate, consultancy, employer and platform-admin accounts.
- Never expose the service-role key.
- Confirm storage bucket policies and candidate consent behavior before using real CVs or identity documents.
- `supabase/schema.sql` is a non-destructive note/entry point, not a substitute for these migrations.
