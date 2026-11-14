# Task 3: share the open list as a link, import it on another phone

Self-contained brief. Behaviour: `docs/concept.md` ("Sharing the list"). Rules, payload, prompts: `docs/design.md` section 3 ("Share and import"). Ask the user instead of assuming on any spec gap.

## Goal
Menu "Liste teilen" builds a link with the open entries; opening it on another device shows a preview and imports after confirmation. No backend: the data lives in the URL fragment (`#import=<base64url JSON>`).

## Scope
- `src/domain/share.ts`: payload encode/decode with strict validation, `buildShareUrl`, hash parsing, `planImport` (ready / unitClash / unknown), `resolveNewItem`.
- `src/stores/app.ts`: `shareItems()` (open entries as names), `importEntry(itemId, amount, 'add' | 'keep')`.
- `src/composables/useDialog.ts` + `DialogHost.vue`: multi-button `choice` dialog.
- `src/composables/useShare.ts`: `shareList` (Web Share, clipboard fallback), `captureImportHash` (clears the hash first), `runImport` (known items first, then one prompt per unit clash / unknown item, Abbrechen stops).
- `src/components/ImportSheet.vue`: preview, add / keep choice (only when something is already open), Importieren / Abbrechen. Mounted in `App.vue`; "Liste teilen" in the `ListScreen` menu.
- Tests: `domain/share.test.ts`, `composables/useShare.test.ts`.
- Docs: `docs/user-guide.md` section.

## Out of scope
Fuzzy name matching, creating units or aisles on import, iOS support, sharing checked items, any backup/export.

## Done when
`npm run lint`, `npm test` and `npm run build` pass; the manual check below works on two browser profiles or devices.

## Manual check
1. Phone A: add items (one checked), Menü → Liste teilen, copy the link.
2. Phone B (Android Chrome): open the link; preview lists only the open items; nothing changes until Importieren; reload does not import again.
3. Known item already open on B: add / keep choice applies. Unknown item and unit clash: one prompt each.
4. Edit the link payload: "Link ungültig.".
