# VELNORA — Human Resources & Workforce Management

**Brand:** VELNORA  
**Tagline:** SECURE WORKFORCE. SMARTER DECISIONS.  
**Category:** Human Resources, Recruitment & Workforce Management

VELNORA is being developed as a connected ecosystem that combines a public jobs marketplace, candidate portal, employer recruitment workspace, HR consultancy workspace, company HRM capabilities and a central Super Admin console.

## Live entry points

- Public website: https://velnora.co.ke/ (the repository root redirects to `public-site/`)
- Jobs marketplace: https://velnora.co.ke/public-site/jobs/
- Candidate portal: https://velnora.co.ke/candidate-portal/
- Employer recruitment portal: https://velnora.co.ke/company-portal/
- HRM workspace (requires the relevant HRM migrations and authorised organisation access): https://velnora.co.ke/company-portal/hrm.html
- Employee self-service portal: https://velnora.co.ke/company-portal/my-portal.html
- Consultancy portal: https://velnora.co.ke/consultancy-portal/
- Super Admin: https://velnora.co.ke/superadmin/

## Product areas

1. **Public website:** platform overview, solutions, pricing, contact and navigation to role-specific workspaces.
2. **Jobs marketplace:** search published vacancies; filter by category, location, employment type and workplace arrangement; inspect a job detail view; sign in or create a candidate account before applying.
3. **Candidate portal:** candidate profile, application history, private candidate-document workflows and consent-based consultancy discovery/sharing.
4. **Employer portal:** organization workspace, vacancy submission for moderation and applicant status management.
5. **Consultancy portal:** candidate discovery for opted-in profiles, consent requests and approved document access.
6. **Company HRM:** workforce command centre with employee/department management, salary setup, automatic employee-number suggestions, onboarding task creation, private employee-document upload/download, leave, attendance, performance, payroll-period preparation, operational registers and CSV reporting. Apply migrations 005–006 and 016 in a development project and test tenant isolation before production. The payroll calculator uses the current Kenya NSSF Year 4 limits (Tier I up to KES 9,000 and Tier II up to KES 108,000), SHIF and housing levy rates, and KRA PAYE bands/reliefs. Finance must still validate employee-specific taxable benefits and deductions before approval. VELNORA does not transfer money or file statutory returns.
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
- The portals depend on the matching Supabase migrations, policies, tables and private Storage buckets. The marketplace category selector is introduced by `supabase/migrations/043_job_categories.sql`; apply it before enabling category-based public job search. The migration directory contains historical duplicate numeric prefixes (`017` and `035`); reconcile the deployed migration history before applying or renaming any migration. Do not apply these files by guessed numeric order.
- Never place a Supabase service-role key in browser code. Only use the public anon key with restrictive Row Level Security policies.
- Set the Supabase Auth Site URL to `https://velnora.co.ke` and allowlist the candidate reset redirect `https://velnora.co.ke/candidate-portal/` (plus any approved preview URLs) before enabling password recovery in production.
- Candidate CVs and identity/qualification documents must remain in private storage. Use short-lived signed URLs and verify that access is authorized by the candidate's active consent record.
- Review consent revocation, organization verification, company-level separation, applicant access and file-download permissions before production launch.
- Subscription cards and unimplemented HRM modules must not be described as active services until payment, permissions, data handling and operational flows have been tested.
- For each release, test signup/email confirmation, login/logout, job filtering, duplicate application handling, application tracking, employer moderation, consultancy consent, document upload/download and mobile layouts.

## Development workflow

The VELNORA experience and HRM hardening work is prepared on `audit/velnora-experience-hardening`. Review the pull request and validate it against a restored development Supabase project before merging or deploying. Do not run unverified migrations against production.


## AG German Institute employee onboarding
- Employee form: `company-portal/employee-registration.html`
- HR review queue: `company-portal/employee-registration-review.html`
- Requires migrations 005–007 to be reviewed and applied in the target Supabase project.
- Form fields follow the AG German Institute Google Form supplied by the project owner. Files use a private storage bucket and short-lived signed URLs in the HR review screen.
