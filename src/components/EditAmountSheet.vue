<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import AmountStep from './AmountStep.vue'
import BottomSheet from './ui/BottomSheet.vue'

/** Amount sheet for an existing list entry. Saving reopens a checked entry. */
const props = defineProps<{ entryId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()
const error = ref<string | null>(null)

const info = computed(() => {
  const entry = props.entryId ? store.entryById.get(props.entryId) : undefined
  const item = entry && store.itemById.get(entry.itemId)
  const unit = item && store.unitById.get(item.unitId)
  const aisle = item && store.aisleById.get(item.aisleId)
  return entry && item && unit && aisle ? { entry, item, unit, aisle } : null
})

watch(
  () => props.entryId,
  () => (error.value = null),
)

async function save(amount: number) {
  if (!info.value) return
  const r = await store.setAmount(info.value.entry.id, amount)
  if (r.ok) emit('close')
  else error.value = r.error
}
</script>

<template>
  <BottomSheet
    :model-value="info !== null"
    :title="info?.item.name"
    @update:model-value="emit('close')"
  >
    <AmountStep
      v-if="info"
      :key="info.entry.id"
      :name="info.item.name"
      :aisle-name="info.aisle.name"
      :unit-name="info.unit.name"
      :step="info.unit.step"
      :initial="info.entry.amount"
      confirm-label="Speichern"
      :error="error"
      @confirm="save"
    />
  </BottomSheet>
</template>
