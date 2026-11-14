import { computed, shallowRef } from 'vue'

export interface DialogChoice {
  value: string
  label: string
}

export interface DialogRequest {
  kind: 'confirm' | 'message' | 'choice'
  text: string
  okLabel: string
  cancelLabel: string
  /** Only for kind 'choice'. */
  choices?: DialogChoice[]
  resolve: (ok: boolean) => void
  /** Only for kind 'choice'; null = dismissed. */
  resolveChoice?: (value: string | null) => void
}

const queue = shallowRef<DialogRequest[]>([])

/** The dialog currently shown (requests queue up and are shown one after another). */
export const currentDialog = computed(() => queue.value[0] ?? null)

/** Settles the current dialog: confirm/message by `ok`; a choice dialog counts as dismissed. */
export function settleDialog(ok: boolean) {
  const [first, ...rest] = queue.value
  if (!first) return
  queue.value = rest
  if (first.kind === 'choice') first.resolveChoice?.(null)
  else first.resolve(ok)
}

export function settleChoice(value: string) {
  const [first, ...rest] = queue.value
  if (!first || first.kind !== 'choice') return
  queue.value = rest
  first.resolveChoice?.(value)
}

function push(req: Omit<DialogRequest, 'resolve' | 'resolveChoice'>): Promise<boolean> {
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
    /** Several buttons; resolves to the picked value, or null when dismissed (Esc / backdrop). */
    choice(text: string, choices: DialogChoice[]): Promise<string | null> {
      return new Promise((resolveChoice) => {
        queue.value = [
          ...queue.value,
          {
            kind: 'choice',
            text,
            okLabel: '',
            cancelLabel: '',
            choices,
            resolve: () => {},
            resolveChoice,
          },
        ]
      })
    },
    async message(text: string, okLabel = 'OK'): Promise<void> {
      await push({ kind: 'message', text, okLabel, cancelLabel: '' })
    },
  }
}
