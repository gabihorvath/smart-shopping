<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDialog } from '../composables/useDialog'
import { useSnackbars } from '../composables/useSnackbars'
import type { ListRow } from '../domain/view'
import { useAppStore } from '../stores/app'
import AddItemSheet from './AddItemSheet.vue'
import AisleGroups from './AisleGroups.vue'
import EditAmountSheet from './EditAmountSheet.vue'
import ShopSelectorSheet from './ShopSelectorSheet.vue'

const store = useAppStore()
const dialog = useDialog()
const snackbars = useSnackbars()

const addOpen = ref(false)
const shopSheetOpen = ref(false)
const menuOpen = ref(false)
const doneOpen = ref(false)
const editEntryId = ref<string | null>(null)

const view = computed(() => store.listView)
const doneCount = computed(() => view.value.done.reduce((n, g) => n + g.rows.length, 0))
const isEmpty = computed(
  () => !view.value.open.length && !view.value.notInShop.length && !doneCount.value,
)

// ---- brief highlight of new / changed rows ----
const highlightIds = ref<ReadonlySet<string>>(new Set())
let known = new Map(store.entries.map((e) => [e.id, `${e.amount}|${e.checked}`]))
watch(
  () => store.entries,
  (entries) => {
    const next = new Map<string, string>()
    const hit: string[] = []
    for (const e of entries) {
      const sig = `${e.amount}|${e.checked}`
      next.set(e.id, sig)
      const prev = known.get(e.id)
      if (prev === undefined || (prev !== sig && !e.checked)) hit.push(e.id)
    }
    known = next
    if (!hit.length) return
    highlightIds.value = new Set([...highlightIds.value, ...hit])
    setTimeout(() => {
      const s = new Set(highlightIds.value)
      hit.forEach((id) => s.delete(id))
      highlightIds.value = s
    }, 1500)
  },
  { deep: true },
)

async function toggle(row: ListRow) {
  const r = await store.toggleChecked(row.entry.id)
  if (!r.ok) await dialog.message(r.error)
}

async function remove(row: ListRow) {
  const removed = await store.removeEntry(row.entry.id)
  if (!removed) return
  snackbars.push(`„${row.item.name}“ entfernt`, 'Rückgängig', async () => {
    const r = await store.restoreEntry(removed)
    if (!r.ok) await dialog.message(r.error)
  })
}

async function clearDone() {
  const n = doneCount.value
  if (!n) return
  const ok = await dialog.confirm(`${n} erledigte Artikel entfernen?`, { okLabel: 'Entfernen' })
  if (ok) await store.clearChecked()
}

function go(v: 'shops' | 'catalog') {
  menuOpen.value = false
  store.setView(v)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-white">
    <header
      class="sticky top-0 z-20 flex items-center justify-between gap-2 bg-green-600 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-2 pl-[max(0.75rem,env(safe-area-inset-left))] text-white"
    >
      <button
        type="button"
        data-testid="shop-selector"
        class="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-lg font-semibold active:bg-green-700"
        aria-haspopup="dialog"
        @click="shopSheetOpen = true"
      >
        <span class="truncate">{{ store.activeShop?.name }}</span>
        <span aria-hidden="true" class="text-sm">▾</span>
      </button>
      <div class="relative">
        <button
          type="button"
          aria-label="Menü"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          class="flex size-11 items-center justify-center rounded-lg text-2xl active:bg-green-700"
          @click="menuOpen = !menuOpen"
        >
          ≡
        </button>
        <template v-if="menuOpen">
          <div class="fixed inset-0 z-30" @click="menuOpen = false" />
          <div
            role="menu"
            class="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 text-gray-900 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              class="flex min-h-12 w-full items-center px-4 text-left active:bg-gray-100"
              @click="go('shops')"
            >
              Läden
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex min-h-12 w-full items-center px-4 text-left active:bg-gray-100"
              @click="go('catalog')"
            >
              Katalog
            </button>
          </div>
        </template>
      </div>
    </header>

    <main class="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <p v-if="isEmpty" class="px-4 py-16 text-center text-gray-500">Die Liste ist leer</p>

      <AisleGroups
        :groups="view.open"
        :highlight-ids="highlightIds"
        @toggle="toggle"
        @amount="editEntryId = $event.entry.id"
        @remove="remove"
      />

      <section v-if="view.notInShop.length" class="mt-4 opacity-60" data-testid="not-in-shop">
        <h2 class="px-4 pt-2 text-sm font-semibold tracking-wide text-gray-600 uppercase">
          Nicht in diesem Laden
        </h2>
        <AisleGroups
          :groups="view.notInShop"
          :highlight-ids="highlightIds"
          @toggle="toggle"
          @amount="editEntryId = $event.entry.id"
          @remove="remove"
        />
      </section>

      <section v-if="doneCount" class="mt-4 opacity-60" data-testid="done">
        <div class="flex items-center justify-between px-4">
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 text-sm font-semibold tracking-wide text-gray-600 uppercase"
            :aria-expanded="doneOpen"
            @click="doneOpen = !doneOpen"
          >
            <span aria-hidden="true">{{ doneOpen ? '▾' : '▸' }}</span>
            Erledigt ({{ doneCount }})
          </button>
          <button
            type="button"
            class="min-h-11 rounded-lg px-3 text-sm font-medium text-red-700 active:bg-gray-100"
            @click="clearDone"
          >
            Entfernen
          </button>
        </div>
        <AisleGroups
          v-if="doneOpen"
          :groups="view.done"
          :highlight-ids="highlightIds"
          @toggle="toggle"
          @amount="editEntryId = $event.entry.id"
          @remove="remove"
        />
      </section>
    </main>

    <button
      type="button"
      aria-label="Artikel hinzufügen"
      data-testid="fab"
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-green-600 text-3xl text-white shadow-lg active:bg-green-700"
      @click="addOpen = true"
    >
      +
    </button>

    <AddItemSheet v-model="addOpen" />
    <EditAmountSheet :entry-id="editEntryId" @close="editEntryId = null" />
    <ShopSelectorSheet v-model="shopSheetOpen" />
  </div>
</template>
