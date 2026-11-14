import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { loadAll, openDatabase, writeBatch, type Db, type WriteBatch } from '../db/db'
import { roundAmount, validateAmount } from '../domain/amount'
import { buildSeed, SEED_VERSION, seedAdditions } from '../domain/seed'
import type { SharedItem } from '../domain/share'
import { namesEqual, normalizeName } from '../domain/text'
import type { Aisle, CatalogItem, Id, ListEntry, Settings, Shop, Unit } from '../domain/types'
import { buildListView, type ListView } from '../domain/view'

export const MSG = {
  nameExists: 'Name existiert schon.',
  nameEmpty: 'Name darf nicht leer sein.',
  invalidAmount: 'Ungültige Menge.',
  invalidStep: 'Ungültiger Schritt.',
  itemOnList: 'Artikel ist noch auf der Liste.',
  lastShop: 'Mindestens ein Laden muss bleiben',
  notFound: 'Eintrag nicht gefunden.',
  itemDeleted: 'Artikel existiert nicht mehr.',
  alreadyOnList: 'Artikel ist schon auf der Liste.',
  unitInUse: (n: number) => `Einheit wird noch von ${n} Artikeln verwendet.`,
  aisleInUse: (n: number) => `Gang wird noch von ${n} Artikeln verwendet.`,
} as const

export type Failure = { ok: false; error: string }
/** `{ ok: true }` plus optional payload fields. */
export type Result<T extends object = object> = ({ ok: true } & T) | Failure

export type AddResult =
  | { status: 'added' | 'reopened' }
  | { status: 'needsConfirm'; current: number }
  | { status: 'invalid'; error: string }

export type View = 'list' | 'shops' | 'catalog'
export type EditorOrigin = 'list' | 'shops'

const fail = (error: string): Failure => ({ ok: false, error })

