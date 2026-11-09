import 'fake-indexeddb/auto'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogTab } from '../composables/catalogTab'
import { currentDialog, settleDialog } from '../composables/useDialog'
import { MSG, useAppStore } from '../stores/app'
import CatalogView from './CatalogView.vue'

// BottomSheet and the dialog host render inside the wrapper / document
async function fresh() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const s = useAppStore()
  await s.init()
  const w = mount(CatalogView, { global: { plugins: [pinia] }, attachTo: document.body })
  return { s, w }
}

async function tab(w: VueWrapper, id: 'items' | 'units' | 'aisles') {
  await w.get(`[data-testid="tab-${id}"]`).trigger('click')
  await flushPromises()
}

const body = () => document.body
const q = (sel: string) => document.body.querySelector<HTMLElement>(sel)!
async function setInput(sel: string, value: string) {
  const el = q(sel) as HTMLInputElement
  el.value = value
  el.dispatchEvent(new Event('input'))
  await flushPromises()
}
/** Click, then wait for the (fake-indexeddb backed) store write and the re-render. */
async function click(el: Element | null) {
  ;(el as HTMLElement).click()
  await settled()
}
/** Flush until the DOM stops changing (no fixed sleeps): async store writes and re-renders are done. */
async function settled() {
  let last = ''
  let stable = 0
  for (let i = 0; i < 200 && stable < 5; i++) {
    await flushPromises()
    const now = document.body.innerHTML
    stable = now === last ? stable + 1 : 0
    last = now
  }
}
const buttonByText = (text: string) =>
  [...body().querySelectorAll('button')].find((b) => b.textContent?.trim() === text) ?? null

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  catalogTab.value = 'items'
  document.body.innerHTML = ''
})

describe('Artikel tab', () => {
  it('lists items grouped by aisle, filters by folded search', async () => {
    const { w } = await fresh()
    expect(w.findAll('[data-testid="catalog-group"]').length).toBeGreaterThan(5)
    await w.get('[data-testid="catalog-search"]').setValue('apfel')
    expect(
      w.findAll('[data-testid="catalog-item"]').map((x) => x.attributes('data-name')),
    ).toContain('Äpfel')
    expect(w.findAll('[data-testid="catalog-item"]').length).toBeLessThan(5)
  })

  it('creates an item and shows a duplicate name error inline', async () => {
    const { s, w } = await fresh()
    await w.get('[data-testid="fab"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="new-item-name"]', 'Zimt')
    await click(buttonByText('Anlegen'))
    expect(s.items.some((i) => i.name === 'Zimt')).toBe(true)
    expect(w.find('[data-testid="catalog-item"][data-name="Zimt"]').exists()).toBe(true)

    await w.get('[data-testid="fab"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="new-item-name"]', 'zimt')
    await click(buttonByText('Anlegen'))
    expect(q('[role="alert"]').textContent).toBe(MSG.nameExists)
  })

  it('edits an item (aisle moves group)', async () => {
    const { s, w } = await fresh()
    const target = s.aisles.find((a) => a.name === 'Getränke')!
    await w.get('[aria-label="Äpfel bearbeiten"]').trigger('click')
    await flushPromises()
    expect((q('[data-testid="new-item-name"]') as HTMLInputElement).value).toBe('Äpfel')
    const sel = q('[data-testid="new-item-aisle"]') as HTMLSelectElement
    sel.value = target.id
    sel.dispatchEvent(new Event('change'))
    await flushPromises()
    await click(buttonByText('Speichern'))
    expect(s.items.find((i) => i.name === 'Äpfel')!.aisleId).toBe(target.id)
  })

  it('delete asks for confirmation; blocked while on the list shows the message', async () => {
    const { s, w } = await fresh()
    const apfel = s.items.find((i) => i.name === 'Äpfel')!
    await s.addItem(apfel.id, 1)
    await w.get('[aria-label="Äpfel bearbeiten"]').trigger('click')
    await flushPromises()
    await click(q('[data-testid="item-delete"]'))
    expect(currentDialog.value?.text).toBe('Artikel „Äpfel“ löschen?')
    settleDialog(true)
    await flushPromises()
    expect(currentDialog.value?.kind).toBe('message')
    expect(currentDialog.value?.text).toBe(MSG.itemOnList)
    settleDialog(true)
    await flushPromises()
    expect(s.items.some((i) => i.id === apfel.id)).toBe(true)

    // cancelled confirm: nothing happens
    await click(q('[data-testid="item-delete"]'))
    settleDialog(false)
    await flushPromises()
    expect(s.items.some((i) => i.id === apfel.id)).toBe(true)

    await s.removeEntry(s.entryByItemId.get(apfel.id)!.id)
    await click(q('[data-testid="item-delete"]'))
    settleDialog(true)
    await flushPromises()
    expect(s.items.some((i) => i.id === apfel.id)).toBe(false)
  })
})

