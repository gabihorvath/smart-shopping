import { describe, expect, it } from 'vitest'
import {
  buildShareUrl,
  decodeShare,
  encodeShare,
  importPayloadFromHash,
  planImport,
  resolveNewItem,
  type SharedItem,
} from './share'
import type { Aisle, CatalogItem, Unit } from './types'

const sample: SharedItem[] = [
  { name: 'Äpfel', amount: 1.5, unit: 'kg', aisle: 'Obst & Gemüse' },
  { name: 'Milch', amount: 2, unit: 'l', aisle: 'Milchprodukte & Eier' },
]

const b64 = (o: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

describe('share payload', () => {
  it('round-trips, including umlauts', () => {
    expect(decodeShare(encodeShare(sample))).toEqual(sample)
  })

  it('builds a fragment link and extracts the payload from a hash', () => {
    const url = buildShareUrl('https://x.test/smart-shopping/', sample)
    const hash = url.slice(url.indexOf('#'))
    expect(url.startsWith('https://x.test/smart-shopping/#import=')).toBe(true)
    expect(decodeShare(importPayloadFromHash(hash)!)).toEqual(sample)
    expect(importPayloadFromHash('#other')).toBeNull()
  })

  it('rejects garbage and wrong versions', () => {
    expect(decodeShare('not base64 !!')).toBeNull()
    expect(decodeShare(b64({ v: 2, items: [] }))).toBeNull()
    expect(decodeShare(b64({ v: 1, items: [] }))).toBeNull()
    expect(decodeShare(b64('text'))).toBeNull()
  })

  it('rejects invalid items', () => {
    const ok = { n: 'A', a: 1, u: 'kg', g: 'G' }
    expect(decodeShare(b64({ v: 1, items: [ok] }))).not.toBeNull()
    for (const bad of [
      { ...ok, n: '  ' },
      { ...ok, n: 'x'.repeat(81) },
      { ...ok, a: 0 },
      { ...ok, a: -1 },
      { ...ok, a: '1' },
      { ...ok, a: 0.0001 },
      { ...ok, u: 5 },
      { ...ok, g: '' },
      null,
    ])
      expect(decodeShare(b64({ v: 1, items: [ok, bad] }))).toBeNull()
  })

  it('caps the item count', () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ n: `A${i}`, a: 1, u: 'kg', g: 'G' }))
    expect(decodeShare(b64({ v: 1, items: many }))).toBeNull()
    expect(decodeShare(b64({ v: 1, items: many.slice(0, 200) }))).toHaveLength(200)
  })

  it('merges duplicate names case-insensitively and rounds amounts', () => {
    const r = decodeShare(
      b64({
        v: 1,
        items: [
          { n: 'Milch', a: 0.1, u: 'l', g: 'G' },
          { n: ' milch ', a: 0.2, u: 'l', g: 'G' },
          { n: 'Salz', a: 1.00049, u: 'Pkg', g: 'G' },
        ],
      }),
    )
    expect(r).toEqual([
      { name: 'Milch', amount: 0.3, unit: 'l', aisle: 'G' },
      { name: 'Salz', amount: 1, unit: 'Pkg', aisle: 'G' },
    ])
  })
})

describe('import planning', () => {
  const units: Unit[] = [
    { id: 'u-kg', name: 'kg', step: 0.5 },
    { id: 'u-l', name: 'l', step: 1 },
  ]
  const aisles: Aisle[] = [
    { id: 'a2', name: 'Getränke', sortKey: 2 },
    { id: 'a1', name: 'Obst & Gemüse', sortKey: 1 },
  ]
  const items: CatalogItem[] = [
    { id: 'i-apple', name: 'Äpfel', unitId: 'u-kg', aisleId: 'a1' },
    { id: 'i-milk', name: 'Milch', unitId: 'u-kg', aisleId: 'a2' },
  ]

  it('classifies ready, unit clash and unknown items', () => {
    const plan = planImport(
      [
        { name: 'äpfel', amount: 1, unit: 'KG', aisle: 'x' },
        { name: 'Milch', amount: 1, unit: 'l', aisle: 'x' },
        { name: 'Brot', amount: 1, unit: 'Stk', aisle: 'x' },
      ],
      items,
      units,
    )
    expect(plan.map((p) => p.kind)).toEqual(['ready', 'unitClash', 'unknown'])
    expect(plan[1]).toMatchObject({ itemId: 'i-milk', catalogUnit: 'kg' })
  })

  it('resolves unit and aisle by name, else first unit / lowest sortKey', () => {
    const named = resolveNewItem(
      { name: 'Saft', amount: 1, unit: 'L', aisle: 'getränke' },
      units,
      aisles,
    )
    expect(named).toMatchObject({ unit: { id: 'u-l' }, aisle: { id: 'a2' } })
    const fallback = resolveNewItem(
      { name: 'Saft', amount: 1, unit: 'Dose', aisle: 'Nirgends' },
      units,
      aisles,
    )
    expect(fallback).toMatchObject({ unit: { id: 'u-kg' }, aisle: { id: 'a1' } })
    expect(resolveNewItem(sample[0]!, [], aisles)).toBeNull()
  })
})
