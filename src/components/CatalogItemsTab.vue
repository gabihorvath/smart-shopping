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
    <div class="px-4 py-2">
      <input
        v-model="query"
        type="search"
        placeholder="Suche…"
        aria-label="Suche"
        data-testid="catalog-search"
        autocomplete="off"
        class="h-12 w-full rounded-xl border-2 border-gray-300 px-3 text-base outline-none focus:border-green-600"
      />
    </div>
    <p v-if="!groups.length" class="px-4 py-8 text-center text-gray-500">Keine Artikel</p>
    <section v-for="g in groups" :key="g.aisle.id" data-testid="catalog-group">
      <h2 class="bg-gray-100 px-4 py-1 text-xs font-semibold tracking-wide text-gray-600 uppercase">
        {{ g.aisle.name }}
      </h2>
      <ul>
        <li
          v-for="i in g.items"
          :key="i.id"
          data-testid="catalog-item"
          :data-name="i.name"
          class="flex min-h-12 items-center pl-4"
        >
          <span class="min-w-0 flex-1 truncate text-base text-gray-900">{{ i.name }}</span>
          <span class="shrink-0 pl-2 text-sm text-gray-500">{{
            store.unitById.get(i.unitId)?.name
          }}</span>
          <button
            type="button"
            :aria-label="`${i.name} bearbeiten`"
            class="flex size-11 shrink-0 items-center justify-center text-gray-600 active:bg-gray-100"
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
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-green-600 text-3xl text-white shadow-lg active:bg-green-700"
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
