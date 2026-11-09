<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'
import NewShopInline from './NewShopInline.vue'
import BottomSheet from './ui/BottomSheet.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const store = useAppStore()
const error = ref<string | null>(null)

async function choose(id: string) {
  const r = await store.setActiveShop(id)
  if (r.ok) emit('update:modelValue', false)
  else error.value = r.error
}

function edit(id: string) {
  emit('update:modelValue', false)
  store.editShop(id, 'list')
}
</script>

<template>
  <BottomSheet
    :model-value="modelValue"
    title="Laden wählen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ul role="radiogroup" aria-label="Laden" class="py-1">
      <li v-for="s in store.shops" :key="s.id" class="flex items-center">
        <button
          type="button"
          role="radio"
          :aria-checked="s.id === store.activeShopId"
          class="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left active:bg-cream-deep"
          @click="choose(s.id)"
        >
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full border-2"
            :class="s.id === store.activeShopId ? 'border-blue-500' : 'border-ink-muted/40'"
          >
            <span v-if="s.id === store.activeShopId" class="size-3 rounded-full bg-blue-500" />
          </span>
          <span class="truncate text-base font-medium text-ink">{{ s.name }}</span>
        </button>
        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg text-ink-muted active:bg-cream-deep"
          :aria-label="`${s.name} bearbeiten`"
          @click="edit(s.id)"
        >
          ✎
        </button>
      </li>
    </ul>
    <NewShopInline @created="edit($event.id)" />
    <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>
  </BottomSheet>
</template>
