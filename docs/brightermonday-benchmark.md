# NEXORA product benchmark: BrighterMonday Kenya

**Purpose:** Use BrighterMonday as a reference for recruitment-marketplace journeys, not as a template to copy verbatim.

## Source observations

The homepage HTML reviewed on 10 October 2026 shows a clear public navigation structure:
- Job seeker, with links to vacancies, career tools, job-search advice and learning
- Blog, including career development, life at work and job-market news
- Help centre, FAQs and contact
- About us
- Login, sign up and Post a job

The public page metadata describes BrighterMonday as a job website/app focused on job search and career advice. The supplied HTML does not reveal the complete authenticated backend or prove the exact implementation of every employer or candidate feature.

## NEXORA product direction

NEXORA's scope is broader than a vacancy board: the intended ecosystem combines recruitment with HR/workforce management.

### Public website
- Clear proposition: **NEXORA — INTELLIGENCE FOR EVERY WORKFORCE**
- Separate journeys for candidates, employers, consultancies and HR teams
- Direct entry points to jobs, role-specific portals, services, pricing, contact and privacy information
- Mobile-responsive navigation and SEO-friendly page metadata

### Talent marketplace
- Search published vacancies by title, skill, employer and location
- Filter by location, employment type and workplace arrangement
- Show employer, location, work arrangement, closing date and salary only when the employer chose to disclose it
- Display job details in an accessible in-page modal
- Require candidate authentication before an application can be submitted
- Avoid suggesting a job is publicly available unless its database status is published and its closing date has not passed

### Candidate experience
- Candidate account and profile
- Application history and status tracking
- Private CV and supporting-document storage
- Explicit opt-in for consultancy discovery
- Candidate approval before a consultancy accesses shared documents
- Ability to decline or revoke sharing

### Employer workspace
- Organization membership and verification gate
- Submit vacancies for moderation before publication
- View applications and update recruitment status
- Future modules: interview scheduling, candidate assessments, offer management and recruitment analytics; these must be implemented and tested before being marketed as live

### Consultancy workspace
- Discover only opted-in candidate cards
- Request document access through explicit consent
- Access files only while the consent relationship remains authorized
- Coordinate recruitment assignments and shortlists; client billing and service delivery still require dedicated workflows

### HRM workspace
The strategic roadmap includes employee records, onboarding, leave, attendance/shifts, performance, documents and payroll workflows. Do not imply that these are all production-ready simply because they appear in the brand proposition.

### Super Admin
Central governance should cover organization verification, account/role assignment, vacancy moderation, platform configuration, support, subscriptions and audit events. Actions that change production data must be backed by server/database authorization, not merely hidden buttons.

## Changes included in this update branch

- Redesigned the public homepage to present both recruitment and workforce management
- Improved the jobs marketplace with keyword, location, employment type and work-arrangement filters
- Added candidate sign-up alongside sign-in on the marketplace
- Replaced browser-alert job details with an in-page modal
- Added an interim privacy/consent information page
- Updated the repository README with architecture and release safety notes

## Release checklist — must be verified before production

1. Confirm the correct Supabase migrations and RLS policies are deployed to a test project.
2. Test candidate signup, email confirmation, login/logout and profile creation.
3. Test vacancy search/filtering with published, pending, expired and salary-hidden jobs.
4. Test duplicate application prevention and application status visibility.
5. Test employer membership, organization verification and moderation requirements.
6. Test that one employer cannot read another employer's jobs or applications.
7. Test consultancy discovery only for candidates who opted in.
8. Test consent acceptance, decline and revocation, including document-download authorization after revocation.
9. Verify the `candidate-private-documents` bucket is private and signed URLs expire.
10. Test mobile layout, keyboard navigation and modal accessibility.
11. Review the full privacy policy, retention schedule, controller/contact details and relevant Kenyan data-protection obligations.
12. Confirm GitHub Pages deployment and real end-to-end flows after merging; a Git commit alone is not a production test.

## Commercial model to evaluate

- Company HRM subscriptions
- Paid job promotion and recruitment products
- Candidate assessment or high-volume hiring packages
- Managed recruitment and HR consultancy services

Pricing shown publicly must be clearly labelled as proposed until billing, terms, support and service fulfilment are operational.
