import { compareNames, foldForSearch } from './text'
import type { Aisle, CatalogItem, ListEntry, Shop, Unit } from './types'

export interface ListRow {
  entry: ListEntry
  item: CatalogItem
  unit: Unit
}
export interface AisleGroup {
  aisle: Aisle
  rows: ListRow[]
}
export interface ListView {
  open: AisleGroup[]
  notInShop: AisleGroup[]
  done: AisleGroup[]
}

export interface CatalogGroup {
  aisle: Aisle
  items: CatalogItem[]
}
export interface CatalogForAdd {
  inShop: CatalogGroup[]
  notInShop: CatalogGroup[]
}

const bySortKey = (a: Aisle, b: Aisle) => a.sortKey - b.sortKey

/** Shop aisles in shop order (unknown ids dropped), then remaining aisles by sortKey. */
function orderedAisles(shop: Shop, aisles: Aisle[]): { inShop: Aisle[]; rest: Aisle[] } {
  const byId = new Map(aisles.map((a) => [a.id, a]))
  const inShop: Aisle[] = []
  const seen = new Set<string>()
  for (const id of shop.aisleIds) {
    const a = byId.get(id)
    if (a && !seen.has(id)) {
      inShop.push(a)
      seen.add(id)
    }
  }
  const rest = aisles.filter((a) => !seen.has(a.id)).sort(bySortKey)
  return { inShop, rest }
}

function groupRows(aislesOrdered: Aisle[], rows: ListRow[]): AisleGroup[] {
  const groups: AisleGroup[] = []
  for (const aisle of aislesOrdered) {
    const r = rows
      .filter((x) => x.item.aisleId === aisle.id)
      .sort((a, b) => compareNames(a.item.name, b.item.name))
    if (r.length) groups.push({ aisle, rows: r })
  }
  return groups
}

export function buildListView(
  shop: Shop,
  entries: ListEntry[],
  items: CatalogItem[],
  aisles: Aisle[],
  units: Unit[],
): ListView {
  const itemById = new Map(items.map((i) => [i.id, i]))
  const unitById = new Map(units.map((u) => [u.id, u]))
  const rows: ListRow[] = []
  for (const entry of entries) {
    const item = itemById.get(entry.itemId)
    const unit = item && unitById.get(item.unitId)
    if (item && unit) rows.push({ entry, item, unit })
  }
  const { inShop, rest } = orderedAisles(shop, aisles)
  const open = rows.filter((r) => !r.entry.checked)
  const done = rows.filter((r) => r.entry.checked)
  return {
    open: groupRows(inShop, open),
    notInShop: groupRows(rest, open),
    done: groupRows([...inShop, ...rest], done),
  }
}

function filterItems(items: CatalogItem[], query: string): CatalogItem[] {
  const q = foldForSearch(query.trim())
  return q ? items.filter((i) => foldForSearch(i.name).includes(q)) : items
}

function groupItems(aislesOrdered: Aisle[], items: CatalogItem[]): CatalogGroup[] {
  const groups: CatalogGroup[] = []
  for (const aisle of aislesOrdered) {
    const list = items
      .filter((i) => i.aisleId === aisle.id)
      .sort((a, b) => compareNames(a.name, b.name))
    if (list.length) groups.push({ aisle, items: list })
  }
  return groups
}

export function buildCatalogForAdd(
  shop: Shop,
  items: CatalogItem[],
  aisles: Aisle[],
  query: string,
): CatalogForAdd {
  const filtered = filterItems(items, query)
  const { inShop, rest } = orderedAisles(shop, aisles)
  return { inShop: groupItems(inShop, filtered), notInShop: groupItems(rest, filtered) }
}

export function buildCatalogGlobal(
  items: CatalogItem[],
  aisles: Aisle[],
  query: string,
): CatalogGroup[] {
  return groupItems([...aisles].sort(bySortKey), filterItems(items, query))
}
