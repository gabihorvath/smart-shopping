<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialog } from '../composables/useDialog'
import type { CatalogItem } from '../domain/types'
import { buildCatalogGlobal } from '../domain/view'
import { useAppStore } from '../stores/app'
import NewItemForm from './NewItemForm.vue'
import BottomSheet from './ui/BottomSheet.vue'

const store = useAppStore()
const dialog = useDialog()

const query = ref('')
const sheetOpen = ref(false)
const editing = ref<CatalogItem | null>(null)

const groups = computed(() => buildCatalogGlobal(store.items, store.aisles, query.value))

function openNew() {
  editing.value = null
  sheetOpen.value = true
}
function openEdit(item: CatalogItem) {
  editing.value = item
  sheetOpen.value = true
}

async function remove() {
  const item = editing.value
  if (!item) return
  const ok = await dialog.confirm(`Artikel „${item.name}“ löschen?`, { okLabel: 'Löschen' })
  if (!ok) return
  const r = await store.deleteItem(item.id)
  if (!r.ok) await dialog.message(r.error)
  else sheetOpen.value = false
}
</script>

<template>
  <div>
    <div class="px-4 pt-1 pb-2">
      <input
        v-model="query"
        type="search"
        placeholder="Suche…"
        aria-label="Suche"
        data-testid="catalog-search"
        autocomplete="off"
        class="h-12 w-full rounded-xl border-2 border-line bg-card px-4 text-base text-ink outline-none placeholder:text-ink-muted focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
      />
    </div>
    <p v-if="!groups.length" class="px-4 py-8 text-center text-ink-muted">Keine Artikel</p>
    <section v-for="g in groups" :key="g.aisle.id" data-testid="catalog-group">
      <h2 class="px-5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {{ g.aisle.name }}
      </h2>
      <ul class="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-card">
        <li
          v-for="i in g.items"
          :key="i.id"
          data-testid="catalog-item"
          :data-name="i.name"
          class="flex min-h-12 items-center pl-4"
        >
          <span class="min-w-0 flex-1 truncate text-base text-ink">{{ i.name }}</span>
          <span class="shrink-0 pl-2 text-sm text-ink-muted">{{
            store.unitById.get(i.unitId)?.name
          }}</span>
          <button
            type="button"
            :aria-label="`${i.name} bearbeiten`"
            class="flex size-11 shrink-0 items-center justify-center text-ink-muted active:bg-cream-deep"
            @click="openEdit(i)"
          >
            ✎
          </button>
        </li>
      </ul>
    </section>

    <button
      type="button"
      aria-label="Artikel anlegen"
      data-testid="fab"
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-coral-500 text-3xl text-white shadow-fab transition active:scale-95 active:bg-coral-600"
      @click="openNew"
    >
      +
    </button>

    <BottomSheet v-model="sheetOpen" :title="editing ? 'Artikel bearbeiten' : 'Neuer Artikel'">
      <NewItemForm
        :key="editing?.id ?? 'new'"
        :initial-name="editing?.name ?? ''"
        :item="editing ?? undefined"
        cancel-label="Abbrechen"
        @created="sheetOpen = false"
        @cancel="sheetOpen = false"
        @delete="remove"
      />
    </BottomSheet>
  </div>
</template>
