# NEXORA — Human Resources & Workforce Management

**Tagline:** Intelligence for Every Workforce

NEXORA is a multi-workspace HR and recruitment platform foundation being developed with HTML, inline CSS, browser JavaScript, Supabase and GitHub Pages.

## Live site
- Production base: https://nexoradot.github.io/hrm/
- Main branch: `main`
- Public site (after merge/deployment): `/hrm/public-site/`
- Jobs marketplace: `/hrm/public-site/jobs/`
- Candidate portal: `/hrm/candidate-portal/`
- Consultancy portal: `/hrm/consultancy-portal/`
- Company portal: `/hrm/company-portal/`
- Current Super Admin entry: `/hrm/`

## Repository map
- `index.html`, `app.js`: existing Super Admin dashboard and runtime
- `public-site/`: public NEXORA pages and job listings
- `candidate-portal/`: candidate account, profile and document workflows
- `consultancy-portal/`: authorised candidate discovery and matching
- `company-portal/`: employer workspace and vacancy management
- `super-admin/`: reserved for a future dedicated admin route; production entry remains at repository root for now
- `js/`: shared Supabase browser configuration and portal helpers
- `assets/`: shared image, icon and font assets
- `supabase/migrations/`: versioned schema and policy changes
- `supabase/functions/`: trusted server-side functions
- `docs/`: architecture and deployment checklists

## Important implementation notes
- The root Super Admin runtime has been restored separately from the portal runtime. `portal.js` is for public/candidate/consultancy/company pages; `app.js` is for the root Super Admin dashboard.
- `js/platform-operations.js` adds browser-only convenience controls. Module preferences and announcement drafts in that helper are local to the browser; they do not publish announcements or change database entitlements.
- The browser configuration contains only the Supabase public anon key. Never add a service-role key or database password to browser files.
- The Supabase migrations are newly versioned repository sources and have **not** been verified or applied as part of the GitHub change. Review them in a development Supabase project first and test all RLS policies before production.
- Candidate CVs and identity documents must remain in private storage and must not be shared without explicit consent.
- This is a foundation, not a complete production HR/payroll system. Payments, payroll, attendance, leave, full tenant lifecycle, notifications, privacy/legal review, backups and security testing require further implementation.

## Development workflow
1. Make changes on a feature branch.
2. Review changed files and script paths.
3. Test login, logout, portal navigation, RLS and privacy controls.
4. Merge to `main` only after review.
5. Verify the deployed GitHub Pages URLs after Actions completes.

See [repository structure](docs/REPOSITORY-STRUCTURE.md) and [deployment checklist](docs/DEPLOYMENT-CHECKLIST.md).
