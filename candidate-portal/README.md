# Candidate portal

Purpose: candidate registration/sign-in, profile management, CV and document management, consent controls, job applications and application status.

Security requirements:
- Candidate profile access must be restricted to the owner and specifically authorised workflows.
- Store CVs and identity documents in private storage.
- Record explicit consent before sharing candidate information with the consultancy or an employer.
- Use Supabase Row Level Security; client-side visibility controls are not sufficient.
