# NEXORA — Human Resources & Workforce Management

**Brand:** NEXORA  
**Tagline:** Intelligence for Every Workforce

NEXORA is being developed as a multi-workspace HR and recruitment platform. This repository currently hosts the GitHub Pages Super Admin entry point and shared portal JavaScript. The structure is being expanded carefully so public marketing pages, jobs, candidate tools, consultancy workflows, employer workspaces and platform administration can grow without being mixed together.

## Live deployment

- GitHub Pages base URL: https://nexoradot.github.io/hrm/
- Production branch: `main`
- Default branch: `main`

## Current repository status

The current `main` branch contains a small set of root-level files. Before moving or renaming runtime files, we must first verify their script references and test the existing Super Admin login. See [Repository structure and migration plan](docs/REPOSITORY-STRUCTURE.md).

## Planned application areas

| Area | Responsibility |
|---|---|
| `public-site/` | NEXORA marketing pages, services, pricing and public jobs marketplace |
| `candidate-portal/` | Candidate profiles, CV/document management and applications |
| `consultancy-portal/` | Candidate review, consent-based matching and placement workflows |
| `company-portal/` | Employer workspace, vacancies and recruitment pipeline |
| `super-admin/` | Platform-wide organisations, access, plans, modules and audit operations |
| `assets/` | Shared brand assets, images, icons and fonts |
| `js/` | Shared browser utilities and portal-specific JavaScript |
| `supabase/` | Database migrations, Edge Functions and backend documentation |
| `docs/` | Architecture, deployment and operational notes |

These directories are being introduced as a migration plan; their presence does not imply every portal feature is already implemented.

## Development principles

1. Keep the current live entry point working while changes are prepared on feature branches.
2. Use small pull requests and review the changed-file list before merging to `main`.
3. Keep CSS inline in each HTML page where appropriate, while using separate JavaScript files for application logic.
4. JavaScript must be deployed with a browser-executable `.js` extension. A `.js.txt` copy is source/reference material only unless renamed during deployment.
5. Never put Supabase service-role keys, database passwords or other server secrets in browser code.
6. Enforce permissions with Supabase Row Level Security and trusted server-side functions; hiding a UI element is not access control.
7. Candidate CVs and personal documents must remain private unless the candidate has granted the required sharing consent.
8. Use relative links that work under the GitHub Pages base path `/hrm/`.

## Deployment caution

Do not merge a structure-only change as a replacement for working application code. Runtime files should only be moved after all references, authentication and the live deployment have been tested.
