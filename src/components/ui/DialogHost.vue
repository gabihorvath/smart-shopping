<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { currentDialog, settleChoice, settleDialog } from '../../composables/useDialog'

const okBtn = ref<HTMLButtonElement>()
const firstChoice = ref<HTMLButtonElement[]>()

watch(currentDialog, async (d) => {
  if (d) {
    await nextTick()
    okBtn.value?.focus()
    firstChoice.value?.[0]?.focus()
  }
})

function cancel() {
  settleDialog(false)
}
</script>

<template>
  <div
    v-if="currentDialog"
    class="fixed inset-0 z-60 flex items-center justify-center bg-ink/35 p-6"
    @click.self="cancel"
    @keydown.esc="cancel"
  >
    <div
      role="alertdialog"
      aria-modal="true"
      class="w-full max-w-sm rounded-3xl bg-card p-6 shadow-sheet"
    >
      <p class="text-base text-ink">{{ currentDialog.text }}</p>
      <div v-if="currentDialog.kind === 'choice'" class="mt-5 flex flex-col gap-2">
        <button
          v-for="(c, i) in currentDialog.choices"
          :key="c.value"
          ref="firstChoice"
          type="button"
          class="min-h-11 rounded-xl px-4 font-semibold"
          :class="
            i === 0
              ? 'bg-coral-500 text-white active:bg-coral-600'
              : 'bg-cream-deep text-ink active:bg-line'
          "
          @click="settleChoice(c.value)"
        >
          {{ c.label }}
        </button>
      </div>
      <div v-else class="mt-5 flex justify-end gap-2">
        <button
          v-if="currentDialog.kind === 'confirm'"
          type="button"
          class="min-h-11 rounded-xl bg-cream-deep px-4 font-semibold text-ink active:bg-line"
          @click="cancel"
        >
          {{ currentDialog.cancelLabel }}
        </button>
        <button
          ref="okBtn"
          type="button"
          class="min-h-11 rounded-xl bg-coral-500 px-5 font-semibold text-white active:bg-coral-600"
          @click="settleDialog(true)"
        >
          {{ currentDialog.okLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
