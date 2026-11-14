<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { pendingImport, useShare, type ImportMode } from '../composables/useShare'
import { formatAmount } from '../domain/amount'
import { namesEqual } from '../domain/text'
import { useAppStore } from '../stores/app'
import BottomSheet from './ui/BottomSheet.vue'

/** Preview and confirmation for an opened share link. Nothing changes before "Importieren". */
const store = useAppStore()
const { runImport } = useShare()

const mode = ref<ImportMode>('add')
const busy = ref(false)
const items = computed(() => pendingImport.value ?? [])

/** The add / keep choice only matters if something shared is already open on the list. */
const hasOpenOverlap = computed(() =>
  items.value.some((s) => {
    const item = store.items.find((i) => namesEqual(i.name, s.name))
    const entry = item && store.entryByItemId.get(item.id)
    return !!entry && !entry.checked
  }),
)

watch(pendingImport, () => (mode.value = 'add'))

function close() {
  pendingImport.value = null
}

async function confirm() {
  if (busy.value) return
  busy.value = true
  try {
    await runImport(mode.value)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet
    :model-value="pendingImport !== null"
    :title="`${items.length} Artikel importieren`"
    @update:model-value="close"
  >
    <ul class="divide-y divide-line" data-testid="import-preview">
      <li v-for="s in items" :key="s.name" class="flex min-h-11 items-center justify-between gap-3">
        <span class="min-w-0 truncate text-ink">{{ s.name }}</span>
        <span class="shrink-0 text-ink-muted">{{ formatAmount(s.amount) }} {{ s.unit }}</span>
      </li>
    </ul>

    <fieldset v-if="hasOpenOverlap" class="mt-4">
      <legend class="mb-1 text-sm font-semibold text-ink-muted">
        Schon offen auf deiner Liste
      </legend>
      <label class="flex min-h-11 items-center gap-3">
        <input v-model="mode" type="radio" value="add" class="size-5" />
        Mengen addieren
      </label>
      <label class="flex min-h-11 items-center gap-3">
        <input v-model="mode" type="radio" value="keep" class="size-5" />
        Meine Mengen behalten
      </label>
    </fieldset>

    <div class="mt-5 flex gap-2">
      <button
        type="button"
        class="min-h-12 flex-1 rounded-xl bg-cream-deep font-semibold text-ink active:bg-line"
        @click="close"
      >
        Abbrechen
      </button>
      <button
        type="button"
        data-testid="import-confirm"
        :disabled="busy"
        class="min-h-12 flex-1 rounded-xl bg-coral-500 font-semibold text-white active:bg-coral-600 disabled:opacity-60"
        @click="confirm"
      >
        Importieren
      </button>
    </div>
  </BottomSheet>
</template>
