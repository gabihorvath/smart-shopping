<script setup lang="ts">
import type { AisleGroup, ListRow as Row } from '../domain/view'
import ListRow from './ListRow.vue'

defineProps<{ groups: AisleGroup[]; highlightIds: ReadonlySet<string> }>()
const emit = defineEmits<{ toggle: [row: Row]; amount: [row: Row]; remove: [row: Row] }>()
</script>

<template>
  <section v-for="g in groups" :key="g.aisle.id" data-testid="aisle-group">
    <h3 class="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
      {{ g.aisle.name }}
    </h3>
    <ul class="px-2">
      <ListRow
        v-for="r in g.rows"
        :key="r.entry.id"
        :row="r"
        :highlight="highlightIds.has(r.entry.id)"
        @toggle="emit('toggle', r)"
        @amount="emit('amount', r)"
        @remove="emit('remove', r)"
      />
    </ul>
  </section>
</template>