export const useAppStore = defineStore('app', () => {
  // ---- state (all collections in memory) ----
  const units = ref<Unit[]>([])
  const aisles = ref<Aisle[]>([])
  const items = ref<CatalogItem[]>([])
  const entries = ref<ListEntry[]>([])
  const shops = ref<Shop[]>([])
  const settings = ref<Settings>({ lastShopId: null, seeded: false, schemaVersion: 1 })
  const activeShopId = ref<Id | null>(null)
  const view = ref<View>('list')
  /** Shop shown in the shop editor (view === 'shops'); null = none open. */
  const editingShopId = ref<Id | null>(null)
  const editorOrigin = ref<EditorOrigin>('shops')
  const ready = ref(false)
  /** Set when a write-through to IndexedDB failed (memory and DB may differ). */
  const writeError = ref<string | null>(null)

  let db: Db | null = null
  let queue: Promise<unknown> = Promise.resolve()

  // ---- derived ----
  const unitById = computed(() => new Map(units.value.map((u) => [u.id, u])))
  const aisleById = computed(() => new Map(aisles.value.map((a) => [a.id, a])))
  const itemById = computed(() => new Map(items.value.map((i) => [i.id, i])))
  const shopById = computed(() => new Map(shops.value.map((s) => [s.id, s])))
  const entryById = computed(() => new Map(entries.value.map((e) => [e.id, e])))
  const entryByItemId = computed(() => new Map(entries.value.map((e) => [e.itemId, e])))
  const activeShop = computed<Shop | null>(
    () => (activeShopId.value && shopById.value.get(activeShopId.value)) || null,
  )
  const emptyView: ListView = { open: [], notInShop: [], done: [] }
  const listView = computed<ListView>(() =>
    activeShop.value
      ? buildListView(activeShop.value, entries.value, items.value, aisles.value, units.value)
      : emptyView,
  )
  const countChecked = computed(() => entries.value.filter((e) => e.checked).length)

  // ---- persistence ----
  /** Queue a write-through (ordered, one transaction). Memory is already updated. */
  function persist(batch: WriteBatch): Promise<void> {
    const p = queue.then(() => (db ? writeBatch(db, batch) : undefined))
    queue = p.catch(() => undefined)
    return p.catch((e: unknown) => {
      writeError.value = e instanceof Error ? e.message : String(e)
    })
  }

  function setSettings(patch: Partial<Settings>): Settings {
    const next: Settings = { ...toRaw(settings.value), ...patch }
    settings.value = next
    return next // plain object: reactive proxies cannot be stored in IndexedDB
  }

  async function init(): Promise<void> {
    db = await openDatabase()
    const data = await loadAll(db)
    let s: Settings = data.settings ?? { lastShopId: null, seeded: false, schemaVersion: 1 }
    if (!s.seeded) {
      const seed = buildSeed()
      s = { ...s, seeded: true, seedVersion: SEED_VERSION, lastShopId: seed.shop.id }
      await writeBatch(db, {
        units: { put: seed.units },
        aisles: { put: seed.aisles },
        items: { put: seed.items },
        shops: { put: [seed.shop] },
        settings: s,
      })
      data.units = seed.units
      data.aisles = seed.aisles
      data.items = seed.items
      data.shops = [seed.shop]
    } else if ((s.seedVersion ?? 1) < SEED_VERSION) {
      // Seed grew since this install was seeded: merge in what is missing, once.
      const add = seedAdditions(data)
      s = { ...s, seedVersion: SEED_VERSION }
      await writeBatch(db, {
        units: { put: add.units },
        aisles: { put: add.aisles },
        items: { put: add.items },
        settings: s,
      })
      data.units = [...data.units, ...add.units]
      data.aisles = [...data.aisles, ...add.aisles]
      data.items = [...data.items, ...add.items]
    }
    units.value = data.units
    aisles.value = data.aisles
    items.value = data.items
    entries.value = data.entries
    shops.value = data.shops
    settings.value = s
    const last = s.lastShopId && data.shops.find((x) => x.id === s.lastShopId)
    activeShopId.value = last ? last.id : (data.shops[0]?.id ?? null)
    ready.value = true
    try {
      await navigator.storage?.persist?.()
    } catch {
      /* best effort */
    }
  }

  // ---- navigation ----
  function setView(v: View) {
    view.value = v
    if (v !== 'shops') editingShopId.value = null
  }
  /** Opens the shop editor; `from` is where Back returns to ('list' = main list, 'shops' = shop list). */
  function editShop(id: Id, from: EditorOrigin = 'shops') {
    editingShopId.value = id
    editorOrigin.value = from
    view.value = 'shops'
  }
  /** Back from the editor (also after deleting the shop): to where it was opened from. */
  function closeEditor() {
    editingShopId.value = null
    if (editorOrigin.value === 'list') view.value = 'list'
  }

  // ---- name helpers ----
  function checkName(list: { id: Id; name: string }[], raw: string, exceptId?: Id) {
    const name = normalizeName(raw)
    if (!name) return fail(MSG.nameEmpty)
    if (list.some((x) => x.id !== exceptId && namesEqual(x.name, name))) return fail(MSG.nameExists)
    return { ok: true as const, name }
  }

  // ---- entries ----
  function prepAmount(itemId: Id, amount: number): { error: string } | { amount: number } {
    const item = itemById.value.get(itemId)
    const unit = item && unitById.value.get(item.unitId)
    if (!item || !unit) return { error: MSG.notFound }
    const a = roundAmount(amount)
    if (!validateAmount(a, unit.step)) return { error: MSG.invalidAmount }
    return { amount: a }
  }

  function replaceEntry(e: ListEntry) {
    const i = entries.value.findIndex((x) => x.id === e.id)
    if (i >= 0) entries.value[i] = e
    else entries.value.push(e)
  }

  async function addItem(itemId: Id, amount: number): Promise<AddResult> {
    const p = prepAmount(itemId, amount)
    if ('error' in p) return { status: 'invalid', error: p.error }
    const existing = entryByItemId.value.get(itemId)
    if (!existing) {
      const e: ListEntry = {
        id: crypto.randomUUID(),
        itemId,
        amount: p.amount,
        checked: false,
        checkedAt: null,
      }
      replaceEntry(e)
      await persist({ entries: { put: [e] } })
      return { status: 'added' }
    }
    if (!existing.checked) return { status: 'needsConfirm', current: existing.amount }
    const e: ListEntry = { ...toRaw(existing), amount: p.amount, checked: false, checkedAt: null }
    replaceEntry(e)
    await persist({ entries: { put: [e] } })
    return { status: 'reopened' }
  }

  /** After the user confirmed the "Menge addieren?" prompt: adds to the open entry's amount. */
  async function confirmAddAmount(itemId: Id, amount: number): Promise<Result> {
    const p = prepAmount(itemId, amount)
    if ('error' in p) return fail(p.error)
    const existing = entryByItemId.value.get(itemId)
    if (!existing || existing.checked) return fail(MSG.notFound)
    const e: ListEntry = { ...toRaw(existing), amount: roundAmount(existing.amount + p.amount) }
    replaceEntry(e)
    await persist({ entries: { put: [e] } })
    return { ok: true }
  }

  /** Sets the amount; a checked entry is reopened (kickoff decision). */
  async function setAmount(entryId: Id, amount: number): Promise<Result> {
    const existing = entryById.value.get(entryId)
    if (!existing) return fail(MSG.notFound)
    const p = prepAmount(existing.itemId, amount)
    if ('error' in p) return fail(p.error)
    const e: ListEntry = { ...toRaw(existing), amount: p.amount, checked: false, checkedAt: null }
    replaceEntry(e)
    await persist({ entries: { put: [e] } })
    return { ok: true }
  }

  async function toggleChecked(entryId: Id): Promise<Result> {
    const existing = entryById.value.get(entryId)
    if (!existing) return fail(MSG.notFound)
    const checked = !existing.checked
    const e: ListEntry = { ...toRaw(existing), checked, checkedAt: checked ? Date.now() : null }
    replaceEntry(e)
    await persist({ entries: { put: [e] } })
    return { ok: true }
  }

  /** Open entries as share payload items (names, not ids). */
  function shareItems(): SharedItem[] {
    const out: SharedItem[] = []
    for (const e of entries.value) {
      if (e.checked) continue
      const item = itemById.value.get(e.itemId)
      const unit = item && unitById.value.get(item.unitId)
      const aisle = item && aisleById.value.get(item.aisleId)
      if (item && unit && aisle)
        out.push({ name: item.name, amount: e.amount, unit: unit.name, aisle: aisle.name })
    }
    return out
  }

  /**
   * Applies one imported amount. Open entry: add ('add') or leave alone ('keep'); checked entry:
   * reopened with the incoming amount; no entry: created. Amounts below the unit's step are
   * raised to the step.
   */
  async function importEntry(
    itemId: Id,
    amount: number,
    mode: 'add' | 'keep',
  ): Promise<'applied' | 'kept' | 'invalid'> {
    const item = itemById.value.get(itemId)
    const unit = item && unitById.value.get(item.unitId)
    if (!item || !unit) return 'invalid'
    const a = Math.max(roundAmount(amount), unit.step)
    const existing = entryByItemId.value.get(itemId)
    if (existing && !existing.checked) {
      if (mode === 'keep') return 'kept'
      return (await confirmAddAmount(itemId, a)).ok ? 'applied' : 'invalid'
    }
    const r = await addItem(itemId, a)
    return r.status === 'added' || r.status === 'reopened' ? 'applied' : 'invalid'
  }

  /** Removes the entry and returns it (for undo via restoreEntry), or null if unknown. */
  async function removeEntry(entryId: Id): Promise<ListEntry | null> {
    const existing = entryById.value.get(entryId)
    if (!existing) return null
    const removed: ListEntry = { ...toRaw(existing) }
    entries.value = entries.value.filter((e) => e.id !== entryId)
    await persist({ entries: { delete: [entryId] } })
    return removed
  }

  async function restoreEntry(entry: ListEntry): Promise<Result> {
    if (!itemById.value.has(entry.itemId)) return fail(MSG.itemDeleted)
    if (entryByItemId.value.has(entry.itemId) || entryById.value.has(entry.id))
      return fail(MSG.alreadyOnList)
    const e = { ...entry }
    replaceEntry(e)
    await persist({ entries: { put: [e] } })
    return { ok: true }
  }

  /** Removes all checked entries; returns how many were removed. */
  async function clearChecked(): Promise<number> {
    const ids = entries.value.filter((e) => e.checked).map((e) => e.id)
    if (!ids.length) return 0
    entries.value = entries.value.filter((e) => !e.checked)
    await persist({ entries: { delete: ids } })
    return ids.length
  }

  // ---- items ----
  async function createItem(
    name: string,
    unitId: Id,
    aisleId: Id,
  ): Promise<Result<{ item: CatalogItem }>> {
    const n = checkName(items.value, name)
    if (!n.ok) return n
    if (!unitById.value.has(unitId) || !aisleById.value.has(aisleId)) return fail(MSG.notFound)
    const item: CatalogItem = { id: crypto.randomUUID(), name: n.name, unitId, aisleId }
    items.value.push(item)
    await persist({ items: { put: [item] } })
    return { ok: true, item }
  }

  async function updateItem(
    id: Id,
    patch: { name: string; unitId: Id; aisleId: Id },
  ): Promise<Result<{ item: CatalogItem }>> {
    const existing = itemById.value.get(id)
    if (!existing) return fail(MSG.notFound)
    const n = checkName(items.value, patch.name, id)
    if (!n.ok) return n
    if (!unitById.value.has(patch.unitId) || !aisleById.value.has(patch.aisleId))
      return fail(MSG.notFound)
    const item: CatalogItem = { id, name: n.name, unitId: patch.unitId, aisleId: patch.aisleId }
    items.value = items.value.map((i) => (i.id === id ? item : i))
    await persist({ items: { put: [item] } })
    return { ok: true, item }
  }

  async function deleteItem(id: Id): Promise<Result> {
    if (!itemById.value.has(id)) return fail(MSG.notFound)
    if (entryByItemId.value.has(id)) return fail(MSG.itemOnList)
    items.value = items.value.filter((i) => i.id !== id)
    await persist({ items: { delete: [id] } })
    return { ok: true }
  }

  // ---- units ----
  function checkStep(step: number) {
    const s = roundAmount(step)
    return Number.isFinite(s) && s > 0 ? { ok: true as const, step: s } : fail(MSG.invalidStep)
  }

  async function createUnit(name: string, step = 1): Promise<Result<{ unit: Unit }>> {
    const n = checkName(units.value, name)
    if (!n.ok) return n
    const s = checkStep(step)
    if (!s.ok) return s
    const unit: Unit = { id: crypto.randomUUID(), name: n.name, step: s.step }
    units.value.push(unit)
    await persist({ units: { put: [unit] } })
    return { ok: true, unit }
  }

  async function updateUnit(
    id: Id,
    patch: { name: string; step: number },
  ): Promise<Result<{ unit: Unit }>> {
    if (!unitById.value.has(id)) return fail(MSG.notFound)
    const n = checkName(units.value, patch.name, id)
    if (!n.ok) return n
    const s = checkStep(patch.step)
    if (!s.ok) return s
    const unit: Unit = { id, name: n.name, step: s.step }
    units.value = units.value.map((u) => (u.id === id ? unit : u))
    await persist({ units: { put: [unit] } })
    return { ok: true, unit }
  }

  async function deleteUnit(id: Id): Promise<Result> {
    if (!unitById.value.has(id)) return fail(MSG.notFound)
    const n = items.value.filter((i) => i.unitId === id).length
    if (n > 0) return fail(MSG.unitInUse(n))
    units.value = units.value.filter((u) => u.id !== id)
    await persist({ units: { delete: [id] } })
    return { ok: true }
  }

  // ---- aisles ----
  async function createAisle(name: string): Promise<Result<{ aisle: Aisle }>> {
    const n = checkName(aisles.value, name)
    if (!n.ok) return n
    const sortKey = aisles.value.reduce((m, a) => Math.max(m, a.sortKey), 0) + 1
    const aisle: Aisle = { id: crypto.randomUUID(), name: n.name, sortKey }
    aisles.value.push(aisle)
    await persist({ aisles: { put: [aisle] } })
    return { ok: true, aisle }
  }

  async function renameAisle(id: Id, name: string): Promise<Result<{ aisle: Aisle }>> {
    const existing = aisleById.value.get(id)
    if (!existing) return fail(MSG.notFound)
    const n = checkName(aisles.value, name, id)
    if (!n.ok) return n
    const aisle: Aisle = { ...toRaw(existing), name: n.name }
    aisles.value = aisles.value.map((a) => (a.id === id ? aisle : a))
    await persist({ aisles: { put: [aisle] } })
    return { ok: true, aisle }
  }

  /** Blocked while catalog items use it; otherwise also strips it from all shops. */
  async function deleteAisle(id: Id): Promise<Result> {
    if (!aisleById.value.has(id)) return fail(MSG.notFound)
    const n = items.value.filter((i) => i.aisleId === id).length
    if (n > 0) return fail(MSG.aisleInUse(n))
    const changed = shops.value
      .filter((s) => s.aisleIds.includes(id))
      .map((s): Shop => ({ ...toRaw(s), aisleIds: s.aisleIds.filter((x) => x !== id) }))
    const changedIds = new Set(changed.map((s) => s.id))
    shops.value = shops.value.map((s) =>
      changedIds.has(s.id) ? changed.find((c) => c.id === s.id)! : s,
    )
    aisles.value = aisles.value.filter((a) => a.id !== id)
    await persist({ aisles: { delete: [id] }, shops: { put: changed } })
    return { ok: true }
  }

  /** Rewrites sortKeys to 1..n following the given order; unlisted aisles follow in old order. */
  async function reorderAisles(orderedIds: Id[]): Promise<Result> {
    const byId = aisleById.value
    const seen = new Set<Id>()
    const order: Aisle[] = []
    for (const id of orderedIds) {
      const a = byId.get(id)
      if (a && !seen.has(id)) {
        order.push(a)
        seen.add(id)
      }
    }
    const rest = aisles.value.filter((a) => !seen.has(a.id)).sort((a, b) => a.sortKey - b.sortKey)
    const next = [...order, ...rest].map((a, i): Aisle => ({ ...toRaw(a), sortKey: i + 1 }))
    const changed = next.filter((a) => a.sortKey !== byId.get(a.id)!.sortKey)
    aisles.value = next
    if (changed.length) await persist({ aisles: { put: changed } })
    return { ok: true }
  }

  // ---- shops ----
  /** New shop copies the active shop's aisle order. Does not switch the active shop. */
  async function createShop(name: string): Promise<Result<{ shop: Shop }>> {
    const n = checkName(shops.value, name)
    if (!n.ok) return n
    const shop: Shop = {
      id: crypto.randomUUID(),
      name: n.name,
      aisleIds: [...(activeShop.value?.aisleIds ?? [])],
    }
    shops.value.push(shop)
    await persist({ shops: { put: [shop] } })
    return { ok: true, shop }
  }

  async function renameShop(id: Id, name: string): Promise<Result<{ shop: Shop }>> {
    const existing = shopById.value.get(id)
    if (!existing) return fail(MSG.notFound)
    const n = checkName(shops.value, name, id)
    if (!n.ok) return n
    const shop: Shop = { id, name: n.name, aisleIds: [...existing.aisleIds] }
    shops.value = shops.value.map((s) => (s.id === id ? shop : s))
    await persist({ shops: { put: [shop] } })
    return { ok: true, shop }
  }

  async function deleteShop(id: Id): Promise<Result> {
    if (!shopById.value.has(id)) return fail(MSG.notFound)
    if (shops.value.length <= 1) return fail(MSG.lastShop)
    shops.value = shops.value.filter((s) => s.id !== id)
    const batch: WriteBatch = { shops: { delete: [id] } }
    if (activeShopId.value === id || settings.value.lastShopId === id) {
      const first = shops.value[0]!
      activeShopId.value = first.id
      batch.settings = setSettings({ lastShopId: first.id })
    }
    await persist(batch)
    return { ok: true }
  }

  /** Sets the shop's ordered aisle subset (unknown ids and duplicates are dropped). */
  async function setShopAisles(shopId: Id, aisleIds: Id[]): Promise<Result> {
    const existing = shopById.value.get(shopId)
    if (!existing) return fail(MSG.notFound)
    const ids = [...new Set(aisleIds)].filter((x) => aisleById.value.has(x))
    const shop: Shop = { id: shopId, name: existing.name, aisleIds: ids }
    shops.value = shops.value.map((s) => (s.id === shopId ? shop : s))
    await persist({ shops: { put: [shop] } })
    return { ok: true }
  }

  async function setActiveShop(id: Id): Promise<Result> {
    if (!shopById.value.has(id)) return fail(MSG.notFound)
    activeShopId.value = id
    await persist({ settings: setSettings({ lastShopId: id }) })
    return { ok: true }
  }

  return {
    // state
    units,
    aisles,
    items,
    entries,
    shops,
    settings,
    activeShopId,
    view,
    editingShopId,
    editorOrigin,
    ready,
    writeError,
    // getters
    unitById,
    aisleById,
    itemById,
    shopById,
    entryById,
    entryByItemId,
    activeShop,
    listView,
    countChecked,
    // actions
    init,
    setView,
    editShop,
    closeEditor,
    addItem,
    confirmAddAmount,
    shareItems,
    importEntry,
    setAmount,
    toggleChecked,
    removeEntry,
    restoreEntry,
    clearChecked,
    createItem,
    updateItem,
    deleteItem,
    createUnit,
    updateUnit,
    deleteUnit,
    createAisle,
    renameAisle,
    deleteAisle,
    reorderAisles,
    createShop,
    renameShop,
    deleteShop,
    setShopAisles,
    setActiveShop,
  }
})
