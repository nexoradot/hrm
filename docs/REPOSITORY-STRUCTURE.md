# NEXORA repository structure and migration plan

## 1. Current baseline audit

At the time this plan was prepared, the `main` branch tree contains:

- `index.html`
- `app.js`
- `portal.js`
- `README.md`

Observed issues to resolve before a code move:

- `app.js` and `portal.js` currently have the same Git blob SHA and the same portal-oriented source content. This appears to be duplicate code; do not delete either file until HTML references and live behavior have been verified.
- The root `index.html` references `js/platform-operations.js`, but that path is not present in the current `main` tree. Verify whether the dashboard has an inline fallback or is missing functionality before changing script references.
- The root `index.html` is titled “NEXORA | Super Admin Control Centre”; preserve it as the current production entry point during the first phase.
- The current repository has no dedicated folders for the public site, candidate portal, consultancy portal, company portal, assets, docs or Supabase backend.

This document is a plan and audit snapshot, not a claim that the planned folders contain finished portal implementations.

## 2. Target layout

```text
hrm/
├── index.html                 # Existing production Super Admin entry; keep stable initially
├── app.js                     # Existing runtime; inspect before renaming
├── portal.js                  # Existing runtime; deduplicate only after verification
├── README.md
├── public-site/
│   ├── README.md
│   ├── index.html              # Public marketing homepage (future implementation)
│   ├── about.html
│   ├── services.html
│   ├── pricing.html
│   ├── contact.html
│   └── jobs/
│       ├── index.html
│       └── details.html
├── candidate-portal/
│   └── README.md
├── consultancy-portal/
│   └── README.md
├── company-portal/
│   └── README.md
├── super-admin/
│   └── README.md
├── assets/
│   └── README.md
├── js/
│   └── README.md
├── supabase/
│   └── README.md
└── docs/
    ├── REPOSITORY-STRUCTURE.md
    └── DEPLOYMENT-CHECKLIST.md
```

The initial scaffolding uses README files to make each planned folder visible in Git. Actual pages should be added after their routes, authentication rules and shared dependencies are defined.

## 3. Recommended route map

Keep the current root URL working during migration:

- Current Super Admin: `/hrm/`
- Public site: `/hrm/public-site/`
- Jobs marketplace: `/hrm/public-site/jobs/`
- Candidate portal: `/hrm/candidate-portal/`
- Consultancy portal: `/hrm/consultancy-portal/`
- Company portal: `/hrm/company-portal/`
- Future dedicated Super Admin route: `/hrm/super-admin/`

A future routing change may make `/hrm/` the public homepage, but only after a tested redirect or a deliberate migration of the existing Super Admin entry point. Do not silently replace the current root page.

## 4. Shared code boundaries

- `assets/`: logos, images, icons and fonts only.
- `js/`: common helpers such as authentication/session handling, navigation, validation and UI utilities.
- Portal-specific scripts should be clearly named and loaded only by pages that need them.
- Keep HTML and inline CSS page-local if that remains the project convention.
- Avoid loading the same large portal script twice under two different filenames.
- Use relative asset paths that work when hosted beneath `/hrm/`.

## 5. Suggested migration sequence

1. Preserve the existing `main` branch and verify current production login.
2. Add documentation and directory scaffolding on a feature branch.
3. Inspect all script and stylesheet references; verify the missing `js/platform-operations.js` path.
4. Decide whether `app.js` or `portal.js` is the canonical portal runtime; remove duplication only in a separately tested change.
5. Build the public homepage and shared navigation without changing the production root route.
6. Add one portal at a time, starting with a working smoke test for each route.
7. Validate Supabase RLS, authentication, candidate document privacy and employer data isolation.
8. Test the published GitHub Pages URLs and review the pull request before merging.

## 6. Security and privacy

- Public browser configuration must never contain a service-role key or database password.
- Database access must be protected by correct Row Level Security policies.
- Admin-only actions requiring privileged access must use a trusted server-side function.
- Private candidate documents must use private storage and explicit consent-based sharing.
- Never commit credentials, access tokens, private CVs or production data.
