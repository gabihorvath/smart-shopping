<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatAmount } from '../domain/amount'
import type { ListRow } from '../domain/view'

const props = defineProps<{ row: ListRow; highlight?: boolean }>()
const emit = defineEmits<{ toggle: []; amount: []; remove: [] }>()

const checked = computed(() => props.row.entry.checked)

// ---- swipe left to remove (open rows only) ----
const dx = ref(0)
const el = ref<HTMLElement>()
let start: { x: number; y: number } | null = null
let mode: 'pending' | 'swipe' = 'pending'

const MIN_MOVE = 10

function threshold() {
  return Math.min(110, (el.value?.offsetWidth ?? 300) * 0.4)
}

function down(e: PointerEvent) {
  if (checked.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  start = { x: e.clientX, y: e.clientY }
  mode = 'pending'
}

function move(e: PointerEvent) {
  if (!start) return
  const mx = e.clientX - start.x
  const my = e.clientY - start.y
  if (mode === 'pending') {
    if (Math.abs(mx) < MIN_MOVE && Math.abs(my) < MIN_MOVE) return
    // only clearly horizontal, leftward gestures; everything else stays a scroll/tap
    if (mx < 0 && Math.abs(mx) > Math.abs(my) * 2) {
      mode = 'swipe'
      el.value?.setPointerCapture(e.pointerId)
    } else {
      start = null
      return
    }
  }
  dx.value = Math.min(0, mx)
}

function end(cancelled: boolean) {
  const trigger = !cancelled && mode === 'swipe' && start !== null && dx.value <= -threshold()
  start = null
  mode = 'pending'
  dx.value = 0
  if (trigger) emit('remove')
}
</script>

<template>
  <li class="relative overflow-hidden" data-testid="list-row" :data-name="row.item.name">
    <div
      v-if="dx < 0"
      class="absolute inset-y-0 right-0 flex items-center bg-red-500 px-5 text-sm font-medium text-white"
      :style="{ width: `${-dx}px` }"
    >
      Entfernen
    </div>
    <div
      ref="el"
      class="relative flex min-h-12 touch-pan-y items-center gap-1 bg-white select-none"
      :class="[dx === 0 ? 'transition-transform' : '', highlight ? 'row-flash' : '']"
      :style="{ transform: dx ? `translateX(${dx}px)` : undefined }"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="end(false)"
      @pointercancel="end(true)"
    >
      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center"
        :aria-label="checked ? `${row.item.name} wieder öffnen` : `${row.item.name} abhaken`"
        @click="emit('toggle')"
      >
        <span
          class="flex size-6 items-center justify-center rounded-full border-2 text-xs text-white"
          :class="checked ? 'border-green-600 bg-green-600' : 'border-gray-400'"
        >
          <template v-if="checked">✓</template>
        </span>
      </button>
      <span
        class="min-w-0 flex-1 truncate text-base"
        :class="checked ? 'text-gray-500 line-through' : 'text-gray-900'"
        >{{ row.item.name }}</span
      >
      <button
        type="button"
        data-testid="amount-btn"
        class="min-h-11 shrink-0 rounded-lg px-2 text-base text-gray-700 active:bg-gray-100"
        :aria-label="`Menge ändern: ${row.item.name}`"
        @click="emit('amount')"
      >
        {{ formatAmount(row.entry.amount) }} {{ row.unit.name }}
      </button>
      <button
        v-if="!checked"
        type="button"
        class="flex size-11 shrink-0 items-center justify-center text-xl text-gray-400 active:text-red-600"
        :aria-label="`${row.item.name} entfernen`"
        @click="emit('remove')"
      >
        ×
      </button>
      <span v-else class="size-11 shrink-0" />
    </div>
  </li>
</template>
