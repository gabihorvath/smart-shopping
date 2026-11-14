import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeShare } from '../domain/share'
import { useAppStore } from '../stores/app'
import { currentDialog, settleChoice, settleDialog } from './useDialog'
import { snackbars } from './useSnackbars'
import { captureImportHash, pendingImport, useShare } from './useShare'

async function fresh() {
  setActivePinia(createPinia())
  const s = useAppStore()
  await s.init()
  return s
}

const itemNamed = (s: ReturnType<typeof useAppStore>, n: string) =>
  s.items.find((i) => i.name === n)!

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  pendingImport.value = null
  snackbars.value = []
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  while (currentDialog.value) settleDialog(false)
})

describe('share list', () => {
  it('shares only open entries', async () => {
    const s = await fresh()
    await s.addItem(itemNamed(s, 'Äpfel').id, 2)
    await s.addItem(itemNamed(s, 'Milch').id, 1)
    await s.toggleChecked(s.entryByItemId.get(itemNamed(s, 'Milch').id)!.id)
    expect(s.shareItems()).toEqual([
      expect.objectContaining({ name: 'Äpfel', amount: 2, unit: 'kg', aisle: 'Obst & Gemüse' }),
    ])
  })
})

describe('import link in the hash', () => {
  it('clears the hash and opens the sheet for a valid link', async () => {
    await fresh()
    const items = [{ name: 'Äpfel', amount: 1, unit: 'kg', aisle: 'Obst & Gemüse' }]
    window.location.hash = `#import=${encodeShare(items)}`
    captureImportHash()
    expect(window.location.hash).toBe('')
    expect(pendingImport.value).toEqual(items)
  })

  it('shows "Link ungültig." for a damaged link and changes nothing', async () => {
    await fresh()
    window.location.hash = '#import=%%%'
    captureImportHash()
    expect(window.location.hash).toBe('')
    expect(pendingImport.value).toBeNull()
    expect(currentDialog.value?.text).toBe('Link ungültig.')
  })

  it('ignores other hashes', () => {
    window.location.hash = '#something'
    captureImportHash()
    expect(window.location.hash).toBe('#something')
    expect(currentDialog.value).toBeNull()
  })
})

describe('runImport', () => {
  const shared = [
    { name: 'Äpfel', amount: 2, unit: 'kg', aisle: 'Obst & Gemüse' },
    { name: 'Milch', amount: 3, unit: 'l', aisle: 'Milchprodukte & Eier' },
    { name: 'Butter', amount: 250, unit: 'g', aisle: 'Milchprodukte & Eier' },
    { name: 'Zzz Neu', amount: 1, unit: 'Stk', aisle: 'Obst & Gemüse' },
  ]

  async function setup() {
    const s = await fresh()
    await s.addItem(itemNamed(s, 'Äpfel').id, 1) // open
    await s.addItem(itemNamed(s, 'Milch').id, 1)
    await s.toggleChecked(s.entryByItemId.get(itemNamed(s, 'Milch').id)!.id) // checked
    pendingImport.value = shared
    return s
  }

  async function answer(value: string) {
    await vi.waitFor(() => expect(currentDialog.value?.kind).toBe('choice'))
    settleChoice(value)
  }

  it('applies known items, then asks once per clash and unknown item', async () => {
    const s = await setup()
    const done = useShare().runImport('add')
    await answer('skip') // Butter: unit clash
    await answer('yes') // Zzz Neu: create
    await done

    expect(s.entryByItemId.get(itemNamed(s, 'Äpfel').id)).toMatchObject({ amount: 3 })
    expect(s.entryByItemId.get(itemNamed(s, 'Milch').id)).toMatchObject({
      amount: 3,
      checked: false,
    })
    expect(s.entryByItemId.has(itemNamed(s, 'Butter').id)).toBe(false)
    expect(s.entryByItemId.get(itemNamed(s, 'Zzz Neu').id)).toMatchObject({ amount: 1 })
    expect(pendingImport.value).toBeNull()
    expect(snackbars.value.at(-1)?.text).toBe('3 Artikel importiert, 1 übersprungen')
    expect(s.writeError).toBeNull()
  })

  it('keep mode leaves open amounts alone', async () => {
    const s = await setup()
    const done = useShare().runImport('keep')
    await answer('skip')
    await answer('skip')
    await done
    expect(s.entryByItemId.get(itemNamed(s, 'Äpfel').id)).toMatchObject({ amount: 1 })
    expect(s.entryByItemId.get(itemNamed(s, 'Milch').id)).toMatchObject({ checked: false })
    expect(s.items.some((i) => i.name === 'Zzz Neu')).toBe(false)
  })

  it('Abbrechen stops, applied items stay', async () => {
    const s = await setup()
    const done = useShare().runImport('add')
    await answer('cancel')
    await done
    expect(s.entryByItemId.get(itemNamed(s, 'Äpfel').id)).toMatchObject({ amount: 3 })
    expect(s.items.some((i) => i.name === 'Zzz Neu')).toBe(false)
    expect(snackbars.value.at(-1)?.text).toBe('2 Artikel importiert, abgebrochen')
  })

  it('Übernehmen applies the number in the receiver unit', async () => {
    const s = await setup()
    const done = useShare().runImport('add')
    await answer('yes') // Butter 250 → Stk
    await answer('skip')
    await done
    expect(s.entryByItemId.get(itemNamed(s, 'Butter').id)).toMatchObject({ amount: 250 })
  })
})
