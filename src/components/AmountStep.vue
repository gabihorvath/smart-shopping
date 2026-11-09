<script setup lang="ts">
import { computed, ref } from 'vue'
import { validateAmount } from '../domain/amount'
import AmountInput from './ui/AmountInput.vue'

/** Item name / aisle / amount editor with a confirm button. Used by the add flow and the amount sheet. */
const props = defineProps<{
  name: string
  aisleName: string
  unitName: string
  step: number
  /** Initial amount; defaults to one step. */
  initial?: number
  confirmLabel: string
  error?: string | null
  showBack?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ confirm: [amount: number]; back: [] }>()

const value = ref<number | null>(props.initial ?? props.step)
// An invalid initial value (e.g. below a raised step) is shown red by AmountInput and must not be confirmable.
const valid = computed(() => value.value !== null && validateAmount(value.value, props.step))

function submit() {
  if (valid.value && !props.busy) emit('confirm', value.value!)
}
</script>

<template>
  <div class="pt-1 pb-2">
    <p class="text-sm text-gray-500">{{ aisleName }}</p>
    <p class="text-xl font-semibold text-gray-900">{{ name }}</p>
    <div class="mt-5">
      <AmountInput v-model="value" :unit-name="unitName" :step="step" />
    </div>
    <p v-if="error" class="mt-3 text-center text-sm text-red-600" role="alert">{{ error }}</p>
    <div class="mt-6 flex gap-2">
      <button
        v-if="showBack"
        type="button"
        class="min-h-12 rounded-xl px-4 font-medium text-gray-700 active:bg-gray-100"
        @click="emit('back')"
      >
        Zurück
      </button>
      <button
        type="button"
        :disabled="!valid || busy"
        class="min-h-12 flex-1 rounded-xl bg-green-600 font-semibold text-white active:bg-green-700 disabled:bg-gray-300"
        @click="submit"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</template>
