<script setup lang="ts">
import type { AisleGroup, ListRow as Row } from '../domain/view'
import ListRow from './ListRow.vue'

defineProps<{ groups: AisleGroup[]; highlightIds: ReadonlySet<string> }>()
const emit = defineEmits<{ toggle: [row: Row]; amount: [row: Row]; remove: [row: Row] }>()
</script>

<template>
  <section v-for="g in groups" :key="g.aisle.id" class="mb-4" data-testid="aisle-group">
    <h3 class="px-8 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
      {{ g.aisle.name }}
    </h3>
    <ul class="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-card">
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
