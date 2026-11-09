<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useDialog } from '../composables/useDialog'
import type { Aisle } from '../domain/types'
import { useAppStore } from '../stores/app'
import BottomSheet from './ui/BottomSheet.vue'
import PlusIcon from './ui/PlusIcon.vue'

const store = useAppStore()
const dialog = useDialog()

const sheetOpen = ref(false)
const editing = ref<Aisle | null>(null)
const name = ref('')
const nameError = ref<string | null>(null)
const busy = ref(false)

const counts = computed(() => {
  const m = new Map<string, number>()
  for (const i of store.items) m.set(i.aisleId, (m.get(i.aisleId) ?? 0) + 1)
  return m
})

// local copy so the drag library can mutate it; order is saved through the store
const list = ref<Aisle[]>([])
watch(
  () => store.aisles,
  (aisles) => {
    list.value = [...aisles].sort((a, b) => a.sortKey - b.sortKey)
  },
  { immediate: true, deep: true },
)

async function saveOrder() {
  const r = await store.reorderAisles(list.value.map((a) => a.id))
  if (!r.ok) await dialog.message(r.error)
}

function openNew() {
  editing.value = null
  name.value = ''
  nameError.value = null
  sheetOpen.value = true
}
function openEdit(a: Aisle) {
  editing.value = a
  name.value = a.name
  nameError.value = null
  sheetOpen.value = true
}

async function save() {
  if (busy.value) return
  busy.value = true
  nameError.value = null
  try {
    const r = editing.value
      ? await store.renameAisle(editing.value.id, name.value)
      : await store.createAisle(name.value)
    if (!r.ok) nameError.value = r.error
    else sheetOpen.value = false
  } finally {
    busy.value = false
  }
}

async function remove() {
  const a = editing.value
  if (!a) return
  const ok = await dialog.confirm(`Gang „${a.name}“ löschen?`, { okLabel: 'Löschen' })
  if (!ok) return
  const r = await store.deleteAisle(a.id)
  if (!r.ok) await dialog.message(r.error)
  else sheetOpen.value = false
}

const field = 'h-12 w-full rounded-xl border-2 bg-card px-3 text-base text-ink outline-none'
</script>

<template>
  <div>
    <h2 class="mt-2 px-5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
      Gänge (globale Reihenfolge)
    </h2>
    <VueDraggable
      v-model="list"
      tag="ul"
      class="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-card"
      handle=".drag-handle"
      :animation="150"
      :delay="0"
      data-testid="aisle-list"
      @update="saveOrder"
    >
      <li
        v-for="a in list"
        :key="a.id"
        data-testid="aisle-row"
        :data-name="a.name"
        class="flex min-h-12 items-center bg-card"
      >
        <span
          class="drag-handle flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-xl text-ink-muted select-none"
          role="img"
          :aria-label="`${a.name} verschieben`"
          data-testid="drag-handle"
          >≡</span
        >
        <span class="min-w-0 flex-1 truncate text-base text-ink">{{ a.name }}</span>
        <span class="shrink-0 pl-2 text-sm text-ink-muted" data-testid="aisle-count">{{
          counts.get(a.id) ?? 0
        }}</span>
        <button
          type="button"
          :aria-label="`${a.name} bearbeiten`"
          class="flex size-11 shrink-0 items-center justify-center text-ink-muted active:bg-cream-deep"
          @click="openEdit(a)"
        >
          ✎
        </button>
      </li>
    </VueDraggable>

    <button
      type="button"
      aria-label="Gang anlegen"
      data-testid="fab"
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-coral-500 text-3xl text-white shadow-fab transition active:scale-95 active:bg-coral-600"
      @click="openNew"
    >
      <PlusIcon />
    </button>

    <BottomSheet v-model="sheetOpen" :title="editing ? 'Gang bearbeiten' : 'Neuer Gang'">
      <form class="space-y-4 pt-2 pb-2" @submit.prevent="save">
        <label class="block">
          <span class="text-sm font-medium text-ink-muted">Name</span>
          <input
            v-model="name"
            data-testid="aisle-name"
            data-autofocus
            autocomplete="off"
            :class="[
              field,
              nameError
                ? 'border-red-600'
                : 'border-line focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15',
            ]"
            @input="nameError = null"
          />
          <span v-if="nameError" class="text-sm text-red-600" role="alert">{{ nameError }}</span>
        </label>
        <div class="flex gap-2 pt-2">
          <button
            type="button"
            class="min-h-12 rounded-xl bg-cream-deep px-4 font-semibold text-ink active:bg-line"
            @click="sheetOpen = false"
          >
            Abbrechen
          </button>
          <button
            v-if="editing"
            type="button"
            data-testid="aisle-delete"
            class="min-h-12 rounded-xl px-4 font-semibold text-red-700 active:bg-red-50"
            @click="remove"
          >
            Löschen
          </button>
          <button
            type="submit"
            :disabled="busy"
            class="min-h-12 flex-1 rounded-xl bg-coral-500 font-semibold text-white active:bg-coral-600 disabled:bg-cream-deep disabled:text-ink-muted"
          >
            {{ editing ? 'Speichern' : 'Anlegen' }}
          </button>
        </div>
      </form>
    </BottomSheet>
  </div>
</template>
