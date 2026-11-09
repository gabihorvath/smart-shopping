<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parseAmount, stepDown, stepUp, toInputText, validateAmount } from '../../domain/amount'

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
      class="flex size-12 items-center justify-center rounded-xl bg-gray-100 text-2xl text-gray-800 active:bg-gray-200"
      @click="bump(-1)"
    >
      −
    </button>
    <input
      :value="text"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      aria-label="Menge"
      :aria-invalid="invalid"
      data-testid="amount-input"
      class="h-12 w-28 rounded-xl border-2 px-3 text-center text-xl outline-none"
      :class="
        invalid ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white focus:border-green-600'
      "
      @input="onInput"
    />
    <span class="w-14 text-lg text-gray-700">{{ unitName }}</span>
    <button
      type="button"
      aria-label="Mehr"
      class="flex size-12 items-center justify-center rounded-xl bg-gray-100 text-2xl text-gray-800 active:bg-gray-200"
      @click="bump(1)"
    >
      +
    </button>
  </div>
</template>
