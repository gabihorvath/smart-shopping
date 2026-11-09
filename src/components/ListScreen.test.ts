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
})
