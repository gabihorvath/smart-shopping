<script setup lang="ts">
import { dismissSnackbar, snackbars, type Snackbar } from '../../composables/useSnackbars'

function act(s: Snackbar) {
  dismissSnackbar(s.id)
  void s.onAction()
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4"
    aria-live="polite"
  >
    <div
      v-for="s in snackbars"
      :key="s.id"
      data-testid="snackbar"
      class="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-lg bg-gray-900 py-1 pr-1 pl-4 text-sm text-white shadow-lg"
    >
      <span class="truncate">{{ s.text }}</span>
      <button
        type="button"
        class="min-h-11 shrink-0 rounded-md px-3 font-semibold text-green-400 active:bg-white/10"
        @click="act(s)"
      >
        {{ s.actionLabel }}
      </button>
    </div>
  </div>
</template>
