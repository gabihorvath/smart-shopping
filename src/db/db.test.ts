import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, writeBatch } from './db'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})
describe('writeBatch', () => {
  it('rejects with the original error and leaves no unhandled rejection (vitest fails the run on one)', async () => {
    const db = await openDatabase()
    const e = (id: string) => ({ id, itemId: 'same', amount: 1, checked: false, checkedAt: null })
    // two entries with the same unique itemId -> ConstraintError
    await expect(writeBatch(db, { entries: { put: [e('a'), e('b')] } })).rejects.toBeDefined()
    await new Promise((r) => setTimeout(r, 20))
    expect(await db.getAll('entries')).toEqual([])
    db.close()
  })
})