describe('Einheiten tab', () => {
  it('shows steps with decimal comma and creates a unit with step 0,25', async () => {
    const { s, w } = await fresh()
    await tab(w, 'units')
    expect(w.get('[data-testid="unit-row"][data-name="kg"] [data-testid="unit-step"]').text()).toBe(
      '0,5',
    )
    await w.get('[data-testid="fab"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="unit-name"]', 'Becher')
    await setInput('[data-testid="unit-step-input"]', '0,25')
    await click(buttonByText('Anlegen'))
    expect(s.units.find((u) => u.name === 'Becher')!.step).toBe(0.25)
    expect(
      w.get('[data-testid="unit-row"][data-name="Becher"] [data-testid="unit-step"]').text(),
    ).toBe('0,25')
  })

  it('invalid step is marked and disables saving', async () => {
    const { s, w } = await fresh()
    await tab(w, 'units')
    await w.get('[data-testid="fab"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="unit-name"]', 'Becher')
    for (const bad of ['abc', '0', '']) {
      await setInput('[data-testid="unit-step-input"]', bad)
      expect(q('[data-testid="unit-step-input"]').className).toContain('border-red-500')
      expect((buttonByText('Anlegen') as HTMLButtonElement).disabled).toBe(true)
    }
    expect(s.units.some((u) => u.name === 'Becher')).toBe(false)
  })

  it('edits name and step, shows duplicate error', async () => {
    const { s, w } = await fresh()
    await tab(w, 'units')
    await w.get('[aria-label="kg bearbeiten"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="unit-name"]', 'STK')
    await click(buttonByText('Speichern'))
    expect(q('[role="alert"]').textContent).toBe(MSG.nameExists)
    await setInput('[data-testid="unit-name"]', 'Kilo')
    await setInput('[data-testid="unit-step-input"]', '0,1')
    await click(buttonByText('Speichern'))
    const u = s.units.find((x) => x.name === 'Kilo')!
    expect(u.step).toBe(0.1)
  })

  it('editing a unit with step 1000 keeps the step (no grouped text)', async () => {
    const { s, w } = await fresh()
    await s.updateUnit(s.units.find((u) => u.name === 'kg')!.id, { name: 'kg', step: 1000 })
    await tab(w, 'units')
    await w.get('[aria-label="kg bearbeiten"]').trigger('click')
    await flushPromises()
    expect((q('[data-testid="unit-step-input"]') as HTMLInputElement).value).toBe('1000')
    await click(buttonByText('Speichern'))
    expect(s.units.find((u) => u.name === 'kg')!.step).toBe(1000)
  })

  it('blocked delete shows the count', async () => {
    const { s, w } = await fresh()
    await tab(w, 'units')
    const kg = s.units.find((u) => u.name === 'kg')!
    const n = s.items.filter((i) => i.unitId === kg.id).length
    await w.get('[aria-label="kg bearbeiten"]').trigger('click')
    await flushPromises()
    await click(q('[data-testid="unit-delete"]'))
    expect(currentDialog.value?.text).toBe('Einheit „kg“ löschen?')
    settleDialog(true)
    await flushPromises()
    expect(currentDialog.value?.text).toBe(MSG.unitInUse(n))
    settleDialog(true)
    await flushPromises()
    expect(s.units.some((u) => u.id === kg.id)).toBe(true)
  })

  it('deletes an unused unit', async () => {
    const { s, w } = await fresh()
    await s.createUnit('Leer', 1)
    await tab(w, 'units')
    await w.get('[aria-label="Leer bearbeiten"]').trigger('click')
    await flushPromises()
    await click(q('[data-testid="unit-delete"]'))
    settleDialog(true)
    await flushPromises()
    expect(s.units.some((u) => u.name === 'Leer')).toBe(false)
  })
})

