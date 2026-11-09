import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadAll, openDatabase } from '../db/db'
import { MSG, useAppStore } from './app'

async function fresh() {
  setActivePinia(createPinia())
  const s = useAppStore()
  await s.init()
  return s
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

afterEach(() => {
  // no write-through may have failed silently
  expect(useAppStore().writeError).toBeNull()
})

const itemNamed = (s: ReturnType<typeof useAppStore>, n: string) =>
  s.items.find((i) => i.name === n)!

describe('init and seed', () => {
  it('seeds once on first start', async () => {
    const s = await fresh()
    expect(s.ready).toBe(true)
    expect(s.units).toHaveLength(11)
    expect(s.aisles).toHaveLength(11)
    expect(s.shops).toHaveLength(1)
    expect(s.activeShop?.name).toBe('Standard')
    expect(s.settings.seeded).toBe(true)
    expect(s.settings.lastShopId).toBe(s.activeShop!.id)
    const n = s.items.length
    const second = await fresh()
    expect(second.items).toHaveLength(n)
    expect(second.units).toHaveLength(11)
    expect(second.shops).toHaveLength(1)
    expect(second.activeShop?.id).toBe(s.activeShop?.id)
  })

  it('deleted seed items do not come back', async () => {
    const s = await fresh()
    const n = s.items.length
    expect((await s.deleteItem(itemNamed(s, 'Milch').id)).ok).toBe(true)
    const again = await fresh()
    expect(again.items).toHaveLength(n - 1)
    expect(again.items.find((i) => i.name === 'Milch')).toBeUndefined()
  })

  it('falls back to the first shop when lastShopId is invalid', async () => {
    const s = await fresh()
    const db = await openDatabase()
    await db.put('settings', { ...s.settings, lastShopId: 'gone' }, 'settings')
    db.close()
    const again = await fresh()
    expect(again.activeShop?.id).toBe(s.shops[0]!.id)
  })
})

describe('entries / add rules', () => {
  it('adds a new entry, validates amounts', async () => {
    const s = await fresh()
    const kg = itemNamed(s, 'Äpfel') // kg, step 0.5
    expect(await s.addItem(kg.id, 0.2)).toMatchObject({ status: 'invalid' })
    expect(await s.addItem(kg.id, NaN)).toMatchObject({ status: 'invalid' })
    expect(await s.addItem(kg.id, 0)).toMatchObject({ status: 'invalid' })
    expect(await s.addItem('nope', 1)).toMatchObject({ status: 'invalid' })
    expect(await s.addItem(kg.id, 1.5)).toEqual({ status: 'added' })
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0]).toMatchObject({ amount: 1.5, checked: false, checkedAt: null })
  })

  it('asks for confirmation when open, then adds amounts', async () => {
    const s = await fresh()
    const id = itemNamed(s, 'Äpfel').id
    await s.addItem(id, 1)
    expect(await s.addItem(id, 0.5)).toEqual({ status: 'needsConfirm', current: 1 })
    expect(s.entries[0]!.amount).toBe(1)
    expect(await s.confirmAddAmount(id, 0.5)).toEqual({ ok: true })
    expect(s.entries[0]!.amount).toBe(1.5)
    expect(s.entries).toHaveLength(1)
    expect((await s.confirmAddAmount(id, 0.1)).ok).toBe(false)
    expect((await s.confirmAddAmount(itemNamed(s, 'Milch').id, 1)).ok).toBe(false)
  })

  it('reopens a checked entry replacing the amount', async () => {
    const s = await fresh()
    const id = itemNamed(s, 'Äpfel').id
    await s.addItem(id, 2)
    await s.toggleChecked(s.entries[0]!.id)
    expect(s.entries[0]!.checked).toBe(true)
    expect(s.entries[0]!.checkedAt).toBeTypeOf('number')
    expect(await s.addItem(id, 1)).toEqual({ status: 'reopened' })
    expect(s.entries[0]).toMatchObject({ amount: 1, checked: false, checkedAt: null })
    expect(s.entries).toHaveLength(1)
  })

  it('setAmount reopens checked entries and validates', async () => {
    const s = await fresh()
    await s.addItem(itemNamed(s, 'Milch').id, 1)
    const e = s.entries[0]!
    await s.toggleChecked(e.id)
    expect(await s.setAmount(e.id, 0.1)).toMatchObject({ ok: false, error: MSG.invalidAmount })
    expect(await s.setAmount(e.id, 2.5)).toEqual({ ok: true })
    expect(s.entries[0]).toMatchObject({ amount: 2.5, checked: false, checkedAt: null })
    expect((await s.setAmount('nope', 1)).ok).toBe(false)
  })

  it('toggle, remove, restore, clearChecked', async () => {
    const s = await fresh()
    await s.addItem(itemNamed(s, 'Milch').id, 1)
    await s.addItem(itemNamed(s, 'Brot').id, 2)
    await s.addItem(itemNamed(s, 'Salz').id, 1)
    const [a, b, c] = s.entries.map((e) => e.id) as [string, string, string]
    await s.toggleChecked(a)
    await s.toggleChecked(b)
    expect(s.countChecked).toBe(2)
    await s.toggleChecked(b)
    expect(s.entries.find((e) => e.id === b)).toMatchObject({ checked: false, checkedAt: null })
    expect(s.countChecked).toBe(1)

    const removed = await s.removeEntry(c)
    expect(removed?.id).toBe(c)
    expect(s.entries).toHaveLength(2)
    expect(await s.removeEntry(c)).toBeNull()
    expect(await s.restoreEntry(removed!)).toEqual({ ok: true })
    expect(s.entries).toHaveLength(3)
    expect((await s.restoreEntry(removed!)).ok).toBe(false)

    expect(await s.clearChecked()).toBe(1)
    expect(s.entries.map((e) => e.id).sort()).toEqual([b, c].sort())
    expect(await s.clearChecked()).toBe(0)
  })

  it('restore fails if the item was re-added meanwhile', async () => {
    const s = await fresh()
    const id = itemNamed(s, 'Milch').id
    await s.addItem(id, 1)
    const removed = (await s.removeEntry(s.entries[0]!.id))!
    await s.addItem(id, 2)
    expect(await s.restoreEntry(removed)).toEqual({ ok: false, error: MSG.alreadyOnList })
  })

  it('restore reports a deleted catalog item clearly', async () => {
    const s = await fresh()
    const id = itemNamed(s, 'Milch').id
    await s.addItem(id, 1)
    const removed = (await s.removeEntry(s.entries[0]!.id))!
    expect((await s.deleteItem(id)).ok).toBe(true)
    expect(await s.restoreEntry(removed)).toEqual({ ok: false, error: MSG.itemDeleted })
    expect(MSG.itemDeleted).toBe('Artikel existiert nicht mehr.')
  })

  it('listView reflects shop and entries', async () => {
    const s = await fresh()
    await s.addItem(itemNamed(s, 'Milch').id, 1)
    await s.addItem(itemNamed(s, 'Äpfel').id, 1)
    expect(s.listView.open.map((g) => g.aisle.name)).toEqual([
      'Obst & Gemüse',
      'Milchprodukte & Eier',
    ])
    const milk = s.aisles.find((a) => a.name === 'Milchprodukte & Eier')!
    await s.setShopAisles(
      s.activeShop!.id,
      s.activeShop!.aisleIds.filter((i) => i !== milk.id),
    )
    expect(s.listView.notInShop.map((g) => g.aisle.name)).toEqual(['Milchprodukte & Eier'])
  })
})

