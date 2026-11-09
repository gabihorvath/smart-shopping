<script setup lang="ts">
import { catalogTab, type CatalogTab } from '../composables/catalogTab'
import { useAppStore } from '../stores/app'
import CatalogAislesTab from './CatalogAislesTab.vue'
import CatalogItemsTab from './CatalogItemsTab.vue'
import CatalogUnitsTab from './CatalogUnitsTab.vue'

const store = useAppStore()

const tabs: { id: CatalogTab; label: string }[] = [
  { id: 'items', label: 'Artikel' },
  { id: 'units', label: 'Einheiten' },
  { id: 'aisles', label: 'Gänge' },
]
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-white">
    <header
      class="sticky top-0 z-20 bg-green-600 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white"
    >
      <div class="flex items-center gap-1 pb-1">
        <button
          type="button"
          aria-label="Zurück"
          class="flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl active:bg-green-700"
          @click="store.setView('list')"
        >
          ‹
        </button>
        <h1 class="text-lg font-semibold">Katalog</h1>
      </div>
      <div role="tablist" class="flex">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="catalogTab === t.id"
          :data-testid="`tab-${t.id}`"
          class="min-h-11 flex-1 border-b-4 font-medium"
          :class="catalogTab === t.id ? 'border-white' : 'border-transparent text-green-100'"
          @click="catalogTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
    </header>

    <main class="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <CatalogItemsTab v-if="catalogTab === 'items'" />
      <CatalogUnitsTab v-else-if="catalogTab === 'units'" />
      <CatalogAislesTab v-else />
    </main>
  </div>
</template>
