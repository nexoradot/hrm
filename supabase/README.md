# Supabase backend

Keep database migrations and Edge Functions version-controlled in this folder.

- Apply migrations in order and verify them in a development/test project before production.
- Never commit service-role keys, database passwords or user credentials.
- Keep privileged operations in trusted server-side functions.
- Test Row Level Security for candidate, employer, consultancy and platform-admin roles.
- Use private storage for CVs and personal documents, with consent-aware access.