describe('items', () => {
  it('create/update/delete with unique names', async () => {
    const s = await fresh()
    const unit = s.units[0]!
    const aisle = s.aisles[0]!
    const r = await s.createItem('  Aprikose ', unit.id, aisle.id)
    expect(r).toMatchObject({ ok: true, item: { name: 'Aprikose' } })
    expect(await s.createItem('aprikose', unit.id, aisle.id)).toEqual({
      ok: false,
      error: MSG.nameExists,
    })
    expect(await s.createItem('   ', unit.id, aisle.id)).toEqual({
      ok: false,
      error: MSG.nameEmpty,
    })
    expect((await s.createItem('X', 'nope', aisle.id)).ok).toBe(false)
    const id = r.ok ? r.item.id : ''
    // renaming to own name (case change) is fine
    expect(
      (await s.updateItem(id, { name: 'APRIKOSE', unitId: unit.id, aisleId: aisle.id })).ok,
    ).toBe(true)
    expect(await s.updateItem(id, { name: 'Milch', unitId: unit.id, aisleId: aisle.id })).toEqual({
      ok: false,
      error: MSG.nameExists,
    })
    expect(itemNamed(s, 'APRIKOSE').id).toBe(id)
  })

  it('blocks deletion while on the list', async () => {
    const s = await fresh()
    const id = itemNamed(s, 'Milch').id
    await s.addItem(id, 1)
    expect(await s.deleteItem(id)).toEqual({ ok: false, error: 'Artikel ist noch auf der Liste.' })
    await s.toggleChecked(s.entries[0]!.id)
    expect((await s.deleteItem(id)).ok).toBe(false) // checked still blocks
    await s.removeEntry(s.entries[0]!.id)
    expect((await s.deleteItem(id)).ok).toBe(true)
  })
})

