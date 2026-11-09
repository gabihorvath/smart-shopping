export type Id = string // crypto.randomUUID()

export interface Unit {
  id: Id
  name: string
  /** +/- button step; also the minimum amount. */
  step: number
}

export interface Aisle {
  id: Id
  name: string
  /** Global order; new aisles get max + 1. */
  sortKey: number
}

export interface CatalogItem {
  id: Id
  name: string
  unitId: Id
  aisleId: Id
}

export interface ListEntry {
  id: Id
  /** At most one entry per item. */
  itemId: Id
  amount: number
  checked: boolean
  /** Epoch ms; stored but not used for ordering. */
  checkedAt: number | null
}

export interface Shop {
  id: Id
  name: string
  /** Ordered subset of aisles; unlisted aisles are skipped. */
  aisleIds: Id[]
}

export interface Settings {
  lastShopId: Id | null
  seeded: boolean
  /** Seed version merged into the data; missing = 1 (installs from before versioning). */
  seedVersion?: number
  schemaVersion: number
}
