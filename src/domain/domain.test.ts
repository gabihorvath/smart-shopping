import { describe, expect, it } from 'vitest'
import {
  formatAmount,
  parseAmount,
  roundAmount,
  stepDown,
  stepUp,
  toInputText,
  validateAmount,
} from './amount'
import { buildSeed } from './seed'
import { compareNames, foldForSearch, namesEqual, normalizeName } from './text'
import type { Aisle, CatalogItem, ListEntry, Shop, Unit } from './types'
import { buildCatalogForAdd, buildCatalogGlobal, buildListView } from './view'

describe('amount', () => {
  it('rounds to 3 decimals', () => {
    expect(roundAmount(0.1 + 0.2)).toBe(0.3)
    expect(roundAmount(1.23456)).toBe(1.235)
  })
  it('parses German and tolerated formats', () => {
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount(' 2 ')).toBe(2)
    expect(parseAmount('0.25')).toBe(0.25)
    expect(parseAmount(',5')).toBe(0.5)
    expect(parseAmount('1,2345')).toBe(1.235)
  })
  it('rejects invalid input', () => {
    for (const s of ['', ' ', 'abc', '1,2,3', '-1', '1e3', '1,', '--', 'NaN', 'Infinity'])
      expect(parseAmount(s), s).toBeNull()
  })
  it('formats with de-DE', () => {
    expect(formatAmount(1.5)).toBe('1,5')
    expect(formatAmount(2)).toBe('2')
    expect(formatAmount(0.125)).toBe('0,125')
    expect(formatAmount(1000)).toBe('1.000')
    expect(formatAmount(1.0004)).toBe('1')
  })
  it('toInputText round-trips through parseAmount (no grouping)', () => {
    for (const n of [1000, 1.5, 0.125, 1234567]) expect(parseAmount(toInputText(n))).toBe(n)
    expect(toInputText(1000)).toBe('1000')
  })
  it('validates against step', () => {
    expect(validateAmount(1, 1)).toBe(true)
    expect(validateAmount(0.5, 1)).toBe(false)
    expect(validateAmount(0, 0.5)).toBe(false)
    expect(validateAmount(-1, 0.5)).toBe(false)
    expect(validateAmount(NaN, 1)).toBe(false)
    expect(validateAmount(Infinity, 1)).toBe(false)
    expect(validateAmount(100, 100)).toBe(true)
  })
  it('steps up and down, never below step', () => {
    expect(stepUp(0.1, 0.2)).toBe(0.3)
    expect(stepUp(1, 0.5)).toBe(1.5)
    expect(stepDown(1.5, 0.5)).toBe(1)
    expect(stepDown(0.5, 0.5)).toBe(0.5)
    expect(stepDown(150, 100)).toBe(100)
    expect(stepDown(100, 100)).toBe(100)
  })
})

describe('text', () => {
  it('normalizes and folds', () => {
    expect(normalizeName('  Äpfel ')).toBe('Äpfel')
    expect(foldForSearch('Äpfel')).toBe('apfel')
    expect(foldForSearch('Brötchen')).toBe('brotchen')
    expect(foldForSearch('Süßes')).toBe('süßes'.normalize('NFD').replace(/\p{M}/gu, ''))
    expect(foldForSearch('ae')).toBe('ae')
  })
  it('compares German-style', () => {
    expect(compareNames('Äpfel', 'Bananen')).toBeLessThan(0)
    expect(compareNames('Zitronen', 'Äpfel')).toBeGreaterThan(0)
    expect(compareNames('apfel', 'Apfel')).toBe(0)
    expect(['Zwiebeln', 'Äpfel', 'Brot', 'Ananas'].sort(compareNames)).toEqual([
      'Ananas',
      'Äpfel',
      'Brot',
      'Zwiebeln',
    ])
  })
  it('compares names case-insensitively after trim', () => {
    expect(namesEqual(' Milch', 'milch ')).toBe(true)
    expect(namesEqual('Milch', 'Milchs')).toBe(false)
  })
})