describe('units', () => {
  it('create with default step, validate, update', async () => {
    const s = await fresh()
    const r = await s.createUnit('Tüte')
    expect(r).toMatchObject({ ok: true, unit: { name: 'Tüte', step: 1 } })
    expect((await s.createUnit('KG', 1)).ok).toBe(false)
    expect(await s.createUnit('x', 0)).toMatchObject({ ok: false })
    expect(await s.createUnit('y', NaN)).toMatchObject({ ok: false })
    const id = r.ok ? r.unit.id : ''
    expect(await s.updateUnit(id, { name: 'Tüte', step: 0.25 })).toMatchObject({
      ok: true,
      unit: { step: 0.25 },
    })
    expect(await s.updateUnit(id, { name: 'g', step: 1 })).toEqual({
      ok: false,
      error: MSG.nameExists,
    })
  })

  it('blocks deletion with count', async () => {
    const s = await fresh()
    const kg = s.units.find((u) => u.name === 'kg')!
    const n = s.items.filter((i) => i.unitId === kg.id).length
    expect(n).toBeGreaterThan(1)
    expect(await s.deleteUnit(kg.id)).toEqual({
      ok: false,
      error: `Einheit wird noch von ${n} Artikeln verwendet.`,
    })
    const u = await s.createUnit('Tüte')
    expect((await s.deleteUnit(u.ok ? u.unit.id : '')).ok).toBe(true)
  })
})

describe('aisles', () => {
  it('create gets max+1, in no shop; rename; unique', async () => {
    const s = await fresh()
    const r = await s.createAisle(' Tierbedarf ')
    expect(r).toMatchObject({ ok: true, aisle: { name: 'Tierbedarf', sortKey: 12 } })
    const id = r.ok ? r.aisle.id : ''
    expect(s.shops.every((sh) => !sh.aisleIds.includes(id))).toBe(true)
    expect((await s.createAisle('tierbedarf')).ok).toBe(false)
    expect((await s.renameAisle(id, 'Getränke')).ok).toBe(false)
    expect((await s.renameAisle(id, 'Tiere')).ok).toBe(true)
    expect(s.aisleById.get(id)!.name).toBe('Tiere')
  })

  it('blocks deletion with count; otherwise strips from shops', async () => {
    const s = await fresh()
    const obst = s.aisles[0]!
    const n = s.items.filter((i) => i.aisleId === obst.id).length
    expect(await s.deleteAisle(obst.id)).toEqual({
      ok: false,
      error: `Gang wird noch von ${n} Artikeln verwendet.`,
    })
    const r = await s.createAisle('Leer')
    const id = r.ok ? r.aisle.id : ''
    const shop = s.activeShop!
    await s.setShopAisles(shop.id, [...shop.aisleIds, id])
    const second = await s.createShop('Zweit')
    expect(second.ok && second.shop.aisleIds.includes(id)).toBe(true)
    expect(await s.deleteAisle(id)).toEqual({ ok: true })
    expect(s.shops.every((sh) => !sh.aisleIds.includes(id))).toBe(true)
    const again = await fresh()
    expect(again.shops.every((sh) => !sh.aisleIds.includes(id))).toBe(true)
    expect(again.aisles.find((a) => a.id === id)).toBeUndefined()
  })

  it('reorderAisles rewrites sortKeys', async () => {
    const s = await fresh()
    const ids = s.aisles.map((a) => a.id)
    const reversed = [...ids].reverse()
    await s.reorderAisles(reversed)
    expect(reversed.map((id) => s.aisleById.get(id)!.sortKey)).toEqual(ids.map((_, i) => i + 1))
    const again = await fresh()
    expect(again.aisleById.get(reversed[0]!)!.sortKey).toBe(1)
    // partial list: unlisted follow in old order
    await again.reorderAisles([ids[5]!])
    expect(again.aisleById.get(ids[5]!)!.sortKey).toBe(1)
    expect(again.aisles.map((a) => a.sortKey).sort((a, b) => a - b)).toEqual(
      ids.map((_, i) => i + 1),
    )
  })
})

