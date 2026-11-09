# Smart shopping list: concept

## Goal
A private, single-user web app for exactly one shopping list, used mainly on a phone in the store. The UI is in German.

## Stack
- Vue 3 + TypeScript + Vite + Tailwind CSS
- Browser storage (IndexedDB or localStorage), with no backend
- PWA (service worker, installable, offline-capable), hosted on HTTPS
- Drag-and-drop for aisle ordering: touch-friendly library (e.g. SortableJS via vue-draggable-plus)

## Concepts
- **Unit**: German unit, e.g. Stk, kg, g, l, ml, Pkg. The user can add their own.
- **Aisle**: global, e.g. Obst & Gemüse, Milchprodukte. The user can add their own.
- **Catalog item**: name, unit, aisle. The app ships a seed set, and the user can add more.
- **List entry**: catalog item + amount (decimal, integer also allowed) + state (open / checked).
- **Shop**: name + ordered subset of aisles. A shop may skip aisles.
- There is exactly one list. Multiple lists are never needed.

## Behaviour

### Adding
- Pick an item from the catalog and enter an amount (in the item's unit).
- If the item is already on the list, ask "Add to the existing amount?"
  - Yes: the amounts are added together.
  - No: cancel the add.
- After a successful add, a short snackbar confirms it ("„X“ ist auf der Liste ✓"); the add sheet stays open for the next item.

### List view (for the active shop)
Sections, from top to bottom:
1. **Open items**, grouped by aisle in the active shop's aisle order, items alphabetical within an aisle.
2. **Aisles not in this shop**: open items whose aisle the shop skips. Shown dimmed in their own section, grouped by aisle, with full check/remove actions.
3. **Done**: checked items, dimmed, foldable, grouped by aisle in the active shop's order.

If the list is empty, a friendly empty state is shown ("Deine Liste ist leer"). If everything is checked off, "Alles erledigt! 🎉" is shown above the Done section.

### Item actions
- **Check**: marks the item done, dimmed, and moves it to the Done section. Can be undone (restore).
- **Remove**: deletes the entry from the list completely.
- **Done section: clear**: removes all checked items in one click.
- Unchecked items cannot be removed in bulk.

### Shops
- Create, rename and delete shops.
- Per shop, drag aisles into the desired order and choose which aisles are included.
- A new aisle is skipped in every shop until the user adds it to a shop.
- A selector shows the active shop and can be switched at any time. This only changes the view.
- The app remembers the last used shop.

### Catalog management
- Add and edit items, units and aisles.
- Deleting a unit, aisle or item that is still in use is blocked with a message.

## Out of scope
Multi-user, sync, multiple lists, i18n, dark mode, export/share, and any extras beyond the above.

## Decisions
- No backup or export. Data lives only in the phone's browser storage.
- No separate "clear whole list" button. The Done section's clear button is enough.
- Hosting: GitHub Pages (static, HTTPS), built and deployed with GitHub Actions. Vite `base` and the PWA manifest use the repo sub-path.

## Seed data (proposal, to be edited)

The table below is only a **sample** of the seed: the original core set. The real, extensive seed data (about 800 items in the same units and aisles) lives in `src/domain/seed.ts`. Edit it there, not here.

Units: Stk, g, kg, ml, l, Pkg, Dose, Glas, Flasche, Bund, Beutel.

| Aisle | Items (unit) |
|---|---|
| Obst & Gemüse | Äpfel (kg), Bananen (kg), Zitronen (Stk), Tomaten (kg), Gurke (Stk), Paprika (Stk), Zwiebeln (kg), Kartoffeln (kg), Karotten (kg), Salat (Stk), Knoblauch (Stk) |
| Brot & Backwaren | Brot (Stk), Brötchen (Stk), Toast (Pkg) |
| Milchprodukte & Eier | Milch (l), Butter (Stk), Joghurt (g), Käse (g), Eier (Pkg), Sahne (ml), Quark (g) |
| Fleisch & Fisch | Hähnchenbrust (g), Hackfleisch (g), Wurst (g), Schinken (g), Lachs (g) |
| Tiefkühl | Tiefkühlgemüse (Pkg), Pizza (Stk), Eis (Pkg) |
| Nudeln, Reis & Konserven | Nudeln (g), Reis (g), Tomaten passiert (Dose), Mais (Dose), Bohnen (Dose), Mehl (kg), Zucker (kg) |
| Frühstück & Aufstrich | Müsli (Pkg), Marmelade (Glas), Honig (Glas), Nutella (Glas) |
| Gewürze & Öle | Salz (Pkg), Pfeffer (Stk), Olivenöl (Flasche), Essig (Flasche) |
| Snacks & Süßes | Schokolade (Stk), Chips (Beutel), Kekse (Pkg) |
| Getränke | Wasser (Flasche), Saft (l), Bier (Flasche), Kaffee (Pkg), Tee (Pkg) |
| Drogerie & Haushalt | Toilettenpapier (Pkg), Küchenrolle (Pkg), Spülmittel (Flasche), Zahnpasta (Stk), Duschgel (Flasche), Müllbeutel (Pkg) |

A default shop is created with all aisles in the order above, so the app is usable on first start.

- The sample set and default shop above are accepted as the starting point; the full seed in `src/domain/seed.ts` extends the sample.
- The GitHub repo is public (free plan). Code and seed data are visible, the user's list data stays on the phone.

## Design
Data model, derived view logic, rules and screens: see [design.md](design.md).

## Open points
None. The concept is complete.
