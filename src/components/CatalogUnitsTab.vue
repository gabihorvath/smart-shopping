<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialog } from '../composables/useDialog'
import { formatAmount, parseAmount } from '../domain/amount'
import { compareNames } from '../domain/text'
import type { Unit } from '../domain/types'
import { MSG, useAppStore } from '../stores/app'
import BottomSheet from './ui/BottomSheet.vue'

const store = useAppStore()
const dialog = useDialog()

const sheetOpen = ref(false)
const editing = ref<Unit | null>(null)
const name = ref('')
const stepText = ref('1')
const nameError = ref<string | null>(null)
const busy = ref(false)

const units = computed(() => [...store.units].sort((a, b) => compareNames(a.name, b.name)))
const step = computed(() => parseAmount(stepText.value))
const stepValid = computed(() => step.value !== null && step.value > 0)

function openNew() {
  editing.value = null
  name.value = ''
  stepText.value = '1'
  nameError.value = null
  sheetOpen.value = true
}
function openEdit(u: Unit) {
  editing.value = u
  name.value = u.name
  stepText.value = formatAmount(u.step)
  nameError.value = null
  sheetOpen.value = true
}

async function save() {
  if (busy.value || !stepValid.value) return
  busy.value = true
  nameError.value = null
  try {
    const r = editing.value
      ? await store.updateUnit(editing.value.id, { name: name.value, step: step.value! })
      : await store.createUnit(name.value, step.value!)
    if (!r.ok) nameError.value = r.error
    else sheetOpen.value = false
  } finally {
    busy.value = false
  }
}

async function remove() {
  const u = editing.value
  if (!u) return
  const ok = await dialog.confirm(`Einheit „${u.name}“ löschen?`, { okLabel: 'Löschen' })
  if (!ok) return
  const r = await store.deleteUnit(u.id)
  if (!r.ok) await dialog.message(r.error)
  else sheetOpen.value = false
}

const field = 'h-12 w-full rounded-xl border-2 bg-white px-3 text-base outline-none'
const ok = 'border-gray-300 focus:border-green-600'
const bad = 'border-red-500'
</script>

<template>
  <div>
    <h2
      class="mt-2 bg-gray-100 px-4 py-1 text-xs font-semibold tracking-wide text-gray-600 uppercase"
    >
      Einheiten (Schrittweite)
    </h2>
    <ul>
      <li
        v-for="u in units"
        :key="u.id"
        data-testid="unit-row"
        :data-name="u.name"
        class="flex min-h-12 items-center pl-4"
      >
        <span class="min-w-0 flex-1 truncate text-base text-gray-900">{{ u.name }}</span>
        <span class="shrink-0 pl-2 text-sm text-gray-500" data-testid="unit-step">{{
          formatAmount(u.step)
        }}</span>
        <button
          type="button"
          :aria-label="`${u.name} bearbeiten`"
          class="flex size-11 shrink-0 items-center justify-center text-gray-600 active:bg-gray-100"
          @click="openEdit(u)"
        >
          ✎
        </button>
      </li>
    </ul>

    <button
      type="button"
      aria-label="Einheit anlegen"
      data-testid="fab"
      class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-green-600 text-3xl text-white shadow-lg active:bg-green-700"
      @click="openNew"
    >
      +
    </button>

    <BottomSheet v-model="sheetOpen" :title="editing ? 'Einheit bearbeiten' : 'Neue Einheit'">
      <form class="space-y-4 pt-2 pb-2" @submit.prevent="save">
        <label class="block">
          <span class="text-sm text-gray-600">Name</span>
          <input
            v-model="name"
            data-testid="unit-name"
            data-autofocus
            autocomplete="off"
            :class="[field, nameError ? bad : ok]"
            @input="nameError = null"
          />
          <span v-if="nameError" class="text-sm text-red-600" role="alert">{{ nameError }}</span>
        </label>
        <label class="block">
          <span class="text-sm text-gray-600">Schrittweite</span>
          <input
            v-model="stepText"
            inputmode="decimal"
            data-testid="unit-step-input"
            autocomplete="off"
            :aria-invalid="!stepValid"
            :class="[field, stepValid ? ok : bad]"
          />
          <span v-if="!stepValid" class="text-sm text-red-600" role="alert">{{
            MSG.invalidStep
          }}</span>
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
            data-testid="unit-delete"
            class="min-h-12 rounded-xl px-4 font-medium text-red-700 active:bg-gray-100"
            @click="remove"
          >
            Löschen
          </button>
          <button
            type="submit"
            :disabled="busy || !stepValid"
            class="min-h-12 flex-1 rounded-xl bg-green-600 font-semibold text-white active:bg-green-700 disabled:bg-gray-300"
          >
            {{ editing ? 'Speichern' : 'Anlegen' }}
          </button>
        </div>
      </form>
    </BottomSheet>
  </div>
</template>
