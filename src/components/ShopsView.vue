<script setup lang="ts">
import { useAppStore } from '../stores/app'

const store = useAppStore()
</script>

<template>
  <div class="min-h-dvh bg-white pt-[env(safe-area-inset-top)]">
    <header class="flex items-center gap-1 px-2 py-2">
      <button
        type="button"
        aria-label="Zurück"
        class="flex size-11 items-center justify-center rounded-lg text-2xl active:bg-gray-100"
        @click="store.setView('list')"
      >
        ‹
      </button>
      <h1 class="text-lg font-semibold">Läden</h1>
    </header>
    <p class="px-4 text-gray-500">Kommt bald.</p>
  </div>
</template>
