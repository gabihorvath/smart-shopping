import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AmountStep from './AmountStep.vue'

const base = { name: 'Reis', aisleName: 'Gang', unitName: 'kg', step: 1, confirmLabel: 'OK' }
const btn = (w: ReturnType<typeof mount>) => w.get('button.bg-green-600')

describe('AmountStep', () => {
  it('disables confirm for an invalid initial amount (below step)', () => {
    const w = mount(AmountStep, { props: { ...base, initial: 0.5 } })
    expect(w.get('[data-testid="amount-input"]').classes()).toContain('border-red-500')
    expect(btn(w).attributes('disabled')).toBeDefined()
  })

  it('enables confirm for a valid amount and emits it once', async () => {
    const w = mount(AmountStep, { props: { ...base, initial: 2 } })
    expect(btn(w).attributes('disabled')).toBeUndefined()
    await btn(w).trigger('click')
    expect(w.emitted('confirm')).toEqual([[2]])
  })

  it('disables confirm while busy', async () => {
    const w = mount(AmountStep, { props: { ...base, initial: 2, busy: true } })
    expect(btn(w).attributes('disabled')).toBeDefined()
    await btn(w).trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })
})
