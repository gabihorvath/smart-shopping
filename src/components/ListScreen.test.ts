import 'fake-indexeddb/auto'
import { flushPromises, mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../stores/app'
import ListScreen from './ListScreen.vue'

async function fresh() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const s = useAppStore()
  await s.init()
  return { s, pinia }
}
const idOf = (s: ReturnType<typeof useAppStore>, name: string) =>
  s.items.find((i) => i.name === name)!.id

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('ListScreen', () => {
  it('shows the empty state and the shop name', async () => {
    const { pinia } = await fresh()
    const w = mount(ListScreen, { global: { plugins: [pinia] } })
    expect(w.text()).toContain('Die Liste ist leer')
    expect(w.get('[data-testid="shop-selector"]').text()).toContain('Standard')
  })

  it('renders open groups, the not-in-shop section and a collapsed done section', async () => {
    const { s, pinia } = await fresh()
    const salz = s.items.find((i) => i.name === 'Salz')!
    const shop = s.activeShop!
    await s.setShopAisles(
      shop.id,
      shop.aisleIds.filter((id) => id !== salz.aisleId),
    )
    await s.addItem(idOf(s, 'Äpfel'), 1.5)
    await s.addItem(idOf(s, 'Butter'), 2)
    await s.addItem(salz.id, 1)
    await s.addItem(idOf(s, 'Milch'), 2)
    await s.toggleChecked(s.entryByItemId.get(idOf(s, 'Milch'))!.id)

    const w = mount(ListScreen, { global: { plugins: [pinia] } })
    const text = w.text()
    expect(text).not.toContain('Die Liste ist leer')
    // open groups in shop order, then the dimmed section
    expect(text.indexOf('Obst & Gemüse')).toBeLessThan(text.indexOf('Milchprodukte & Eier'))
    expect(text).toContain('Äpfel')
    expect(text).toContain('1,5 kg')
    const notInShop = w.get('[data-testid="not-in-shop"]')
    expect(notInShop.text()).toContain('Nicht in diesem Laden')
    expect(notInShop.text()).toContain('Salz')
    expect(notInShop.classes()).toContain('opacity-60')
    // done: collapsed with count, rows hidden until expanded
    const done = w.get('[data-testid="done"]')
    expect(done.text()).toContain('Erledigt (1)')
    expect(done.text()).not.toContain('Milch')
    await done.get('button[aria-expanded]').trigger('click')
    expect(w.get('[data-testid="done"]').text()).toContain('Milch')
    // checked rows have no remove button
    expect(w.get('[data-testid="done"]').find('[aria-label$="entfernen"]').exists()).toBe(false)
  })

  it('check button moves a row to Erledigt', async () => {
    const { s, pinia } = await fresh()
    await s.addItem(idOf(s, 'Brot'), 1)
    const w = mount(ListScreen, { global: { plugins: [pinia] } })
    await w.get('[aria-label="Brot abhaken"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="done"]').text()).toContain('Erledigt (1)')
    expect(s.entries[0]!.checked).toBe(true)
  })

  it('tapping the item name toggles open and checked rows, not the amount button', async () => {
    const { s, pinia } = await fresh()
    await s.addItem(idOf(s, 'Brot'), 1)
    const w = mount(ListScreen, { global: { plugins: [pinia] } })
    await w.get('[data-testid="amount-btn"]').trigger('click')
    expect(s.entries[0]!.checked).toBe(false)
    await w.get('[data-testid="row-name"]').trigger('click')
    await flushPromises()
    expect(s.entries[0]!.checked).toBe(true)
    await w.get('[data-testid="done"] button[aria-expanded]').trigger('click')
    await w.get('[data-testid="row-name"]').trigger('click')
    await flushPromises()
    expect(s.entries[0]!.checked).toBe(false)
  })

  it('a click right after a swipe gesture does not toggle', async () => {
    const { s, pinia } = await fresh()
    await s.addItem(idOf(s, 'Brot'), 1)
    const w = mount(ListScreen, { global: { plugins: [pinia] }, attachTo: document.body })
    const el = w.get('[data-testid="list-row"] > div.relative')
    el.element.setPointerCapture = () => {}
    Object.defineProperty(el.element, 'offsetWidth', { value: 1000 }) // threshold 110px
    const ev = (type: string, x: number) =>
      el.element.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: 0, pointerId: 1 }),
      )
    ev('pointerdown', 200)
    ev('pointermove', 150) // dx -50: swipe starts but stays below the remove threshold
    ev('pointerup', 150)
    await w.get('[data-testid="row-name"]').trigger('click')
    await flushPromises()
    expect(s.entries[0]!.checked).toBe(false)
    await w.get('[data-testid="row-name"]').trigger('click') // a genuine tap afterwards
    await flushPromises()
    expect(s.entries[0]!.checked).toBe(true)
    w.unmount()
  })
})
