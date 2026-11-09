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
      class="flex min-h-12 w-full items-center rounded-lg px-2 text-left font-medium text-green-700 active:bg-gray-100"
      @click="show"
    >
      + Neuer Laden
    </button>
    <form v-else class="flex flex-col gap-2 px-2" @submit.prevent="submit">
      <label class="text-sm text-gray-600" for="new-shop-name">Name des neuen Ladens</label>
      <div class="flex gap-2">
        <input
          id="new-shop-name"
          v-model="name"
          data-testid="new-shop-name"
          autocomplete="off"
          class="min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-base"
          :class="error ? 'border-red-500' : 'border-gray-300'"
          @input="error = null"
        />
        <button
          type="submit"
          class="min-h-11 rounded-lg bg-green-600 px-4 font-medium text-white active:bg-green-700"
        >
          Anlegen
        </button>
        <button
          type="button"
          class="min-h-11 rounded-lg px-3 text-gray-700 active:bg-gray-100"
          @click="open = false"
        >
          Abbrechen
        </button>
      </div>
      <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>
    </form>
  </div>
</template>
