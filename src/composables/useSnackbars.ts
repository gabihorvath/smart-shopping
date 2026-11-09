import { shallowRef } from 'vue'

export interface Snackbar {
  id: number
  text: string
  /** Action button; omitted for plain notifications. */
  actionLabel?: string
  onAction?: () => void | Promise<void>
}

export const SNACKBAR_MS = 5000

export const snackbars = shallowRef<Snackbar[]>([])
let nextId = 1

export function dismissSnackbar(id: number) {
  snackbars.value = snackbars.value.filter((s) => s.id !== id)
}

/** Stacked snackbars; each one lives a full 5 s independently. */
export function useSnackbars() {
  return {
    push(text: string, actionLabel?: string, onAction?: () => void | Promise<void>): number {
      const id = nextId++
      snackbars.value = [...snackbars.value, { id, text, actionLabel, onAction }]
      setTimeout(() => dismissSnackbar(id), SNACKBAR_MS)
      return id
    },
    dismiss: dismissSnackbar,
  }
}
