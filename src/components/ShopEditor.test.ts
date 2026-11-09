import 'fake-indexeddb/auto'
import { flushPromises, mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentDialog, settleDialog } from '../composables/useDialog'
import { useAppStore } from '../stores/app'
import ShopEditor from './ShopEditor.vue'

async function fresh() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const s = useAppStore()
  await s.init()
  const w = mount(ShopEditor, {
    props: { shopId: s.activeShopId! },
    global: { plugins: [pinia] },
  })
  return { s, w }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('ShopEditor', () => {
  it('unchecking moves an aisle to the lower group, checking appends it to the end', async () => {
    const { s, w } = await fresh()
    const shopId = s.activeShopId!
    const obst = s.aisles.find((a) => a.name === 'Obst & Gemüse')!
    const total = s.shopById.get(shopId)!.aisleIds.length
    expect(w.findAll('[data-testid="included-aisle"]')).toHaveLength(total)

    await w.get('[data-testid="included-aisle"][data-name="Obst & Gemüse"] button').trigger('click')
    await flushPromises()
    expect(s.shopById.get(shopId)!.aisleIds).not.toContain(obst.id)
    expect(w.findAll('[data-testid="included-aisle"]')).toHaveLength(total - 1)
    expect(w.get('[data-testid="excluded-aisle"]').text()).toContain('Obst & Gemüse')

    await w.get('[data-testid="excluded-aisle"] button').trigger('click')
    await flushPromises()
    const ids = s.shopById.get(shopId)!.aisleIds
    expect(ids[ids.length - 1]).toBe(obst.id)
    const names = w.findAll('[data-testid="included-aisle"]')
    expect(names[names.length - 1]!.attributes('data-name')).toBe('Obst & Gemüse')
    expect(w.findAll('[data-testid="excluded-aisle"]')).toHaveLength(0)
  })

  it('renames on blur and shows the store error for a duplicate', async () => {
    const { s, w } = await fresh()
    await s.createShop('Rewe')
    const input = w.get('[data-testid="shop-name"]')
    await input.setValue('Edeka')
    await input.trigger('blur')
    await flushPromises()
    expect(s.activeShop!.name).toBe('Edeka')
    await input.setValue('rewe')
    await input.trigger('blur')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Name existiert schon.')
    expect(s.activeShop!.name).toBe('Edeka')
  })

  it('delete on the last shop shows the message and keeps the shop', async () => {
    const { s, w } = await fresh()
    const buttons = w.findAll('header button')
    await buttons.find((b) => b.text() === 'Löschen')!.trigger('click')
    await flushPromises()
    expect(currentDialog.value?.kind).toBe('message')
    expect(currentDialog.value?.text).toBe('Mindestens ein Laden muss bleiben')
    settleDialog(true)
    expect(s.shops).toHaveLength(1)
  })

  it('delete asks for confirmation, deletes and emits back', async () => {
    const { s, w } = await fresh()
    await s.createShop('Rewe')
    const rewe = s.shops.find((x) => x.name === 'Rewe')!
    await w.setProps({ shopId: rewe.id })
    await w
      .findAll('header button')
      .find((b) => b.text() === 'Löschen')!
      .trigger('click')
    await flushPromises()
    expect(currentDialog.value?.text).toBe('Laden „Rewe“ löschen?')
    settleDialog(true)
    await vi.waitFor(() => expect(w.emitted('back')).toHaveLength(1))
    expect(s.shops.map((x) => x.name)).toEqual(['Standard'])
  })
})
