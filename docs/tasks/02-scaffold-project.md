# Task 2: Scaffold the project

## Context
Read `docs/concept.md` first. It is the source of truth. If `docs/design.md` or an extended concept from Task 1 exists, read it too. This task does not depend on Task 1.

## Goal
Set up an empty but working project in `C:\Dev\Web\shopping`:
1. Vite + Vue 3 + TypeScript, with Tailwind CSS.
2. PWA: web app manifest and service worker (e.g. `vite-plugin-pwa`), installable and offline-capable, German app name, simple placeholder icons.
3. Vite `base` and the manifest set for GitHub Pages under the repo sub-path (ask the user for the repo name).
4. GitHub Actions workflow that builds and deploys to GitHub Pages on every push to the main branch.
5. A placeholder home page that confirms the setup works (no app features).
6. A short README with dev, build and deploy commands.

## Rules for the session
- Don't assume. Ask the user whenever something is unclear (repo name, package manager, linting/formatting tools, test setup).
- The folder is not a git repository yet. Ask before running `git init` or creating a GitHub repo.
- Don't implement app features. That comes after design approval.
- Verify that `build` works and that the dev server starts.

## Done when
`npm run build` succeeds, the dev server runs, and the Pages workflow file is in place and reviewed by the user.
