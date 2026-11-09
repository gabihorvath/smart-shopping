import { computed, shallowRef } from 'vue'

export interface DialogRequest {
  kind: 'confirm' | 'message'
  text: string
  okLabel: string
  cancelLabel: string
  resolve: (ok: boolean) => void
}

const queue = shallowRef<DialogRequest[]>([])

/** The dialog currently shown (requests queue up and are shown one after another). */
export const currentDialog = computed(() => queue.value[0] ?? null)

export function settleDialog(ok: boolean) {
  const [first, ...rest] = queue.value
  if (!first) return
  queue.value = rest
  first.resolve(ok)
}

function push(req: Omit<DialogRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    queue.value = [...queue.value, { ...req, resolve }]
  })
}

/** Promise-based custom dialogs. Rendered by `DialogHost` (mounted once in App). */
export function useDialog() {
  return {
    confirm(text: string, opts: { okLabel?: string; cancelLabel?: string } = {}): Promise<boolean> {
      return push({
        kind: 'confirm',
        text,
        okLabel: opts.okLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Abbrechen',
      })
    },
    async message(text: string, okLabel = 'OK'): Promise<void> {
      await push({ kind: 'message', text, okLabel, cancelLabel: '' })
    },
  }
}
