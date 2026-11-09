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
  <div v-if="shop" class="min-h-dvh bg-cream pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header
      class="sticky top-0 z-20 flex items-center gap-3 bg-cream/90 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 text-ink backdrop-blur"
    >
      <button
        type="button"
        aria-label="Zurück"
        class="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-2xl text-ink shadow-card active:bg-cream-deep"
        @click="emit('back')"
      >
        ‹
      </button>
      <h1 class="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">{{ shop.name }}</h1>
      <button
        type="button"
        class="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-red-700 active:bg-red-50"
        @click="remove"
      >
        Löschen
      </button>
    </header>

    <div class="px-4 pt-4">
      <label for="shop-name" class="text-sm font-medium text-ink-muted">Name</label>
      <input
        id="shop-name"
        v-model="nameInput"
        data-testid="shop-name"
        autocomplete="off"
        class="mt-1 h-12 w-full rounded-xl border-2 bg-card px-3 text-base text-ink outline-none"
        :class="
          error
            ? 'border-red-600'
            : 'border-line focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15'
        "
        @input="error = null"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @blur="rename"
      />
      <p v-if="error" class="mt-1 text-sm text-red-600" role="alert">{{ error }}</p>
    </div>

    <h2 class="mt-4 px-5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
      Im Laden (Reihenfolge)
    </h2>
    <VueDraggable
      v-model="included"
      tag="ul"
      class="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-card"
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
        <button
          type="button"
          role="checkbox"
          aria-checked="true"
          class="flex size-11 shrink-0 items-center justify-center"
          :aria-label="`${a.name} im Laden`"
          @click="toggle(a, false)"
        >
          <span
            class="flex size-6 items-center justify-center rounded-md border-2 border-blue-500 bg-blue-500 text-xs text-white"
            >✓</span
          >
        </button>
      </li>
    </VueDraggable>

    <h2 class="mt-4 px-5 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
      Nicht im Laden
    </h2>
    <ul class="mx-4 divide-y divide-line overflow-hidden rounded-2xl bg-card shadow-card">
      <li
        v-for="a in excluded"
        :key="a.id"
        data-testid="excluded-aisle"
        :data-name="a.name"
        class="flex min-h-12 items-center"
      >
        <span class="size-11 shrink-0" />
        <span class="min-w-0 flex-1 truncate text-base text-ink-muted">{{ a.name }}</span>
        <button
          type="button"
          role="checkbox"
          aria-checked="false"
          class="flex size-11 shrink-0 items-center justify-center"
          :aria-label="`${a.name} im Laden`"
          @click="toggle(a, true)"
        >
          <span class="size-6 rounded-md border-2 border-ink-muted/40" />
        </button>
      </li>
    </ul>
  </div>
</template>
