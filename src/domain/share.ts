import { roundAmount } from './amount'
import { namesEqual, normalizeName } from './text'
import type { Aisle, CatalogItem, Id, Unit } from './types'

/** One open list entry as it travels in a share link (names, not ids: ids are per device). */
export interface SharedItem {
  name: string
  amount: number
  unit: string
  aisle: string
}

export const SHARE_VERSION = 1
export const MAX_SHARED_ITEMS = 200
export const MAX_NAME_LENGTH = 80
export const IMPORT_PREFIX = '#import='

interface Payload {
  v: number
  items: { n: string; a: number; u: string; g: string }[]
}

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad base64url')
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function encodeShare(items: SharedItem[]): string {
  const payload: Payload = {
    v: SHARE_VERSION,
    items: items.map((i) => ({ n: i.name, a: i.amount, u: i.unit, g: i.aisle })),
  }
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

function cleanText(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const s = normalizeName(x)
  return s.length > 0 && s.length <= MAX_NAME_LENGTH ? s : null
}

/**
 * Decodes and validates a share payload (untrusted input). Any violation rejects the whole
 * payload (null). Duplicate names (case-insensitive) are merged by adding their amounts.
 */
export function decodeShare(payload: string): SharedItem[] | null {
  let data: unknown
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(payload))
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { v, items } = data as { v?: unknown; items?: unknown }
  if (v !== SHARE_VERSION || !Array.isArray(items)) return null
  if (items.length === 0 || items.length > MAX_SHARED_ITEMS) return null

  const out: SharedItem[] = []
  for (const raw of items as unknown[]) {
    if (typeof raw !== 'object' || raw === null) return null
    const r = raw as Record<string, unknown>
    const name = cleanText(r.n)
    const unit = cleanText(r.u)
    const aisle = cleanText(r.g)
    if (!name || !unit || !aisle) return null
    if (typeof r.a !== 'number' || !Number.isFinite(r.a)) return null
    const amount = roundAmount(r.a)
    if (!(amount > 0)) return null
    const dup = out.find((o) => namesEqual(o.name, name))
    if (dup) dup.amount = roundAmount(dup.amount + amount)
    else out.push({ name, amount, unit, aisle })
  }
  return out
}

/** `base` is origin + Vite base path, e.g. `https://x.github.io/smart-shopping/`. */
export function buildShareUrl(base: string, items: SharedItem[]): string {
  return `${base}${IMPORT_PREFIX}${encodeShare(items)}`
}

/** Returns the payload if the location hash is an import link, else null. */
export function importPayloadFromHash(hash: string): string | null {
  return hash.startsWith(IMPORT_PREFIX) ? hash.slice(IMPORT_PREFIX.length) : null
}

export type PlanEntry =
  | { kind: 'ready'; shared: SharedItem; itemId: Id }
  | { kind: 'unitClash'; shared: SharedItem; itemId: Id; catalogUnit: string }
  | { kind: 'unknown'; shared: SharedItem }

/** Classifies shared items against the receiver's catalog (exact name match, case-insensitive). */
export function planImport(shared: SharedItem[], items: CatalogItem[], units: Unit[]): PlanEntry[] {
  const unitName = new Map(units.map((u) => [u.id, u.name]))
  return shared.map((s): PlanEntry => {
    const item = items.find((i) => namesEqual(i.name, s.name))
    if (!item) return { kind: 'unknown', shared: s }
    const catalogUnit = unitName.get(item.unitId) ?? ''
    if (namesEqual(catalogUnit, s.unit)) return { kind: 'ready', shared: s, itemId: item.id }
    return { kind: 'unitClash', shared: s, itemId: item.id, catalogUnit }
  })
}

/**
 * Unit and aisle for a new catalog item: matched by name, else the first unit / the aisle with
 * the lowest sortKey. Never creates units or aisles. Null if the receiver has none at all.
 */
export function resolveNewItem(
  shared: SharedItem,
  units: Unit[],
  aisles: Aisle[],
): { unit: Unit; aisle: Aisle } | null {
  const unit = units.find((u) => namesEqual(u.name, shared.unit)) ?? units[0]
  const aisle =
    aisles.find((a) => namesEqual(a.name, shared.aisle)) ??
    [...aisles].sort((a, b) => a.sortKey - b.sortKey)[0]
  return unit && aisle ? { unit, aisle } : null
}