describe('Gänge tab', () => {
  it('lists aisles in sortKey order with item counts', async () => {
    const { s, w } = await fresh()
    await tab(w, 'aisles')
    const rows = w.findAll('[data-testid="aisle-row"]')
    expect(rows).toHaveLength(s.aisles.length)
    const first = [...s.aisles].sort((a, b) => a.sortKey - b.sortKey)[0]!
    expect(rows[0]!.attributes('data-name')).toBe(first.name)
    expect(rows[0]!.get('[data-testid="aisle-count"]').text()).toBe(
      String(s.items.filter((i) => i.aisleId === first.id).length),
    )
  })

  it('creates an aisle (last, not in shops), renames, shows duplicate error', async () => {
    const { s, w } = await fresh()
    await tab(w, 'aisles')
    await w.get('[data-testid="fab"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="aisle-name"]', 'Drogerie')
    await click(buttonByText('Anlegen'))
    const rows = w.findAll('[data-testid="aisle-row"]')
    expect(rows[rows.length - 1]!.attributes('data-name')).toBe('Drogerie')
    const a = s.aisles.find((x) => x.name === 'Drogerie')!
    expect(s.shops.every((sh) => !sh.aisleIds.includes(a.id))).toBe(true)

    await w.get('[aria-label="Drogerie bearbeiten"]').trigger('click')
    await flushPromises()
    await setInput('[data-testid="aisle-name"]', 'getränke')
    await click(buttonByText('Speichern'))
    expect(q('[role="alert"]').textContent).toBe(MSG.nameExists)
    await setInput('[data-testid="aisle-name"]', 'Haushalt')
    await click(buttonByText('Speichern'))
    expect(s.aisleById.get(a.id)!.name).toBe('Haushalt')
  })

  it('blocked delete shows the count; unused aisle is removed from shops', async () => {
    const { s, w } = await fresh()
    await tab(w, 'aisles')
    const obst = s.aisles.find((a) => a.name === 'Obst & Gemüse')!
    const n = s.items.filter((i) => i.aisleId === obst.id).length
    await w.get('[aria-label="Obst & Gemüse bearbeiten"]').trigger('click')
    await flushPromises()
    await click(q('[data-testid="aisle-delete"]'))
    settleDialog(true)
    await flushPromises()
    expect(currentDialog.value?.text).toBe(MSG.aisleInUse(n))
    settleDialog(true)
    await flushPromises()
    expect(s.aisleById.has(obst.id)).toBe(true)

    const r = await s.createAisle('Leer')
    if (!r.ok) throw new Error('create failed')
    await w.get('[aria-label="Leer bearbeiten"]').trigger('click')
    await flushPromises()
    await click(q('[data-testid="aisle-delete"]'))
    expect(currentDialog.value?.text).toBe('Gang „Leer“ löschen?')
    settleDialog(true)
    await flushPromises()
    expect(s.aisleById.has(r.aisle.id)).toBe(false)
  })
})

describe('tab memory', () => {
  it('remembers the selected tab across remounts', async () => {
    const { w } = await fresh()
    await tab(w, 'aisles')
    w.unmount()
    const w2 = mount(CatalogView, { global: { plugins: [getActivePinia()!] } })
    expect(w2.find('[data-testid="aisle-list"]').exists()).toBe(true)
  })
})
