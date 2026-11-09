<script setup lang="ts">
import { useAppStore } from '../stores/app'
import NewShopInline from './NewShopInline.vue'
import ShopEditor from './ShopEditor.vue'

const store = useAppStore()

// Back from the editor returns to where it was opened from (store.editorOrigin).
</script>

<template>
  <ShopEditor
    v-if="store.editingShopId"
    :key="store.editingShopId"
    :shop-id="store.editingShopId"
    @back="store.closeEditor()"
  />
  <div v-else class="min-h-dvh bg-cream pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header
      class="sticky top-0 z-20 flex items-center gap-3 bg-cream/90 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 text-ink backdrop-blur"
    >
      <button
        type="button"
        aria-label="Zurück"
        class="flex size-11 items-center justify-center rounded-full bg-card text-2xl text-ink shadow-card active:bg-cream-deep"
        @click="store.setView('list')"
      >
        ‹
      </button>
      <h1 class="text-2xl font-bold tracking-tight">Läden</h1>
    </header>
    <ul class="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-card">
      <li v-for="s in store.shops" :key="s.id">
        <button
          type="button"
          data-testid="shop-row"
          class="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left active:bg-cream-deep"
          @click="store.editShop(s.id)"
        >
          <span class="truncate text-base font-medium text-ink">{{ s.name }}</span>
          <span class="shrink-0 text-sm text-ink-muted">
            {{ s.id === store.activeShopId ? 'aktiv ›' : '›' }}
          </span>
        </button>
      </li>
    </ul>
    <div class="mx-4 mt-3">
      <NewShopInline @created="store.editShop($event.id)" />
    </div>
  </div>
</template>
