<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import CatalogView from './components/CatalogView.vue'
import ImportSheet from './components/ImportSheet.vue'
import ListScreen from './components/ListScreen.vue'
import ShopsView from './components/ShopsView.vue'
import DialogHost from './components/ui/DialogHost.vue'
import SnackbarHost from './components/ui/SnackbarHost.vue'
import { captureImportHash } from './composables/useShare'
import { useAppStore } from './stores/app'

const store = useAppStore()
const onHashChange = () => {
  if (store.ready) captureImportHash()
}
onMounted(async () => {
  await store.init()
  captureImportHash() // link opened at start: after load and seed
  window.addEventListener('hashchange', onHashChange) // link opened while the app is running
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div
    v-if="!store.ready"
    class="flex min-h-dvh items-center justify-center bg-cream text-ink-muted"
  >
    Lade…
  </div>
  <template v-else>
    <div
      v-if="store.writeError"
      role="alert"
      class="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 bg-amber-100 px-4 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] text-sm text-amber-900"
    >
      <span>Speichern fehlgeschlagen: {{ store.writeError }}</span>
      <button type="button" class="min-h-11 px-2 font-medium" @click="store.writeError = null">
        Schließen
      </button>
    </div>
    <ShopsView v-if="store.view === 'shops'" />
    <CatalogView v-else-if="store.view === 'catalog'" />
    <ListScreen v-else />
    <ImportSheet />
  </template>
  <DialogHost />
  <SnackbarHost />
</template>
