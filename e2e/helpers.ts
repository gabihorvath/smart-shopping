import { expect, type Locator, type Page } from '@playwright/test'

export async function openApp(page: Page) {
  await page.goto('./')
  await expect(page.getByTestId('shop-selector')).toBeVisible()
}

export const addSheet = (page: Page) => page.getByTestId('search')

export async function openAddSheet(page: Page) {
  await page.getByTestId('fab').click()
  await expect(page.getByTestId('search')).toBeFocused()
}

export async function pickItem(page: Page, name: string) {
  await page.getByTestId('search').fill(name)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click()
}

/** Opens the add sheet, picks the item, optionally sets the amount and presses "Hinzufügen". */
export async function addItem(page: Page, name: string, amount?: string) {
  // the sheet stays open after adding, so only open it when needed
  if (!(await page.getByTestId('search').isVisible())) await openAddSheet(page)
  await pickItem(page, name)
  if (amount) await page.getByTestId('amount-input').fill(amount)
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect(page.getByTestId('search')).toHaveValue('')
}

export async function closeSheet(page: Page) {
  await page.getByRole('button', { name: 'Schließen' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

export const row = (page: Page, name: string): Locator =>
  page.locator(`[data-testid="list-row"][data-name="${name}"]`)
