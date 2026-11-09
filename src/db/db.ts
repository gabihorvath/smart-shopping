import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Aisle, CatalogItem, ListEntry, Settings, Shop, Unit } from '../domain/types'

export const DB_NAME = 'smart-shopping'
export const DB_VERSION = 1
/** The settings store holds one record under this out-of-line key. */
export const SETTINGS_KEY = 'settings'

interface Schema extends DBSchema {
  units: { key: string; value: Unit }
  aisles: { key: string; value: Aisle }
  items: { key: string; value: CatalogItem }
  entries: { key: string; value: ListEntry; indexes: { itemId: string } }
  shops: { key: string; value: Shop }
  settings: { key: string; value: Settings }
}

export type Db = IDBPDatabase<Schema>
export type CollectionName = 'units' | 'aisles' | 'items' | 'entries' | 'shops'

export interface AllData {
  units: Unit[]
  aisles: Aisle[]
  items: CatalogItem[]
  entries: ListEntry[]
  shops: Shop[]
  settings: Settings | null
}

interface Part<T> {
  put?: T[]
  delete?: string[]
}

/** A batch of writes applied atomically in one transaction. */
export interface WriteBatch {
  units?: Part<Unit>
  aisles?: Part<Aisle>
  items?: Part<CatalogItem>
  entries?: Part<ListEntry>
  shops?: Part<Shop>
  settings?: Settings
}

export function openDatabase(name = DB_NAME): Promise<Db> {
  return openDB<Schema>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('units', { keyPath: 'id' })
      db.createObjectStore('aisles', { keyPath: 'id' })
      db.createObjectStore('items', { keyPath: 'id' })
      const entries = db.createObjectStore('entries', { keyPath: 'id' })
      entries.createIndex('itemId', 'itemId', { unique: true })
      db.createObjectStore('shops', { keyPath: 'id' })
      db.createObjectStore('settings')
    },
  })
}

export async function loadAll(db: Db): Promise<AllData> {
  const tx = db.transaction(
    ['units', 'aisles', 'items', 'entries', 'shops', 'settings'],
    'readonly',
  )
  const [units, aisles, items, entries, shops, settings] = await Promise.all([
    tx.objectStore('units').getAll(),
    tx.objectStore('aisles').getAll(),
    tx.objectStore('items').getAll(),
    tx.objectStore('entries').getAll(),
    tx.objectStore('shops').getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
  ])
  await tx.done
  return { units, aisles, items, entries, shops, settings: settings ?? null }
}

const COLLECTIONS: CollectionName[] = ['units', 'aisles', 'items', 'entries', 'shops']

interface AnyStore {
  put(v: unknown): Promise<unknown>
  delete(k: string): Promise<unknown>
}

/** Apply all puts/deletes in ONE readwrite transaction (all-or-nothing). Deletes run before puts. */
export async function writeBatch(db: Db, batch: WriteBatch): Promise<void> {
  const names: (CollectionName | 'settings')[] = COLLECTIONS.filter((c) => batch[c])
  if (batch.settings) names.push('settings')
  if (!names.length) return
  const tx = db.transaction(names, 'readwrite')
  const ops: Promise<unknown>[] = []
  for (const c of COLLECTIONS) {
    const part = batch[c] as Part<unknown> | undefined
    if (!part) continue
    const store = tx.objectStore(c) as unknown as AnyStore
    for (const id of part.delete ?? []) ops.push(store.delete(id))
    for (const v of part.put ?? []) ops.push(store.put(v))
  }
  if (batch.settings) ops.push(tx.objectStore('settings').put(batch.settings, SETTINGS_KEY))
  // abort() makes tx.done reject; mark it handled so only the original error propagates
  tx.done.catch(() => {})
  try {
    await Promise.all(ops)
    await tx.done
  } catch (e) {
    try {
      tx.abort()
    } catch {
      /* already finished */
    }
    throw e
  }
}
