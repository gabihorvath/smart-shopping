import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import App from './App.vue'

it('renders the placeholder home page', () => {
  expect(mount(App).text()).toContain('Einkaufsliste')
})
