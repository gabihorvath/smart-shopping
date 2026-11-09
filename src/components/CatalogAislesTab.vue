<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useDialog } from '../composables/useDialog'
import type { Aisle } from '../domain/types'
import { useAppStore } from '../stores/app'
import BottomSheet from './ui/BottomSheet.vue'

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

const field = 'h-12 w-full rounded-xl border-2 bg-white px-3 text-base outline-none'
</script>

<template>
  <div>
    <h2
      class="mt-2 bg-gray-100 px-4 py-1 text-xs font-semibold tracking-wide text-gray-600 uppercase"
    >
      Gänge (globale Reihenfolge)
    </h2>
    <VueDraggable
      v-model="list"
      tag="ul"
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
        class="flex min-h-12 items-center bg-white"
      >
        <span
          class="drag-handle flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-xl text-gray-500 select-none"
          role="img"
          :aria-label="`${a.name} verschieben`"
          data-testid="drag-handle"
          >≡</span
        >
        <span class="min-w-0 flex-1 truncate text-base text-gray-900">{{ a.name }}</span>
        <span class="shrink-0 pl-2 text-sm text-gray-500" data-testid="aisle-count">{{
          counts.get(a.id) ?? 0
        }}</span>
        <button
          type="button"
          :aria-label="`${a.name} bearbeiten`"
          class="flex size-11 shrink-0 items-center justify-center text-gray-600 active:bg-gray-100"
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
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-green-600 text-3xl text-white shadow-lg active:bg-green-700"
      @click="openNew"
    >
      +
    </button>

    <BottomSheet v-model="sheetOpen" :title="editing ? 'Gang bearbeiten' : 'Neuer Gang'">
      <form class="space-y-4 pt-2 pb-2" @submit.prevent="save">
        <label class="block">
          <span class="text-sm text-gray-600">Name</span>
          <input
            v-model="name"
            data-testid="aisle-name"
            data-autofocus
            autocomplete="off"
            :class="[
              field,
              nameError ? 'border-red-500' : 'border-gray-300 focus:border-green-600',
            ]"
            @input="nameError = null"
          />
          <span v-if="nameError" class="text-sm text-red-600" role="alert">{{ nameError }}</span>
        </label>
        <div class="flex gap-2 pt-2">
          <button
            type="button"
            class="min-h-12 rounded-xl px-4 font-medium text-gray-700 active:bg-gray-100"
            @click="sheetOpen = false"
          >
            Abbrechen
          </button>
          <button
            v-if="editing"
            type="button"
            data-testid="aisle-delete"
            class="min-h-12 rounded-xl px-4 font-medium text-red-700 active:bg-gray-100"
            @click="remove"
          >
            Löschen
          </button>
          <button
            type="submit"
            :disabled="busy"
            class="min-h-12 flex-1 rounded-xl bg-green-600 font-semibold text-white active:bg-green-700 disabled:bg-gray-300"
          >
            {{ editing ? 'Speichern' : 'Anlegen' }}
          </button>
        </div>
      </form>
    </BottomSheet>
  </div>
</template>
