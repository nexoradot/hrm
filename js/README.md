# Shared JavaScript

This folder is reserved for shared browser utilities and clearly named portal scripts.

Before moving existing scripts here:
1. Search every HTML file for references to `app.js` and `portal.js`.
2. Confirm whether the two files are duplicates and identify the canonical runtime.
3. Verify the root `index.html` reference to `js/platform-operations.js`; that path was not present in the audited main-branch tree.
4. Update references and test the production login before removing any root-level file.

Files delivered as `.js.txt` must be renamed to `.js` before normal browser execution.