describe('seed', () => {
  it('matches the concept table', () => {
    let n = 0
    const s = buildSeed(() => `id${n++}`)
    expect(s.units.map((u) => [u.name, u.step])).toEqual([
      ['Stk', 1],
      ['g', 100],
      ['kg', 0.5],
      ['ml', 100],
      ['l', 0.5],
      ['Pkg', 1],
      ['Dose', 1],
      ['Glas', 1],
      ['Flasche', 1],
      ['Bund', 1],
      ['Beutel', 1],
    ])
    expect(s.aisles.map((a) => a.sortKey)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(s.aisles[0]!.name).toBe('Obst & Gemüse')
    expect(s.aisles[10]!.name).toBe('Drogerie & Haushalt')
    expect(s.items).toHaveLength(11 + 3 + 7 + 5 + 3 + 7 + 4 + 4 + 3 + 5 + 6)
    expect(s.shop.name).toBe('Standard')
    expect(s.shop.aisleIds).toEqual(s.aisles.map((a) => a.id))
    const unitName = (id: string) => s.units.find((u) => u.id === id)!.name
    const milch = s.items.find((i) => i.name === 'Milch')!
    expect(unitName(milch.unitId)).toBe('l')
  })
})

// ---- view ----
const unit: Unit = { id: 'u', name: 'Stk', step: 1 }
const A: Aisle = { id: 'A', name: 'A', sortKey: 3 }
const B: Aisle = { id: 'B', name: 'B', sortKey: 1 }
const C: Aisle = { id: 'C', name: 'C', sortKey: 2 }
const D: Aisle = { id: 'D', name: 'D', sortKey: 4 }
const aisles = [A, B, C, D]
const mk = (id: string, name: string, aisleId: string): CatalogItem => ({
  id,
  name,
  unitId: 'u',
  aisleId,
})
const items = [
  mk('i1', 'Zwiebeln', 'A'),
  mk('i2', 'Äpfel', 'A'),
  mk('i3', 'Brot', 'B'),
  mk('i4', 'Eier', 'C'),
  mk('i5', 'Zucker', 'D'),
  mk('i6', 'Apfelmus', 'A'),
  mk('i7', 'Ananas', 'A'),
]
const ent = (itemId: string, checked = false): ListEntry => ({
  id: 'e-' + itemId,
  itemId,
  amount: 1,
  checked,
  checkedAt: checked ? 1 : null,
})
// shop order: C, A ; skips B, D
const shop: Shop = { id: 's', name: 's', aisleIds: ['C', 'A'] }

describe('buildListView', () => {
  it('groups open items in shop order, A-Z with umlauts', () => {
    const v = buildListView(
      shop,
      [ent('i1'), ent('i2'), ent('i4'), ent('i6'), ent('i7')],
      items,
      aisles,
      [unit],
    )
    expect(v.open.map((g) => g.aisle.id)).toEqual(['C', 'A'])
    expect(v.open[1]!.rows.map((r) => r.item.name)).toEqual([
      'Ananas',
      'Äpfel',
      'Apfelmus',
      'Zwiebeln',
    ])
    expect(v.open[0]!.rows[0]!.unit).toBe(unit)
    expect(v.notInShop).toEqual([])
    expect(v.done).toEqual([])
  })
  it('puts skipped aisles in notInShop ordered by sortKey', () => {
    const v = buildListView(shop, [ent('i5'), ent('i3'), ent('i4')], items, aisles, [unit])
    expect(v.open.map((g) => g.aisle.id)).toEqual(['C'])
    expect(v.notInShop.map((g) => g.aisle.id)).toEqual(['B', 'D'])
  })
  it('groups done by shop order then rest by sortKey', () => {
    const v = buildListView(
      shop,
      [ent('i5', true), ent('i3', true), ent('i1', true), ent('i4', true), ent('i2', true)],
      items,
      aisles,
      [unit],
    )
    expect(v.open).toEqual([])
    expect(v.notInShop).toEqual([])
    expect(v.done.map((g) => g.aisle.id)).toEqual(['C', 'A', 'B', 'D'])
    expect(v.done[1]!.rows.map((r) => r.item.name)).toEqual(['Äpfel', 'Zwiebeln'])
  })
  it('omits empty groups and handles no entries', () => {
    const v = buildListView(shop, [], items, aisles, [unit])
    expect(v).toEqual({ open: [], notInShop: [], done: [] })
  })
  it('does not mutate inputs and ignores dangling entries', () => {
    const e = [ent('nope'), ent('i1')]
    const v = buildListView(shop, e, items, aisles, [unit])
    expect(v.open).toHaveLength(1)
    expect(e).toHaveLength(2)
  })
})

describe('catalog views', () => {
  it('buildCatalogForAdd: shop order then skipped by sortKey, items A-Z', () => {
    const r = buildCatalogForAdd(shop, items, aisles, '')
    expect(r.inShop.map((g) => g.aisle.id)).toEqual(['C', 'A'])
    expect(r.inShop[1]!.items.map((i) => i.name)).toEqual([
      'Ananas',
      'Äpfel',
      'Apfelmus',
      'Zwiebeln',
    ])
    expect(r.notInShop.map((g) => g.aisle.id)).toEqual(['B', 'D'])
  })
  it('filters by folded contains', () => {
    const r = buildCatalogForAdd(shop, items, aisles, ' apfel ')
    expect(r.inShop).toHaveLength(1)
    expect(r.inShop[0]!.items.map((i) => i.name)).toEqual(['Äpfel', 'Apfelmus'])
    expect(r.notInShop).toEqual([])
    const r2 = buildCatalogForAdd(shop, items, aisles, 'ZUC')
    expect(r2.inShop).toEqual([])
    expect(r2.notInShop[0]!.items[0]!.name).toBe('Zucker')
    expect(buildCatalogForAdd(shop, items, aisles, 'xyz')).toEqual({ inShop: [], notInShop: [] })
  })
  it('buildCatalogGlobal orders by sortKey', () => {
    const g = buildCatalogGlobal(items, aisles, '')
    expect(g.map((x) => x.aisle.id)).toEqual(['B', 'C', 'A', 'D'])
    expect(buildCatalogGlobal(items, aisles, 'brot').map((x) => x.aisle.id)).toEqual(['B'])
  })
})
