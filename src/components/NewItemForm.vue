<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseAmount } from '../domain/amount'
import type { CatalogItem } from '../domain/types'
import { MSG, useAppStore } from '../stores/app'

/** Inline form: create a catalog item (optionally with a new unit / aisle). */
const props = defineProps<{ initialName: string; item?: CatalogItem; cancelLabel?: string }>()
const emit = defineEmits<{ created: [item: CatalogItem]; cancel: []; delete: [] }>()

const store = useAppStore()
const NEW = '__new__'

const name = ref(props.initialName.trim())
const unitId = ref<string>(
  props.item?.unitId ?? store.units.find((u) => u.name === 'Stk')?.id ?? store.units[0]?.id ?? NEW,
)
const aisleId = ref<string>(
  props.item?.aisleId ??
    store.activeShop?.aisleIds.find((id) => store.aisleById.has(id)) ??
    store.aisles[0]?.id ??
    NEW,
)
const newUnitName = ref('')
const newUnitStep = ref('1')
const newAisleName = ref('')
const errors = ref<{ name?: string; unit?: string; aisle?: string }>({})
const busy = ref(false)

const sortedAisles = computed(() => [...store.aisles].sort((a, b) => a.sortKey - b.sortKey))

async function submit() {
  if (busy.value) return
  busy.value = true
  errors.value = {}
  try {
    if (unitId.value === NEW) {
      const step = parseAmount(newUnitStep.value)
      if (step === null || step <= 0) {
        errors.value = { unit: MSG.invalidStep }
        return
      }
      const r = await store.createUnit(newUnitName.value, step)
      if (!r.ok) {
        errors.value = { unit: r.error }
        return
      }
      unitId.value = r.unit.id
    }
    if (aisleId.value === NEW) {
      const r = await store.createAisle(newAisleName.value)
      if (!r.ok) {
        errors.value = { aisle: r.error }
        return
      }
      aisleId.value = r.aisle.id
    }
    const r = props.item
      ? await store.updateItem(props.item.id, {
          name: name.value,
          unitId: unitId.value,
          aisleId: aisleId.value,
        })
      : await store.createItem(name.value, unitId.value, aisleId.value)
    if (!r.ok) {
      errors.value = { name: r.error }
      return
    }
    emit('created', r.item)
  } finally {
    busy.value = false
  }
}

const field = 'h-12 w-full rounded-xl border-2 bg-white px-3 text-base outline-none'
const ok = 'border-gray-300 focus:border-green-600'
const bad = 'border-red-500'
</script>

<template>
  <form class="space-y-4 pt-2 pb-2" @submit.prevent="submit">
    <label class="block">
      <span class="text-sm text-gray-600">Name</span>
      <input
        v-model="name"
        data-testid="new-item-name"
        :class="[field, errors.name ? bad : ok]"
        autocomplete="off"
      />
      <span v-if="errors.name" class="text-sm text-red-600" role="alert">{{ errors.name }}</span>
    </label>

    <label class="block">
      <span class="text-sm text-gray-600">Einheit</span>
      <select v-model="unitId" data-testid="new-item-unit" :class="[field, ok]">
        <option v-for="u in store.units" :key="u.id" :value="u.id">{{ u.name }}</option>
        <option :value="NEW">Neu…</option>
      </select>
    </label>
    <div v-if="unitId === NEW" class="flex gap-2">
      <input
        v-model="newUnitName"
        placeholder="Name der Einheit"
        aria-label="Name der neuen Einheit"
        data-testid="new-unit-name"
        autocomplete="off"
        :class="[field, errors.unit ? bad : ok]"
      />
      <input
        v-model="newUnitStep"
        inputmode="decimal"
        aria-label="Schritt der neuen Einheit"
        data-testid="new-unit-step"
        class="h-12 w-24 shrink-0 rounded-xl border-2 border-gray-300 px-3 text-base outline-none focus:border-green-600"
      />
    </div>
    <p v-if="errors.unit" class="text-sm text-red-600" role="alert">{{ errors.unit }}</p>

    <label class="block">
      <span class="text-sm text-gray-600">Gang</span>
      <select v-model="aisleId" data-testid="new-item-aisle" :class="[field, ok]">
        <option v-for="a in sortedAisles" :key="a.id" :value="a.id">{{ a.name }}</option>
        <option :value="NEW">Neu…</option>
      </select>
    </label>
    <input
      v-if="aisleId === NEW"
      v-model="newAisleName"
      placeholder="Name des Gangs"
      aria-label="Name des neuen Gangs"
      data-testid="new-aisle-name"
      autocomplete="off"
      :class="[field, errors.aisle ? bad : ok]"
    />
    <p v-if="errors.aisle" class="text-sm text-red-600" role="alert">{{ errors.aisle }}</p>

    <div class="flex gap-2 pt-2">
      <button
        type="button"
        class="min-h-12 rounded-xl px-4 font-medium text-gray-700 active:bg-gray-100"
        @click="emit('cancel')"
      >
        {{ cancelLabel ?? 'Zurück' }}
      </button>
      <button
        v-if="item"
        type="button"
        data-testid="item-delete"
        class="min-h-12 rounded-xl px-4 font-medium text-red-700 active:bg-gray-100"
        @click="emit('delete')"
      >
        Löschen
      </button>
      <button
        type="submit"
        :disabled="busy"
        class="min-h-12 flex-1 rounded-xl bg-green-600 font-semibold text-white active:bg-green-700 disabled:bg-gray-300"
      >
        {{ item ? 'Speichern' : 'Anlegen' }}
      </button>
    </div>
  </form>
</template>
