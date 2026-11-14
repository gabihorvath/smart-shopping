# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

App implemented (phases A-E): list, shops, catalog, PWA/offline, polish. Local git repo; GitHub repo name is `smart-shopping` (Vite `base` and manifest scope are `/smart-shopping/`, set in `vite.config.ts`). npm; Pinia, `idb`, `vue-draggable-plus`, ESLint + Prettier, Vitest (jsdom, `fake-indexeddb`) and Playwright are installed.

Commands: `npm run dev`, `npm run build` (vue-tsc + vite build), `npm run lint`, `npm run format`, `npm test` (vitest run; single file: `npx vitest run src/App.test.ts`), `npm run test:e2e` (Playwright against a built preview; local only, not in CI; includes an offline/service-worker project). Deploy workflow: `.github/workflows/deploy.yml` (lint, test, build, Pages).

Layout: `src/domain` (types, pure view/amount/text logic, seed), `src/db` (idb access), `src/stores` (Pinia app store), `src/components` (screens and sheets), `src/components/ui` (shared widgets), `src/composables` (dialogs, snackbars, tab state), `e2e` (Playwright specs).

- `docs/concept.md` is the **source of truth for behaviour**.
- `docs/design.md` extends it with the data model, derived view logic, rules and wireframes.
- `docs/tasks/*.md` are self-contained session briefs (01 = design, 02 = scaffold). Task 2 does not depend on Task 1. Both say: ask the user instead of assuming (e.g. repo name, package manager, lint/test tooling), and ask before `git init` or creating a GitHub repo. Task 1 is design-only (no code). Task 2 must not implement app features.
- `docs/draft.md` is referenced by task 1 as superseded but does not exist.

## What it is

A private, single-user, single-list shopping app, used mainly on a phone in the store. **UI strings are German; docs and code are English.** Out of scope: multi-user, sync, multiple lists, i18n, dark mode, export/backup, and any extras. The one sharing feature is "Liste teilen": a link carrying the open items (URL fragment), imported by the receiver after a preview (see concept.md, design.md section 3).

Stack (fixed): Vue 3 + TypeScript + Vite + Tailwind, PWA (installable, offline), no backend. Hosted on GitHub Pages (public repo) via GitHub Actions on push to main, so Vite `base` and the PWA manifest must use the repo sub-path. Drag-and-drop via SortableJS / `vue-draggable-plus` (handle-only drag so touch scrolling still works).

## Architecture (from design.md)

- **Storage**: IndexedDB (via `idb`), one object store per collection (`units`, `aisles`, `items`, `entries`, `shops`, `settings`), unique `itemId` index on `entries`. All stores load into reactive in-memory state (Vue reactive/Pinia) at start; mutations update memory first, then write through in a single transaction. Views read memory only. Call `navigator.storage.persist()` after first start. Referential integrity is enforced by the app, not the storage. Ids are `crypto.randomUUID()` strings.
- **Nothing derived is stored.** The list view is computed from the active shop + entries/items/aisles: (1) open items in the shop's aisles, grouped in `Shop.aisleIds` order; (2) open items in aisles the shop skips, in a dimmed "Nicht in diesem Laden" section ordered by global `Aisle.sortKey`; (3) checked items in a collapsed, dimmed "Erledigt" section. Item names sort with `localeCompare(..., 'de', { sensitivity: 'base' })`. Switching shops only changes the view.
- **Amounts** are plain JS numbers rounded to 3 decimals on input (`Math.round(x*1000)/1000`); entered with decimal comma, displayed via `Intl.NumberFormat('de-DE')`. Each `Unit` has a `step` for the +/- buttons (min amount = step).
- **One entry per catalog item.** Adding an item already open on the list prompts to add amounts (No = cancel, sheet stays open); adding one that is checked silently reopens it and *replaces* the amount.
- **Deletion rules**: items on the list, and units/aisles referenced by catalog items, cannot be deleted (German message with count). Deleting an aisle only strips it from shops' `aisleIds`. The last remaining shop cannot be deleted; deleting the `lastShopId` shop switches to the first remaining one.
- **Names** are trimmed, non-empty, and case-insensitively unique per type ("Name existiert schon.").
- **New aisles** get `sortKey = max + 1` and are in no shop's `aisleIds` until the user adds them.
- **First start** (`settings.seeded == false`): one transaction seeds units, 11 aisles (sortKey 1..11), catalog items from the table in `concept.md`, and a default shop "Standard" with all aisles in order. Seed is applied once; deleted items do not return.
- **Mobile-first UI**: one column, touch targets >= 44 px, safe-area padding, bottom sheets for add/amount/shop selector, FAB "+" for add, header menu (Läden, Katalog) instead of a tab bar. Remove uses an undo snackbar (no dialog); "Erledigte entfernen" asks for confirmation.
