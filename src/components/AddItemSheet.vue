<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { formatAmount } from '../domain/amount'
import { namesEqual } from '../domain/text'
import type { CatalogGroup } from '../domain/view'
import { buildCatalogForAdd } from '../domain/view'
import type { CatalogItem } from '../domain/types'
import { useDialog } from '../composables/useDialog'
import { useAppStore } from '../stores/app'
import AmountStep from './AmountStep.vue'
import NewItemForm from './NewItemForm.vue'
import BottomSheet from './ui/BottomSheet.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const store = useAppStore()
const dialog = useDialog()

const step = ref<'search' | 'new' | 'amount'>('search')
const query = ref('')
const picked = ref<CatalogItem | null>(null)
const error = ref<string | null>(null)
const searchEl = ref<HTMLInputElement>()
const busy = ref(false)

const catalog = computed(() =>
  store.activeShop
    ? buildCatalogForAdd(store.activeShop, store.items, store.aisles, query.value)
    : { inShop: [], notInShop: [] },
)
const searching = computed(() => query.value.trim() !== '')
const hasResults = computed(() => catalog.value.inShop.length + catalog.value.notInShop.length > 0)
const showCreate = computed(
  () => searching.value && !store.items.some((i) => namesEqual(i.name, query.value)),
)

const pickedInfo = computed(() => {
  const item = picked.value
  const unit = item && store.unitById.get(item.unitId)
  const aisle = item && store.aisleById.get(item.aisleId)
  return item && unit && aisle ? { item, unit, aisle } : null
})

const title = computed(() =>
  step.value === 'new'
    ? 'Neuer Artikel'
    : step.value === 'amount' && picked.value
      ? picked.value.name
      : 'Artikel hinzufügen',
)

function focusSearch() {
  void nextTick(() => searchEl.value?.focus())
}

function reset() {
  step.value = 'search'
  query.value = ''
  picked.value = null
  error.value = null
  focusSearch()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  },
)

function pick(item: CatalogItem) {
  picked.value = item
  error.value = null
  step.value = 'amount'
}

function hint(item: CatalogItem): string | null {
  const e = store.entryByItemId.get(item.id)
  const unit = store.unitById.get(item.unitId)
  if (!e || !unit) return null
  return `${e.checked ? 'erledigt' : 'auf der Liste'}: ${formatAmount(e.amount)} ${unit.name}`
}

async function add(amount: number) {
  const item = picked.value
  const info = pickedInfo.value
  if (busy.value || !item || !info) return
  busy.value = true
  try {
    error.value = null
    const r = await store.addItem(item.id, amount)
    if (r.status !== 'needsConfirm') {
      if (r.status === 'invalid') error.value = r.error
      else reset()
      return
    }
    const yes = await dialog.confirm(
      `${item.name} ist schon auf der Liste (aktuell ${formatAmount(r.current)} ${info.unit.name}). Menge addieren?`,
      { okLabel: 'Ja', cancelLabel: 'Nein' },
    )
    if (!yes) return
    const res = await store.confirmAddAmount(item.id, amount)
    if (res.ok) reset()
    else error.value = res.error
  } finally {
    busy.value = false
  }
}

function created(item: CatalogItem) {
  pick(item)
}
</script>

<template>
  <BottomSheet
    :model-value="modelValue"
    :title="title"
    full
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="step === 'search'">
      <div class="sticky top-0 z-10 -mx-4 bg-white px-4 pb-2">
        <input
          ref="searchEl"
          v-model="query"
          type="search"
          data-autofocus
          data-testid="search"
          placeholder="Suche…"
          aria-label="Suche"
          autocomplete="off"
          class="h-12 w-full rounded-xl border-2 border-gray-300 bg-white px-3 text-base outline-none focus:border-green-600"
        />
      </div>

      <button
        v-if="showCreate"
        type="button"
        data-testid="create-new"
        class="mb-2 flex min-h-12 w-full items-center rounded-xl bg-green-50 px-3 text-left font-medium text-green-800 active:bg-green-100"
        @click="step = 'new'"
      >
        + „{{ query.trim() }}“ neu anlegen
      </button>

      <template v-for="(groups, key) in catalog" :key="key">
        <section
          v-for="g in groups as CatalogGroup[]"
          :key="g.aisle.id"
          :class="key === 'notInShop' ? 'opacity-60' : ''"
        >
          <h3 class="pt-3 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {{ g.aisle.name }}
          </h3>
          <ul>
            <li v-for="item in g.items" :key="item.id">
              <button
                type="button"
                class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left active:bg-gray-100"
                @click="pick(item)"
              >
                <span class="min-w-0">
                  <span class="block truncate text-base text-gray-900">{{ item.name }}</span>
                  <span v-if="hint(item)" class="block text-xs text-green-700">{{
                    hint(item)
                  }}</span>
                </span>
                <span v-if="searching" class="shrink-0 text-xs text-gray-500">{{
                  g.aisle.name
                }}</span>
              </button>
            </li>
          </ul>
        </section>
      </template>
      <p v-if="!hasResults && !showCreate" class="py-6 text-center text-gray-500">
        Keine Artikel gefunden.
      </p>
    </template>

    <NewItemForm
      v-else-if="step === 'new'"
      :initial-name="query"
      @created="created"
      @cancel="step = 'search'"
    />

    <AmountStep
      v-else-if="step === 'amount' && pickedInfo"
      :key="pickedInfo.item.id"
      :name="pickedInfo.item.name"
      :aisle-name="pickedInfo.aisle.name"
      :unit-name="pickedInfo.unit.name"
      :step="pickedInfo.unit.step"
      confirm-label="Hinzufügen"
      :error="error"
      :busy="busy"
      show-back
      @confirm="add"
      @back="reset"
    />
  </BottomSheet>
</template>
