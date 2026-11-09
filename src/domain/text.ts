export function normalizeName(s: string): string {
  return s.trim()
}

/** For search: strip diacritics and lowercase. */
export function foldForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'de', { sensitivity: 'base' })
}

/** Case-insensitive equality after trimming. */
export function namesEqual(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase()
}
