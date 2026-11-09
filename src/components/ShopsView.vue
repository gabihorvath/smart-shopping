<script setup lang="ts">
import { useAppStore } from '../stores/app'
import NewShopInline from './NewShopInline.vue'
import ShopEditor from './ShopEditor.vue'

const store = useAppStore()

// Back rule (single target): editor -> shop list -> main list, regardless of whether the
// editor was opened from the selector sheet or from this list.
</script>

<template>
  <ShopEditor
    v-if="store.editingShopId"
    :key="store.editingShopId"
    :shop-id="store.editingShopId"
    @back="store.editShop(null)"
  />
  <div v-else class="min-h-dvh bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header
      class="sticky top-0 z-20 flex items-center gap-1 bg-green-600 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white"
    >
      <button
        type="button"
        aria-label="Zurück"
        class="flex size-11 items-center justify-center rounded-lg text-2xl active:bg-green-700"
        @click="store.setView('list')"
      >
        ‹
      </button>
      <h1 class="text-lg font-semibold">Läden</h1>
    </header>
    <ul class="px-2 py-1">
      <li v-for="s in store.shops" :key="s.id">
        <button
          type="button"
          data-testid="shop-row"
          class="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg px-2 text-left active:bg-gray-100"
          @click="store.editShop(s.id)"
        >
          <span class="truncate text-base text-gray-900">{{ s.name }}</span>
          <span class="shrink-0 text-sm text-gray-500">
            {{ s.id === store.activeShopId ? 'aktiv ›' : '›' }}
          </span>
        </button>
      </li>
    </ul>
    <div class="px-2">
      <NewShopInline @created="store.editShop($event.id)" />
    </div>
  </div>
</template>
