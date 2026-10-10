# NEXORA deployment checklist

Use this checklist for each change before merging to `main`.

## Before changes

- [ ] Confirm the current production URL loads.
- [ ] Confirm Super Admin sign-in and sign-out still work.
- [ ] Create a feature branch.
- [ ] Record the current main commit SHA.
- [ ] Identify every HTML file that references the scripts or assets being changed.

## Before merging

- [ ] Review the complete changed-file list.
- [ ] Check all relative links under the `/hrm/` GitHub Pages base path.
- [ ] Confirm script filenames and paths exist with the same letter casing.
- [ ] Confirm there are no JavaScript console errors or failed network requests.
- [ ] Test sign-in, sign-out, session persistence and expired-session behavior.
- [ ] Test the affected Supabase reads/writes with Row Level Security enabled.
- [ ] Confirm candidate documents are not publicly accessible without authorization.
- [ ] Confirm the root Super Admin entry point has not been unintentionally replaced.
- [ ] Verify mobile and desktop layouts for changed pages.

## After deployment

- [ ] Open each changed published URL directly in a fresh browser tab.
- [ ] Test refresh/deep-link behavior.
- [ ] Test the browser console and network panel.
- [ ] Confirm Supabase records were created/updated only as intended.
- [ ] Keep a record of the deployed commit SHA and rollback commit.

## GitHub Pages note

The project is served from a repository subpath, `/hrm/`, rather than the domain root. Avoid absolute links such as `/assets/app.js` unless they are intentionally configured for that root. Prefer paths that are correct relative to each page or define a single, tested base-path strategy.
