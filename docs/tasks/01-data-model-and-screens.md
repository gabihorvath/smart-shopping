# Task 1: Data model and screen layouts

## Context
Read `docs/concept.md` first. It is the source of truth. `docs/draft.md` is the original draft and is superseded.

## Goal
Extend `docs/concept.md` (or add `docs/design.md` linked from it) with:
1. **Data model**: TypeScript types for Unit, Aisle, CatalogItem, ListEntry, Shop (ordered aisle subset), and app settings (last used shop). Include ids, how amounts are stored (decimal), and the storage layout in browser storage (IndexedDB vs localStorage: recommend one and say why).
2. **Derived view logic**: how the list is computed for the active shop (open items by aisle order, skipped-aisle section, done section), including sorting rules.
3. **Rules**: duplicate-add prompt, blocked deletion of items in use, new aisle skipped in all shops, seed data and default shop on first start.
4. **Screens** (mobile first, German UI): main list, add-item flow, shop selector and shop editor (drag order, include/skip aisles), catalog management (items, units, aisles). Use simple ASCII wireframes plus a short description of each interaction.

## Rules for the session
- Don't assume. Ask the user whenever something is unclear.
- No code yet, only design in markdown.
- Stack is fixed: Vue 3, TypeScript, Tailwind, Vite, browser storage, PWA.

## Done when
The user has reviewed and approved the data model and screens.