describe('shops', () => {
  it('create copies active shop, rename, unique', async () => {
    const s = await fresh()
    const r = await s.createShop(' Rewe ')
    expect(r.ok && r.shop.aisleIds).toEqual(s.activeShop!.aisleIds)
    expect(r.ok && r.shop.aisleIds).not.toBe(s.activeShop!.aisleIds)
    expect((await s.createShop('rewe')).ok).toBe(false)
    expect((await s.createShop('')).ok).toBe(false)
    const id = r.ok ? r.shop.id : ''
    expect((await s.renameShop(id, 'standard')).ok).toBe(false)
    expect((await s.renameShop(id, 'Aldi')).ok).toBe(true)
    expect(s.shopById.get(id)!.name).toBe('Aldi')
    expect(s.activeShop!.name).toBe('Standard') // not switched
  })

  it('setShopAisles drops unknown/duplicate ids', async () => {
    const s = await fresh()
    const [a, b] = s.aisles
    await s.setShopAisles(s.activeShop!.id, [b!.id, a!.id, b!.id, 'nope'])
    expect(s.activeShop!.aisleIds).toEqual([b!.id, a!.id])
  })

  it('setActiveShop persists lastShopId', async () => {
    const s = await fresh()
    const r = await s.createShop('Rewe')
    const id = r.ok ? r.shop.id : ''
    expect((await s.setActiveShop('nope')).ok).toBe(false)
    await s.setActiveShop(id)
    expect(s.activeShop!.id).toBe(id)
    const again = await fresh()
    expect(again.activeShop!.id).toBe(id)
  })

  it('cannot delete the last shop', async () => {
    const s = await fresh()
    expect(await s.deleteShop(s.shops[0]!.id)).toEqual({ ok: false, error: MSG.lastShop })
    expect(MSG.lastShop).toBe('Mindestens ein Laden muss bleiben')
    expect(s.shops).toHaveLength(1)
  })

  it('deleting the active shop switches to the first remaining and persists', async () => {
    const s = await fresh()
    const first = s.shops[0]!
    const r = await s.createShop('Rewe')
    const id = r.ok ? r.shop.id : ''
    await s.setActiveShop(id)
    expect(await s.deleteShop(id)).toEqual({ ok: true })
    expect(s.activeShop!.id).toBe(first.id)
    expect(s.settings.lastShopId).toBe(first.id)
    const again = await fresh()
    expect(again.shops).toHaveLength(1)
    expect(again.activeShop!.id).toBe(first.id)
  })

  it('deleting an inactive shop keeps the active one', async () => {
    const s = await fresh()
    const first = s.shops[0]!
    const r = await s.createShop('Rewe')
    expect((await s.deleteShop(r.ok ? r.shop.id : '')).ok).toBe(true)
    expect(s.activeShop!.id).toBe(first.id)
  })
})

describe('persistence round-trip', () => {
  it('reloads all mutated data from the same DB', async () => {
    const s = await fresh()
    const milch = itemNamed(s, 'Milch')
    await s.addItem(milch.id, 2)
    await s.addItem(itemNamed(s, 'Brot').id, 1)
    await s.toggleChecked(s.entries[1]!.id)
    const u = await s.createUnit('Tüte', 2)
    const a = await s.createAisle('Neu')
    await s.createItem('Neuding', u.ok ? u.unit.id : '', a.ok ? a.aisle.id : '')
    await s.renameShop(s.activeShop!.id, 'Hauptladen')

    const again = await fresh()
    expect(again.entries).toHaveLength(2)
    expect(again.entries.find((e) => e.itemId === milch.id)!.amount).toBe(2)
    expect(again.entries.filter((e) => e.checked)).toHaveLength(1)
    expect(again.countChecked).toBe(1)
    expect(again.units.find((x) => x.name === 'Tüte')!.step).toBe(2)
    expect(again.items.find((x) => x.name === 'Neuding')).toBeDefined()
    expect(again.activeShop!.name).toBe('Hauptladen')

    await again.clearChecked()
    const third = await fresh()
    expect(third.entries).toHaveLength(1)
  })

  it('unique itemId index is in place and writes are one transaction', async () => {
    const s = await fresh()
    await s.addItem(itemNamed(s, 'Milch').id, 1)
    const db = await openDatabase()
    const all = await loadAll(db)
    expect(all.entries).toHaveLength(1)
    await expect(db.add('entries', { ...all.entries[0]!, id: 'dup' })).rejects.toThrow()
    db.close()
  })
})

describe('shop editor navigation', () => {
  it('back returns to where the editor was opened from', async () => {
    const s = await fresh()
    const id = s.shops[0]!.id
    s.editShop(id, 'list')
    expect(s.view).toBe('shops')
    s.closeEditor()
    expect(s.view).toBe('list')
    expect(s.editingShopId).toBeNull()

    s.setView('shops')
    s.editShop(id)
    s.closeEditor()
    expect(s.view).toBe('shops')
    expect(s.editingShopId).toBeNull()
  })

  it('applies the same rule after deleting the shop', async () => {
    const s = await fresh()
    const r = await s.createShop('Rewe')
    if (!r.ok) throw new Error('create failed')
    s.editShop(r.shop.id, 'list')
    await s.deleteShop(r.shop.id)
    s.closeEditor()
    expect(s.view).toBe('list')
  })
})
