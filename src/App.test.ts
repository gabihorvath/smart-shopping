import 'fake-indexeddb/auto'
import { mount } from '@vue/test-utils'
import { IDBFactory } from 'fake-indexeddb'
import { createPinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App.vue'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

it('shows loading, then the list for the seeded default shop', async () => {
  const w = mount(App, { global: { plugins: [createPinia()] } })
  expect(w.text()).toContain('Lade')
  await vi.waitFor(() => expect(w.text()).not.toContain('Lade'))
  expect(w.text()).toContain('Standard')
  expect(w.text()).toContain('Die Liste ist leer')
})
