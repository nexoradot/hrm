# NEXORA — Human Resources & Workforce Management

**Brand:** NEXORA  
**Tagline:** INTELLIGENCE FOR EVERY WORKFORCE  
**Category:** Human Resources, Recruitment & Workforce Management

NEXORA is being developed as a connected ecosystem that combines a public jobs marketplace, candidate portal, employer recruitment workspace, HR consultancy workspace, company HRM capabilities and a central Super Admin console.

## Live entry points

- Production base / Super Admin: https://nexoradot.github.io/hrm/
- Public website: https://nexoradot.github.io/hrm/public-site/
- Jobs marketplace: https://nexoradot.github.io/hrm/public-site/jobs/
- Candidate portal: https://nexoradot.github.io/hrm/candidate-portal/
- Employer recruitment portal: https://nexoradot.github.io/hrm/company-portal/\n- HRM workspace (requires Supabase migration 005 and an active owner/HR-manager membership): https://nexoradot.github.io/hrm/company-portal/hrm.html
- Consultancy portal: https://nexoradot.github.io/hrm/consultancy-portal/

## Product areas

1. **Public website:** platform overview, solutions, pricing, contact and navigation to role-specific workspaces.
2. **Jobs marketplace:** search published vacancies; filter by location, employment type and workplace arrangement; inspect a job detail view; sign in or create a candidate account before applying.
3. **Candidate portal:** candidate profile, application history, private candidate-document workflows and consent-based consultancy discovery/sharing.
4. **Employer portal:** organization workspace, vacancy submission for moderation and applicant status management.
5. **Consultancy portal:** candidate discovery for opted-in profiles, consent requests and approved document access.
6. **Company HRM:** workforce core portal added for employee records, departments, leave requests, attendance, performance reviews and draft payroll periods. It requires migration 005 and tenant-isolation testing; payroll calculation and statutory processing are not yet implemented.
7. **Super Admin:** central organization, user, verification, moderation and platform governance functions, subject to the deployed code and database policies.

## Technology and architecture

- HTML pages with CSS in each page's `<style>` block
- External JavaScript files
- Supabase Auth, Postgres, Row Level Security and private Storage
- GitHub Pages for static web hosting
- Supabase Edge Functions for trusted server-side operations where needed

## Repository map

- `index.html`, `app.js`: root Super Admin dashboard and runtime
- `public-site/`: public landing page, jobs marketplace, about, services, pricing and contact
- `candidate-portal/`: candidate account and profile workflows
- `company-portal/`: employer organization, vacancies and application workflow
- `consultancy-portal/`: consent-aware candidate discovery and recruitment support
- `portal.js`: shared public/candidate/consultancy/employer browser runtime
- `js/supabase-config.js`: public Supabase project configuration
- `js/platform-operations.js`: Super Admin helper UI
- `supabase/migrations/`: versioned schema and policy changes
- `supabase/functions/`: trusted server-side functions
- `docs/brightermonday-benchmark.md`: product benchmark and delivery checklist

## Current update from the BrighterMonday benchmark

- Public homepage now presents the talent marketplace and workforce-management proposition together.
- Navigation exposes jobs, candidate, employer and consultancy journeys.
- Job search now includes keyword, location, employment-type and workplace-arrangement filters.
- Vacancy details use an in-page accessible modal rather than a browser alert.
- Candidate sign-up is available from the jobs page, alongside sign-in.
- Public privacy information is linked from the jobs marketplace.

## Deployment and security notes

- A GitHub commit or merged pull request does **not** prove that GitHub Pages has finished deploying or that production workflows work.
- The recruitment portal depends on the relevant Supabase migrations, policies, tables and Storage bucket. Confirm the migration status in a development project before applying changes to production.
- Never place a Supabase service-role key in browser code. Only use the public anon key with restrictive Row Level Security policies.
- Candidate CVs and identity/qualification documents must remain in private storage. Use short-lived signed URLs and verify that access is authorized by the candidate's active consent record.
- Review consent revocation, organization verification, company-level separation, applicant access and file-download permissions before production launch.
- Subscription cards and unimplemented HRM modules must not be described as active services until payment, permissions, data handling and operational flows have been tested.
- For each release, test signup/email confirmation, login/logout, job filtering, duplicate application handling, application tracking, employer moderation, consultancy consent, document upload/download and mobile layouts.

## Development workflow

The marketplace changes are prepared on `feature/nexora-marketplace-upgrade`. Review the pull request and test against a non-production Supabase project before merging. Do not run unverified migrations against the live project.
