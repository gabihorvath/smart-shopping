<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useDialog } from '../composables/useDialog'
import type { Aisle } from '../domain/types'
import { MSG, useAppStore } from '../stores/app'

const props = defineProps<{ shopId: string }>()
const emit = defineEmits<{ back: [] }>()

const store = useAppStore()
const dialog = useDialog()

const shop = computed(() => store.shopById.get(props.shopId) ?? null)

const nameInput = ref(shop.value?.name ?? '')
const error = ref<string | null>(null)

// local copy so the drag library can mutate it; synced back through the store
const included = ref<Aisle[]>([])
watch(
  () => [shop.value?.aisleIds, store.aisles] as const,
  () => {
    included.value = (shop.value?.aisleIds ?? [])
      .map((id) => store.aisleById.get(id))
      .filter((a): a is Aisle => !!a)
  },
  { immediate: true, deep: true },
)
watch(
  () => shop.value?.name,
  (n) => {
    if (n !== undefined) nameInput.value = n
  },
)

const excluded = computed(() => {
  const inIds = new Set(shop.value?.aisleIds ?? [])
  return store.aisles.filter((a) => !inIds.has(a.id)).sort((a, b) => a.sortKey - b.sortKey)
})

async function rename() {
  if (!shop.value || nameInput.value === shop.value.name) return
  const r = await store.renameShop(shop.value.id, nameInput.value)
  if (!r.ok) {
    error.value = r.error
    nameInput.value = shop.value.name
  }
}

async function saveOrder() {
  await store.setShopAisles(
    props.shopId,
    included.value.map((a) => a.id),
  )
}

async function toggle(a: Aisle, on: boolean) {
  const ids = (shop.value?.aisleIds ?? []).filter((id) => id !== a.id)
  await store.setShopAisles(props.shopId, on ? [...ids, a.id] : ids)
}

async function remove() {
  if (!shop.value) return
  if (store.shops.length <= 1) {
    await dialog.message(MSG.lastShop)
    return
  }
  const ok = await dialog.confirm(`Laden „${shop.value.name}“ löschen?`, { okLabel: 'Löschen' })
  if (!ok) return
  const r = await store.deleteShop(props.shopId)
  if (!r.ok) await dialog.message(r.error)
  else emit('back')
}
</script>

<template>
  <div v-if="shop" class="min-h-dvh bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header
      class="sticky top-0 z-20 flex items-center gap-1 bg-green-600 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white"
    >
      <button
        type="button"
        aria-label="Zurück"
        class="flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl active:bg-green-700"
        @click="emit('back')"
      >
        ‹
      </button>
      <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">{{ shop.name }}</h1>
      <button
        type="button"
        class="min-h-11 shrink-0 rounded-lg px-3 font-medium active:bg-green-700"
        @click="remove"
      >
        Löschen
      </button>
    </header>

    <div class="px-4 pt-4">
      <label for="shop-name" class="text-sm text-gray-600">Name</label>
      <input
        id="shop-name"
        v-model="nameInput"
        data-testid="shop-name"
        autocomplete="off"
        class="mt-1 min-h-11 w-full rounded-lg border px-3 text-base"
        :class="error ? 'border-red-500' : 'border-gray-300'"
        @input="error = null"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @blur="rename"
      />
      <p v-if="error" class="mt-1 text-sm text-red-600" role="alert">{{ error }}</p>
    </div>

    <h2
      class="mt-4 bg-gray-100 px-4 py-1 text-xs font-semibold tracking-wide text-gray-600 uppercase"
    >
      Im Laden (Reihenfolge)
    </h2>
    <VueDraggable
      v-model="included"
      tag="ul"
      handle=".drag-handle"
      :animation="150"
      :delay="0"
      data-testid="included-list"
      @update="saveOrder"
    >
      <li
        v-for="a in included"
        :key="a.id"
        data-testid="included-aisle"
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
        <button
          type="button"
          role="checkbox"
          aria-checked="true"
          class="flex size-11 shrink-0 items-center justify-center"
          :aria-label="`${a.name} im Laden`"
          @click="toggle(a, false)"
        >
          <span
            class="flex size-6 items-center justify-center rounded border-2 border-green-600 bg-green-600 text-xs text-white"
            >✓</span
          >
        </button>
      </li>
    </VueDraggable>

    <h2
      class="mt-4 bg-gray-100 px-4 py-1 text-xs font-semibold tracking-wide text-gray-600 uppercase"
    >
      Nicht im Laden
    </h2>
    <ul>
      <li
        v-for="a in excluded"
        :key="a.id"
        data-testid="excluded-aisle"
        :data-name="a.name"
        class="flex min-h-12 items-center"
      >
        <span class="size-11 shrink-0" />
        <span class="min-w-0 flex-1 truncate text-base text-gray-700">{{ a.name }}</span>
        <button
          type="button"
          role="checkbox"
          aria-checked="false"
          class="flex size-11 shrink-0 items-center justify-center"
          :aria-label="`${a.name} im Laden`"
          @click="toggle(a, true)"
        >
          <span class="size-6 rounded border-2 border-gray-400" />
        </button>
      </li>
    </ul>
  </div>
</template>
