<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'
import type { Shop } from '../domain/types'

const emit = defineEmits<{ created: [shop: Shop] }>()
const store = useAppStore()

const open = ref(false)
const name = ref('')
const error = ref<string | null>(null)

function show() {
  open.value = true
  name.value = ''
  error.value = null
}

async function submit() {
  const r = await store.createShop(name.value)
  if (!r.ok) {
    error.value = r.error
    return
  }
  open.value = false
  emit('created', r.shop)
}
</script>

<template>
  <div class="py-1">
    <button
      v-if="!open"
      type="button"
      data-testid="new-shop"
      class="flex min-h-12 w-full items-center rounded-xl bg-coral-50 px-4 text-left font-semibold text-coral-700 active:bg-coral-100"
      @click="show"
    >
      + Neuer Laden
    </button>
    <form v-else class="flex flex-col gap-2" @submit.prevent="submit">
      <label class="text-sm font-medium text-ink-muted" for="new-shop-name"
        >Name des neuen Ladens</label
      >
      <div class="flex gap-2">
        <input
          id="new-shop-name"
          v-model="name"
          data-testid="new-shop-name"
          autocomplete="off"
          class="h-12 min-w-0 flex-1 rounded-xl border-2 bg-card px-3 text-base text-ink outline-none"
          :class="
            error
              ? 'border-red-600'
              : 'border-line focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15'
          "
          @input="error = null"
        />
        <button
          type="submit"
          class="min-h-12 rounded-xl bg-coral-500 px-4 font-semibold text-white active:bg-coral-600"
        >
          Anlegen
        </button>
        <button
          type="button"
          class="min-h-12 rounded-xl bg-cream-deep px-3 font-semibold text-ink active:bg-line"
          @click="open = false"
        >
          Abbrechen
        </button>
      </div>
      <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>
    </form>
  </div>
</template>
