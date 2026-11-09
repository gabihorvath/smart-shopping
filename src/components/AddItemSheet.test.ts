import 'fake-indexeddb/auto'
import { flushPromises, mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { currentDialog } from '../composables/useDialog'
import { snackbars } from '../composables/useSnackbars'
import { useAppStore } from '../stores/app'
import AddItemSheet from './AddItemSheet.vue'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  document.body.innerHTML = ''
  snackbars.value = []
})

describe('AddItemSheet', () => {
  it('a double tap on Hinzufügen adds once and shows no bogus "Menge addieren?" prompt', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const s = useAppStore()
    await s.init()
    const w = mount(AddItemSheet, {
      props: { modelValue: true },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
    await flushPromises()
    const milch = s.items.find((i) => i.name === 'Milch')!
    const row = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith('Milch'),
    )!
    row.click()
    await flushPromises()
    const add = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Hinzufügen',
    )!
    add.click()
    add.click()
    await flushPromises()
    await flushPromises()
    expect(currentDialog.value).toBeNull()
    expect(s.entries.filter((e) => e.itemId === milch.id)).toHaveLength(1)
    w.unmount()
  })

  it('shows an action-less snackbar after a successful add', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const s = useAppStore()
    await s.init()
    const w = mount(AddItemSheet, {
      props: { modelValue: true },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
    await flushPromises()
    const buttons = () => [...document.body.querySelectorAll('button')]
    buttons()
      .find((b) => b.textContent?.trim().startsWith('Milch'))!
      .click()
    await flushPromises()
    buttons()
      .find((b) => b.textContent?.trim() === 'Hinzufügen')!
      .click()
    await flushPromises()
    await flushPromises()
    expect(snackbars.value).toHaveLength(1)
    expect(snackbars.value[0]!.text).toBe('„Milch“ ist auf der Liste ✓')
    expect(snackbars.value[0]!.actionLabel).toBeUndefined()
    w.unmount()
  })
})
