import { shallowRef } from 'vue'
import { formatAmount } from '../domain/amount'
import {
  buildShareUrl,
  decodeShare,
  importPayloadFromHash,
  MAX_SHARED_ITEMS,
  planImport,
  resolveNewItem,
  type SharedItem,
} from '../domain/share'
import { useAppStore } from '../stores/app'
import { useDialog } from './useDialog'
import { useSnackbars } from './useSnackbars'

/** Decoded import link waiting for the user's confirmation (shown by ImportSheet). */
export const pendingImport = shallowRef<SharedItem[] | null>(null)

export type ImportMode = 'add' | 'keep'

/** Reads an import link from the location hash, clears the hash at once, opens the sheet. */
export function captureImportHash(dialog = useDialog()): void {
  const payload = importPayloadFromHash(window.location.hash)
  if (payload === null) return
  // Clear first: a reload must never import a second time.
  history.replaceState(null, '', window.location.pathname + window.location.search)
  const items = decodeShare(payload)
  if (items) pendingImport.value = items
  else void dialog.message('Link ungültig.')
}

export function useShare() {
  const store = useAppStore()
  const dialog = useDialog()
  const snackbars = useSnackbars()

  async function shareList(): Promise<void> {
    const items = store.shareItems()
    if (!items.length) return dialog.message('Keine offenen Artikel zum Teilen.')
    if (items.length > MAX_SHARED_ITEMS)
      return dialog.message(`Zu viele offene Artikel (höchstens ${MAX_SHARED_ITEMS}).`)
    const url = buildShareUrl(window.location.origin + import.meta.env.BASE_URL, items)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Einkaufsliste',
          text: `Einkaufsliste mit ${items.length} Artikeln`,
          url,
        })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // anything else: fall back to the clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      snackbars.push('Link kopiert')
    } catch {
      await dialog.message('Link konnte nicht kopiert werden.')
    }
  }

  /**
   * Imports the pending link. Items needing no question are applied first; then the user is
   * asked once per unknown item or unit clash. "Abbrechen" stops; what was applied stays.
   */
  async function runImport(mode: ImportMode): Promise<void> {
    const shared = pendingImport.value
    if (!shared) return
    pendingImport.value = null
    const plan = planImport(shared, store.items, store.units)
    let imported = 0
    let skipped = 0
    const tally = (r: 'applied' | 'kept' | 'invalid') => (r === 'applied' ? imported++ : skipped++)

    for (const p of plan) {
      if (p.kind === 'ready') tally(await store.importEntry(p.itemId, p.shared.amount, mode))
    }

    let cancelled = false
    for (const p of plan) {
      if (p.kind === 'ready') continue
      const s = p.shared
      const amount = `${formatAmount(s.amount)} ${s.unit}`
      if (p.kind === 'unitClash') {
        const answer = await dialog.choice(
          `„${s.name}“ ist bei dir in ${p.catalogUnit}, der Link sagt ${amount}. Menge trotzdem als ${formatAmount(s.amount)} ${p.catalogUnit} übernehmen?`,
          [
            { value: 'yes', label: 'Übernehmen' },
            { value: 'skip', label: 'Überspringen' },
            { value: 'cancel', label: 'Abbrechen' },
          ],
        )
        if (answer === 'yes') tally(await store.importEntry(p.itemId, s.amount, mode))
        else if (answer === 'skip') skipped++
        else {
          cancelled = true
          break
        }
      } else {
        const target = resolveNewItem(s, store.units, store.aisles)
        if (!target) {
          skipped++
          continue
        }
        const answer = await dialog.choice(
          `„${s.name}“ ist nicht in deinem Katalog. Anlegen? (Einheit: ${target.unit.name}, Gang: ${target.aisle.name})`,
          [
            { value: 'yes', label: 'Anlegen' },
            { value: 'skip', label: 'Überspringen' },
            { value: 'cancel', label: 'Abbrechen' },
          ],
        )
        if (answer === 'yes') {
          const created = await store.createItem(s.name, target.unit.id, target.aisle.id)
          if (created.ok) tally(await store.importEntry(created.item.id, s.amount, mode))
          else skipped++
        } else if (answer === 'skip') skipped++
        else {
          cancelled = true
          break
        }
      }
    }

    const parts = [`${imported} Artikel importiert`]
    if (skipped) parts.push(`${skipped} übersprungen`)
    if (cancelled) parts.push('abgebrochen')
    snackbars.push(parts.join(', '))
  }

  return { shareList, runImport }
}
