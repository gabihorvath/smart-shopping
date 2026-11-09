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
  <div class="flex min-h-dvh flex-col bg-cream">
    <header
      class="sticky top-0 z-20 bg-cream/90 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 text-ink backdrop-blur"
    >
      <div class="flex items-center gap-3 pb-3">
        <button
          type="button"
          aria-label="Zurück"
          class="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-2xl text-ink shadow-card active:bg-cream-deep"
          @click="store.setView('list')"
        >
          ‹
        </button>
        <h1 class="text-2xl font-bold tracking-tight">Katalog</h1>
      </div>
      <div role="tablist" class="flex gap-1 rounded-full bg-cream-deep p-1">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="catalogTab === t.id"
          :data-testid="`tab-${t.id}`"
          class="min-h-11 flex-1 rounded-full font-semibold transition"
          :class="catalogTab === t.id ? 'bg-card text-coral-700 shadow-card' : 'text-ink-muted'"
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
