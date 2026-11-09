<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  /** Full-height sheet (e.g. the add flow). */
  full?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const panel = ref<HTMLElement>()
let previous: HTMLElement | null = null

// Page behind the sheet must not scroll (shared counter: sheets can overlap briefly).
let locked = false
function setLock(on: boolean) {
  if (on === locked) return
  locked = on
  const w = window as unknown as { __sheetLocks?: number }
  w.__sheetLocks = Math.max(0, (w.__sheetLocks ?? 0) + (on ? 1 : -1))
  document.documentElement.style.overflow = w.__sheetLocks > 0 ? 'hidden' : ''
}
onBeforeUnmount(() => setLock(false))

watch(
  () => props.modelValue,
  async (open) => {
    setLock(open)
    if (open) {
      previous = document.activeElement as HTMLElement | null
      await nextTick()
      const target = panel.value?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.value
      target?.focus()
    } else {
      previous?.focus?.()
      previous = null
    }
  },
  { immediate: true },
)

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-40 flex flex-col justify-end">
    <div class="absolute inset-0 bg-ink/35" data-testid="sheet-backdrop" @click="close" />
    <div
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
      class="sheet-panel relative flex w-full flex-col rounded-t-3xl bg-card shadow-sheet outline-none"
      :class="full ? 'h-[92dvh]' : 'max-h-[85dvh]'"
      @keydown.esc.stop="close"
    >
      <div aria-hidden="true" class="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />
      <header class="flex shrink-0 items-center justify-between gap-2 px-5 pt-1 pb-2">
        <h2 class="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-ink">
          <slot name="title">{{ title }}</slot>
        </h2>
        <button
          type="button"
          aria-label="Schließen"
          class="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream-deep text-2xl text-ink-muted active:bg-line"
          @click="close"
        >
          ×
        </button>
      </header>
      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
