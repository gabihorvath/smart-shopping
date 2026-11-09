import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AmountInput from './AmountInput.vue'

function make(modelValue: number | null, step = 0.5) {
  return mount(AmountInput, { props: { modelValue, unitName: 'kg', step } })
}
const last = (w: ReturnType<typeof make>) => w.emitted('update:modelValue')!.at(-1)![0]

describe('AmountInput', () => {
  it('shows the initial value with a decimal comma and the unit', () => {
    const w = make(1.5)
    expect((w.get('input').element as HTMLInputElement).value).toBe('1,5')
    expect(w.text()).toContain('kg')
    expect(w.get('input').attributes('inputmode')).toBe('decimal')
  })

  it('parses comma input and emits the number', async () => {
    const w = make(0.5)
    await w.get('input').setValue('2,25')
    expect(last(w)).toBe(2.25)
    expect(w.get('input').classes()).not.toContain('border-red-600')
  })

  it('marks invalid input red and emits null', async () => {
    const w = make(0.5)
    for (const bad of ['', 'abc', '0', '-1', '0,3']) {
      await w.get('input').setValue(bad)
      expect(last(w)).toBeNull()
      expect(w.get('input').classes()).toContain('border-red-600')
    }
  })

  it('minimum is the step: minus never goes below it', async () => {
    const w = make(0.5)
    await w.get('[aria-label="Weniger"]').trigger('click')
    expect(last(w)).toBe(0.5)
    await w.get('[aria-label="Mehr"]').trigger('click')
    expect(last(w)).toBe(1)
    await w.get('[aria-label="Weniger"]').trigger('click')
    expect(last(w)).toBe(0.5)
  })

  it('recovers from invalid text with the buttons', async () => {
    const w = make(1, 100)
    await w.get('input').setValue('x')
    await w.get('[aria-label="Mehr"]').trigger('click')
    expect(last(w)).toBe(200)
    expect((w.get('input').element as HTMLInputElement).value).toBe('200')
  })
})
