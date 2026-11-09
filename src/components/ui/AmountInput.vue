<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parseAmount, stepDown, stepUp, toInputText, validateAmount } from '../../domain/amount'
import PlusIcon from './PlusIcon.vue'

const props = defineProps<{
  /** Parsed amount, or null while the text is invalid. */
  modelValue: number | null
  unitName: string
  step: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const toText = toInputText

const text = ref(props.modelValue == null ? '' : toText(props.modelValue))

function parse(s: string): number | null {
  const n = parseAmount(s)
  return n !== null && validateAmount(n, props.step) ? n : null
}

const invalid = computed(() => parse(text.value) === null)

watch(
  () => props.modelValue,
  (v) => {
    if (v !== null && v !== parse(text.value)) text.value = toText(v)
  },
)

function onInput(e: Event) {
  text.value = (e.target as HTMLInputElement).value
  emit('update:modelValue', parse(text.value))
}

function bump(dir: 1 | -1) {
  const cur = parse(text.value) ?? props.step
  const next = dir === 1 ? stepUp(cur, props.step) : stepDown(cur, props.step)
  text.value = toText(next)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="flex items-center justify-center gap-2">
    <button
      type="button"
      aria-label="Weniger"
      class="flex size-12 items-center justify-center rounded-xl bg-cream-deep text-2xl font-semibold text-ink active:bg-line"
      @click="bump(-1)"
    >
      <PlusIcon minus />
    </button>
    <input
      :value="text"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      aria-label="Menge"
      :aria-invalid="invalid"
      data-testid="amount-input"
      class="h-12 w-28 rounded-xl border-2 px-3 text-center text-xl font-semibold text-ink outline-none"
      :class="
        invalid
          ? 'border-red-600 bg-red-50'
          : 'border-line bg-card focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15'
      "
      @input="onInput"
    />
    <span class="w-14 text-lg text-ink-muted">{{ unitName }}</span>
    <button
      type="button"
      aria-label="Mehr"
      class="flex size-12 items-center justify-center rounded-xl bg-cream-deep text-2xl font-semibold text-ink active:bg-line"
      @click="bump(1)"
    >
      <PlusIcon />
    </button>
  </div>
</template>
