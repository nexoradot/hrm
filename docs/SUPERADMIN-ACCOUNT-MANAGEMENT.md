# Super Admin account management deployment

The Super Admin account directory uses the admin-user-admin Supabase Edge Function to list Supabase Auth users, send invitations, and suspend or restore sign-in. The browser never receives the service-role key.

## Deploy the Edge Function

From a trusted machine with the Supabase CLI authenticated and linked to project prjwtxbmewskkpcfiklo, run:

~~~bash
supabase secrets set SUPABASE_URL=https://prjwtxbmewskkpcfiklo.supabase.co SUPABASE_ANON_KEY=<your-public-anon-key> SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
supabase functions deploy admin-user-admin --project-ref prjwtxbmewskkpcfiklo
~~~

Use the actual project keys from Supabase Dashboard → Project Settings → API. Never commit or paste the service-role key into repository files or browser code.

## Database prerequisites

The live account directory needs migrations 001 and 002 for organizations and memberships. HRM features also need migrations 005 and 006; the employee-registration workflow needs corrected migration 007. Review the live schema first and apply missing migrations in order after testing. Do not blindly rerun migrations against production.

## Behavior

- The directory reads real Auth accounts and organization memberships.
- Platform administrators can invite users to an active workspace with a selected membership role.
- New memberships begin as pending; explicitly activate them after confirming the invited user and role.
- Membership suspension blocks access to that workspace without deleting the account.
- Auth suspension blocks sign-in across the platform.
- Workspace activation/suspension remains available in the Companies view.
- These controls do not create fake employees or sample payroll data. Empty HRM tables remain empty until real data is entered.