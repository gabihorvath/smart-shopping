<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { currentDialog, settleDialog } from '../../composables/useDialog'

const okBtn = ref<HTMLButtonElement>()

watch(currentDialog, async (d) => {
  if (d) {
    await nextTick()
    okBtn.value?.focus()
  }
})

function cancel() {
  settleDialog(false)
}
</script>

<template>
  <div
    v-if="currentDialog"
    class="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-6"
    @click.self="cancel"
    @keydown.esc="cancel"
  >
    <div
      role="alertdialog"
      aria-modal="true"
      class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
    >
      <p class="text-base text-gray-900">{{ currentDialog.text }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          v-if="currentDialog.kind === 'confirm'"
          type="button"
          class="min-h-11 rounded-lg px-4 font-medium text-gray-700 active:bg-gray-100"
          @click="cancel"
        >
          {{ currentDialog.cancelLabel }}
        </button>
        <button
          ref="okBtn"
          type="button"
          class="min-h-11 rounded-lg bg-green-600 px-4 font-medium text-white active:bg-green-700"
          @click="settleDialog(true)"
        >
          {{ currentDialog.okLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
