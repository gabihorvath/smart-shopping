/** Round to 3 decimals to avoid float noise. */
export function roundAmount(x: number): number {
  return Math.round(x * 1000) / 1000
}

/** Parse user input with German decimal comma ('.' tolerated). Returns null if invalid. */
export function parseAmount(str: string): number | null {
  const s = str.trim().replace(/\s+/g, '')
  if (!/^(\d+([.,]\d+)?|[.,]\d+)$/.test(s)) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? roundAmount(n) : null
}

const formatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
})

export function formatAmount(n: number): string {
  return formatter.format(n)
}

/** Valid iff finite, > 0 and >= step. */
export function validateAmount(n: number, step: number): boolean {
  return Number.isFinite(n) && n > 0 && n >= step
}

export function stepUp(n: number, step: number): number {
  return roundAmount(n + step)
}

/** Never goes below step. */
export function stepDown(n: number, step: number): number {
  return roundAmount(Math.max(step, n - step))
}
