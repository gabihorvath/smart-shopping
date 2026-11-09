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
const allDone = computed(
  () => !view.value.open.length && !view.value.notInShop.length && doneCount.value > 0,
)
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
  <div class="flex min-h-dvh flex-col bg-cream">
    <header
      class="sticky top-0 z-20 flex items-center justify-between gap-2 bg-cream/90 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] text-ink backdrop-blur"
    >
      <button
        type="button"
        data-testid="shop-selector"
        class="flex min-h-11 min-w-0 items-center gap-2 rounded-xl text-2xl font-bold tracking-tight active:opacity-60"
        aria-haspopup="dialog"
        @click="shopSheetOpen = true"
      >
        <span class="truncate">{{ store.activeShop?.name }}</span>
        <span aria-hidden="true" class="text-sm text-coral-700">▾</span>
      </button>
      <div class="relative">
        <button
          type="button"
          aria-label="Menü"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          class="flex size-11 items-center justify-center rounded-full bg-card text-2xl shadow-card active:bg-cream-deep"
          @click="menuOpen = !menuOpen"
        >
          ≡
        </button>
        <template v-if="menuOpen">
          <div class="fixed inset-0 z-30" @click="menuOpen = false" />
          <div
            role="menu"
            class="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-2xl bg-card py-1 text-ink shadow-sheet"
          >
            <button
              type="button"
              role="menuitem"
              class="flex min-h-12 w-full items-center px-4 text-left font-medium active:bg-cream-deep"
              @click="go('shops')"
            >
              Läden
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex min-h-12 w-full items-center px-4 text-left font-medium active:bg-cream-deep"
              @click="go('catalog')"
            >
              Katalog
            </button>
          </div>
        </template>
      </div>
    </header>

    <main class="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div v-if="isEmpty" class="px-8 py-16 text-center" data-testid="empty-state">
        <div
          aria-hidden="true"
          class="mx-auto flex size-20 items-center justify-center rounded-full bg-coral-50 text-4xl"
        >
          🛒
        </div>
        <p class="mt-5 text-xl font-bold tracking-tight text-ink">Deine Liste ist leer</p>
        <p class="mt-1 text-ink-muted">Tippe auf +, um loszulegen.</p>
      </div>
      <div v-else-if="allDone" class="px-8 py-10 text-center" data-testid="all-done">
        <p class="text-xl font-bold tracking-tight text-ink">Alles erledigt! 🎉</p>
        <p class="mt-1 text-ink-muted">Super gemacht.</p>
      </div>

      <AisleGroups
        :groups="view.open"
        :highlight-ids="highlightIds"
        @toggle="toggle"
        @amount="editEntryId = $event.entry.id"
        @remove="remove"
      />

      <section v-if="view.notInShop.length" class="mt-2 opacity-60" data-testid="not-in-shop">
        <h2 class="px-8 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
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

      <section v-if="doneCount" class="mt-2 opacity-60" data-testid="done">
        <div class="flex items-center justify-between pr-4 pl-8">
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
            :aria-expanded="doneOpen"
            @click="doneOpen = !doneOpen"
          >
            <span aria-hidden="true">{{ doneOpen ? '▾' : '▸' }}</span>
            Erledigt ({{ doneCount }})
          </button>
          <button
            type="button"
            class="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 active:bg-red-50"
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
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-coral-500 text-3xl text-white shadow-fab transition active:scale-95 active:bg-coral-600"
      @click="addOpen = true"
    >
      +
    </button>

    <AddItemSheet v-model="addOpen" />
    <EditAmountSheet :entry-id="editEntryId" @close="editEntryId = null" />
    <ShopSelectorSheet v-model="shopSheetOpen" />
  </div>
</template>
