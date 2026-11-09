# Smart shopping list: design (Task 1)

Extends [concept.md](concept.md), which stays the source of truth for behaviour. This file adds the data model, derived view logic, rules and screens. UI strings are German, this document is English.

Decisions made in the Task 1 session:
- Re-adding an item that is checked **reopens** that entry with the newly entered amount (the old amount is replaced).
- The last remaining shop cannot be deleted.
- Add flow: search field + amount sheet, with inline "new item".
- Amount input: decimal field plus +/- buttons with a per-unit step.

Decisions made in the implementation kickoff (2026-11-09), these override anything below:
- **Erledigt** is grouped by aisle (shop order, then skipped aisles by `sortKey`), items A–Z inside each aisle. `checkedAt` is stored but not used for ordering.
- **Remove an open item**: both swipe left and an "x" button. Swipe must not break vertical scrolling.
- **Dialogs** (confirmations, duplicate-add prompt, blocked-deletion messages): custom Tailwind modals/sheets, never native `confirm()`/`alert()`/`prompt()`.
- **Undo snackbars stack**: every removal gets its own snackbar with "Rückgängig", each visible for the full 5 s independently. Each removal becomes final when its own snackbar expires.
- **Search** strips diacritics and ignores case ("apfel" finds "Äpfel"), contains-match. No "ae" → "ä" mapping.
- **Add flow, empty search**: the shop's aisles in shop order, then skipped aisles dimmed (by `sortKey`), items A–Z within each aisle.
- **Inline name inputs** for "Neuer Laden" and the "Neu…" unit/aisle options (no modal prompt).
- **Amount of a checked entry**: tapping it opens the amount sheet; saving reopens the entry with the new amount.
- **Invalid amounts** (empty, unparsable, <= 0, below the unit's step): field marked red, the confirm button is disabled. No silent clamping.
- **Navigation**: no router; a view state in the store switches between list, shops and catalog.
- **Shop editor back**: returns to where the editor was opened from (selector sheet → main list; Menü → Läden → shop list).
- **Tests**: Playwright E2E runs locally only, not in the deploy workflow. Vitest for store/logic (IndexedDB via `fake-indexeddb`) plus component tests; Playwright E2E for the main flows.

---

## 1. Data model

```ts
type Id = string // crypto.randomUUID()

interface Unit {
  id: Id
  name: string        // "kg", "Stk", ... unique (case-insensitive)
  step: number        // +/- button step, e.g. 1, 0.5, 100
}

interface Aisle {
  id: Id
  name: string        // unique (case-insensitive)
  sortKey: number     // global order, used for the catalog and the "no shop" fallback; new aisles get max + 1
}

interface CatalogItem {
  id: Id
  name: string        // unique (case-insensitive)
  unitId: Id          // -> Unit
  aisleId: Id         // -> Aisle
}

interface ListEntry {
  id: Id
  itemId: Id          // -> CatalogItem; at most ONE entry per item (unique)
  amount: number      // decimal, > 0, stored as plain JS number (see below)
  checked: boolean
  checkedAt: number | null // epoch ms, only for display order inside Done
}

interface Shop {
  id: Id
  name: string        // unique (case-insensitive)
  aisleIds: Id[]      // ordered subset of aisles; aisles not listed are "skipped"
}

interface Settings {
  lastShopId: Id | null
  seeded: boolean     // seed data was applied
  schemaVersion: number
}
```

**Amounts.** Stored as a JS `number`, rounded to 3 decimals on input (`Math.round(x * 1000) / 1000`) to avoid float noise such as 0.1 + 0.2. Entered with a decimal comma, displayed with `Intl.NumberFormat('de-DE')` (`1,5 kg`, `2 Stk`, no trailing zeros). Steps per unit: Stk, Pkg, Dose, Glas, Flasche, Bund, Beutel = 1; kg, l = 0,5; g, ml = 100. Units added by the user default to step 1 and the step is editable. Minimum amount is the step; "-" cannot go below that.

**Ids.** UUID strings, so references stay valid when names change.

**Referential integrity.** The app enforces it (see rules), the storage does not.

### Storage: IndexedDB (recommended)

Recommendation: **IndexedDB**, one object store per collection (`units`, `aisles`, `items`, `entries`, `shops`, `settings`), through a small wrapper such as `idb`.

Why:
- Several related collections with lookups by id and a unique `itemId` index on `entries`. This maps directly to object stores and avoids rewriting one large JSON blob on every check.
- Asynchronous and transactional: a multi-record change (e.g. seed, delete shop and fix `lastShopId`, clear Done) is atomic.
- Higher quota than localStorage's ~5 MB, and not blocking the main thread.
- Works offline and in PWA mode on Android and iOS.

Why not localStorage: simpler, but synchronous, string-only, no transactions, and one JSON blob has to be re-serialised on every tap. Fine for this data size, but IndexedDB costs little extra here.

How it is used: on start, all stores are loaded into reactive in-memory state (Vue `reactive`/Pinia). Mutations update memory first, then write through to IndexedDB in one transaction. Views only read memory.

Persistence: call `navigator.storage.persist()` after first start to reduce the chance of the browser evicting data. Since there is no backup (concept decision), this is the only protection. Browsers may still clear data if the user wipes site data, and iOS Safari can evict data of non-installed sites after ~7 days without use. Installing the PWA to the home screen avoids that.

Migrations: `schemaVersion` in `settings` plus the IndexedDB version number. Keep it for later, nothing to migrate in v1.

---

## 2. Derived view logic

Input: the active shop `S`, all entries, items, aisles. Nothing derived is stored.

For each entry, resolve `item = items[entry.itemId]` and `aisle = aisles[item.aisleId]`.

1. **Open items** (`checked == false`, `aisle ∈ S.aisleIds`)
   - Group by aisle, groups ordered by index in `S.aisleIds`.
   - Within a group: item name ascending, `localeCompare(..., 'de', { sensitivity: 'base' })` (so Ä sorts with A, case ignored).
2. **Aisles not in this shop** (`checked == false`, `aisle ∉ S.aisleIds`)
   - Own section "Nicht in diesem Laden", dimmed.
   - Groups ordered by the global `Aisle.sortKey`, items by name as above.
   - Full check/remove actions.
3. **Done** (`checked == true`, any aisle)
   - Dimmed, foldable (collapsed by default, with the count in the header).
   - Grouped by aisle in `S.aisleIds` order; aisles not in `S` come after, by `sortKey`.
   - Within a group: item name ascending.

Empty sections and empty groups are not rendered. If everything is empty, show "Die Liste ist leer".

Changing the active shop recomputes the view only. Entries are never changed by it.

---

## 3. Rules

### Add
- One entry per item. Adding item `X` with amount `a`:
  - no entry for `X`: create `{ itemId: X, amount: a, checked: false }`.
  - open entry exists: ask **"X ist schon auf der Liste (aktuell 2 kg). Menge addieren?"** Yes: `amount += a`. No: cancel, the sheet stays open so the user can correct the amount.
  - checked entry exists: no question. Reopen it: `checked = false`, `checkedAt = null`, `amount = a` (replaces the old amount).

### Check / remove / clear
- Check: `checked = true`, `checkedAt = now`. Undo: tap again in Done (`checked = false`), amount is kept.
- Remove: deletes the entry (confirm only through a short undo snackbar, no dialog).
- Done: "Erledigte entfernen" deletes all checked entries, after a confirmation. Open items are never removed in bulk.

### Blocked deletion
- **Item** in use if any entry (open or checked) references it. Message: "Artikel ist noch auf der Liste." Remove the entry first.
- **Unit** in use if any catalog item references it. Message: "Einheit wird noch von N Artikeln verwendet."
- **Aisle** in use if any catalog item references it. Message: "Gang wird noch von N Artikeln verwendet." Shops that include the aisle do not block it, the aisle is removed from their `aisleIds`.
- **Shop**: deletable unless it is the last one ("Mindestens ein Laden muss bleiben"). If it was `lastShopId`, switch to the first remaining shop.

### Names
- Names are trimmed and must be non-empty and unique (case-insensitive) within their type. Message: "Name existiert schon."

### New aisle
- Gets the next `sortKey`, is **not** added to any shop's `aisleIds`. It appears in the "Nicht in diesem Laden" section for open items until the user adds it to a shop.
- Editing item unit or aisle changes existing entries' display immediately (they reference the item). Changing an item's unit keeps the amount number as is.

### Seed and first start
- On first start (`settings.seeded == false`) in one transaction: create the units, aisles (in the concept's order, `sortKey` 1..11), catalog items from the concept's seed table, and a default shop "Standard" containing all aisles in that order. Set `lastShopId` to it, `seeded = true`.
- Seed is applied once. Items the user deletes do not come back.

### Active shop
- On start use `lastShopId`; if missing or invalid, use the first shop. Switching the shop writes `lastShopId`.

---

## 4. Screens (mobile first)

Layout assumptions: one column, bottom-reachable primary actions, touch targets >= 44 px, safe-area padding for the installed PWA. Navigation is a simple header with a menu; no tab bar.

### 4.1 Main list

```
+--------------------------------+
| [ Standard            v ]  [≡] |  <- shop selector, menu
+--------------------------------+
| OBST & GEMÜSE                  |
| ( ) Äpfel               1,5 kg |
| ( ) Bananen               1 kg |
| MILCHPRODUKTE & EIER           |
| ( ) Butter               2 Stk |
|                                |
| NICHT IN DIESEM LADEN          |  <- dimmed
|  GEWÜRZE & ÖLE                 |
| ( ) Salz                 1 Pkg |
|                                |
| v ERLEDIGT (3)  [Entfernen]    |  <- foldable
|  (x) Milch               2 l   |  <- dimmed
|                                |
|                          ( + ) |  <- FAB
+--------------------------------+
```

Interactions:
- Tap the circle / row: check (moves to Erledigt). In Erledigt, tap the filled circle: reopen.
- Swipe left or "x" on an open row: remove, with a short undo snackbar ("Entfernt. Rückgängig").
- Tap the shop selector: opens the shop selector sheet (4.3).
- "Entfernen" in the Erledigt header: confirm dialog "N erledigte Artikel entfernen?", then deletes all checked entries.
- Tap the amount: opens the amount sheet to correct it (same sheet as in 4.2, without the search).
- FAB "+": opens the add flow.
- Menu (≡): "Läden", "Katalog".

### 4.2 Add-item flow

```
+--------------------------------+      +--------------------------------+
| [x]  Artikel hinzufügen        |      | Äpfel                     [x]  |
| [ Suche…                     ] |  ->  | Obst & Gemüse                  |
|                                |      |                                |
| Äpfel         Obst & Gemüse    |      |     [ - ]   1,5 kg   [ + ]     |
| Ananas        Obst & Gemüse    |      |     (number field, comma)      |
| ...                            |      |                                |
| + „Aprikose“ neu anlegen       |      |  [   Hinzufügen   ]            |
+--------------------------------+      +--------------------------------+
```

Interactions:
- Search filters the catalog live (case/umlaut-insensitive, contains). Empty search shows the whole catalog grouped by aisle in the active shop's order.
- Tap a result: amount sheet. Number field with decimal keyboard, default = one step (e.g. 1 or 0,5 kg, 100 g), +/- change by the unit's step. Item name, aisle and unit shown above.
- "Hinzufügen": applies the add rule from section 3 (duplicate prompt for open entries, reopen for checked). The sheet closes, the list shows the new row briefly highlighted.
- "+ „…“ neu anlegen" (shown when no exact match): mini form with name (prefilled), unit select, aisle select, then continues to the amount sheet. Both selects offer "Neu…" to create a unit or aisle inline.
- After adding, the search screen stays open with an empty search so several items can be added in a row. Close with [x].

### 4.3 Shop selector and shop editor

Selector (bottom sheet from the list header):

```
+--------------------------------+
| Laden wählen                   |
| (o) Standard                   |
| ( ) Rewe                  [✎]  |
| ( ) Aldi                  [✎]  |
| [ + Neuer Laden ]              |
+--------------------------------+
```
- Tap a row: sets the active shop, closes the sheet.
- ✎: opens the shop editor. "Neuer Laden": asks for a name, copies the current shop's aisle order as a starting point, opens the editor.

Editor:

```
+--------------------------------+
| <  Rewe                [Löschen]|
| Name: [ Rewe               ]   |
|                                |
| IM LADEN (Reihenfolge)         |
| [≡] Obst & Gemüse        [✓]   |
| [≡] Brot & Backwaren     [✓]   |
| [≡] Getränke             [✓]   |
|                                |
| NICHT IM LADEN                 |
|     Tiefkühl             [ ]   |
|     Fleisch & Fisch      [ ]   |
+--------------------------------+
```
- Drag the handle [≡] (SortableJS via vue-draggable-plus, touch drag by handle only so scrolling still works) to reorder the included aisles. Saved immediately.
- The checkbox moves an aisle between the two groups. An aisle that is included goes to the end of the order list; one that is excluded moves to the lower group.
- Rename in the name field (validated for uniqueness).
- "Löschen": confirm dialog; blocked for the last shop.

### 4.4 Catalog management

Menu -> "Katalog": three tabs at the top: **Artikel | Einheiten | Gänge**.

```
+--------------------------------+
| <  Katalog                     |
| [Artikel][Einheiten][Gänge]    |
| [ Suche…                     ] |
| OBST & GEMÜSE                  |
|  Äpfel                  kg [✎] |
|  Bananen                kg [✎] |
| ...                            |
|                          ( + ) |
+--------------------------------+
```

- **Artikel**: grouped by aisle (global order), searchable. "+": form with name, unit select, aisle select. ✎: same form, plus "Löschen" (blocked if on the list).
- **Einheiten**: list of units with their step value. "+": name + step. ✎: edit name/step, "Löschen" (blocked if in use, with the count).
- **Gänge**: list in global order with the item count. "+": name. ✎: rename, "Löschen" (blocked if in use). The global order (`sortKey`) is changed by drag handle here; this affects only the "Nicht in diesem Laden" section and the catalog view, not any shop's own order.
- Blocked deletion shows a message dialog with the reason (section 3), no state change.
