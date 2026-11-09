import { expect, test } from '@playwright/test'
import { addItem, closeSheet, openAddSheet, openApp, pickItem, row } from './helpers'

test('first start shows the seeded shop with an empty list', async ({ page }) => {
  await openApp(page)
  await expect(page.getByTestId('shop-selector')).toContainText('Standard')
  await expect(page.getByText('Deine Liste ist leer')).toBeVisible()
})

test('add via search with amount shows the item under its aisle', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Äpfel', '1,5')
  // the sheet stays open for more items
  await expect(page.getByTestId('search')).toBeFocused()
  await closeSheet(page)
  const group = page.getByTestId('aisle-group').filter({ hasText: 'Obst & Gemüse' })
  await expect(group.locator('[data-name="Äpfel"]')).toContainText('1,5 kg')
})

test('search ignores umlauts and case', async ({ page }) => {
  await openApp(page)
  await openAddSheet(page)
  await page.getByTestId('search').fill('apfel')
  await expect(page.getByRole('button', { name: /^Äpfel/ })).toBeVisible()
})

test('invalid amount is marked and blocks adding', async ({ page }) => {
  await openApp(page)
  await openAddSheet(page)
  await pickItem(page, 'Äpfel')
  const input = page.getByTestId('amount-input')
  await expect(input).toHaveValue('0,5')
  await input.fill('0,2')
  await expect(input).toHaveClass(/border-red-600/)
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Mehr' }).click()
  await expect(input).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeEnabled()
})

test('duplicate add: Nein keeps the sheet, Ja adds the amounts', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Butter', '2')
  await pickItem(page, 'Butter')
  await page.getByTestId('amount-input').fill('3')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText(
    'Butter ist schon auf der Liste (aktuell 2 Stk). Menge addieren?',
  )
  await dialog.getByRole('button', { name: 'Nein' }).click()
  await expect(dialog).toHaveCount(0)
  // still on the amount step with the entered value
  await expect(page.getByTestId('amount-input')).toHaveValue('3')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Ja' }).click()
  await expect(page.getByTestId('search')).toHaveValue('')
  await closeSheet(page)
  await expect(row(page, 'Butter')).toContainText('5 Stk')
})

test('check moves to Erledigt, tapping the filled circle reopens', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Brot')
  await closeSheet(page)
  await page.getByRole('button', { name: 'Brot abhaken' }).click()
  const done = page.getByTestId('done')
  await expect(done).toContainText('Erledigt (1)')
  await expect(page.getByTestId('aisle-group')).toHaveCount(0) // collapsed, nothing open
  await done.getByRole('button', { name: /Erledigt/ }).click()
  await done.getByRole('button', { name: 'Brot wieder öffnen' }).click()
  await expect(page.getByTestId('done')).toHaveCount(0)
  await expect(row(page, 'Brot')).toBeVisible()
})

test('amount of an entry can be changed; saving reopens a checked entry', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Milch', '1')
  await closeSheet(page)
  await page.getByRole('button', { name: 'Milch abhaken' }).click()
  await page
    .getByTestId('done')
    .getByRole('button', { name: /Erledigt/ })
    .click()
  await page.getByRole('button', { name: 'Menge ändern: Milch' }).click()
  await page.getByTestId('amount-input').fill('2,5')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByTestId('done')).toHaveCount(0)
  await expect(row(page, 'Milch')).toContainText('2,5 l')
})

test('remove via x, then undo restores the item', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Brot')
  await closeSheet(page)
  await page.getByRole('button', { name: 'Brot entfernen' }).click()
  await expect(row(page, 'Brot')).toHaveCount(0)
  const snack = page.getByTestId('snackbar').filter({ hasText: 'entfernt' })
  await expect(snack).toContainText('„Brot“ entfernt')
  await snack.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(row(page, 'Brot')).toBeVisible()
  await expect(snack).toHaveCount(0)
})

test('two quick removals show two snackbars; each expires on its own', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Brot')
  await addItem(page, 'Butter')
  await closeSheet(page)
  await page.getByRole('button', { name: 'Brot entfernen' }).click()
  await page.getByRole('button', { name: 'Butter entfernen' }).click()
  const removed = page.getByTestId('snackbar').filter({ hasText: 'entfernt' })
  await expect(removed).toHaveCount(2)
  await expect(page.getByTestId('snackbar')).toHaveCount(0, { timeout: 8000 })
  await expect(page.getByText('Deine Liste ist leer')).toBeVisible()
})

test('swipe left removes an open row; vertical movement does not', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Brot')
  await addItem(page, 'Butter')
  await closeSheet(page)
  const brot = row(page, 'Brot')
  const box = (await brot.boundingBox())!
  const y = box.y + box.height / 2
  // mostly vertical drag: nothing happens
  await page.mouse.move(box.x + 200, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, y + 40, { steps: 5 })
  await page.mouse.up()
  await expect(brot).toBeVisible()
  // clear horizontal swipe
  await page.mouse.move(box.x + box.width - 60, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 20, y + 2, { steps: 10 })
  await page.mouse.up()
  await expect(brot).toHaveCount(0)
  await expect(row(page, 'Butter')).toBeVisible()
  await expect(page.getByTestId('snackbar')).toContainText('„Brot“ entfernt')
})

test('Erledigt entfernen asks for confirmation', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Brot')
  await addItem(page, 'Butter')
  await closeSheet(page)
  await page.getByRole('button', { name: 'Brot abhaken' }).click()
  await page.getByRole('button', { name: 'Butter abhaken' }).click()
  const done = page.getByTestId('done')
  await done.getByRole('button', { name: 'Entfernen' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('2 erledigte Artikel entfernen?')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(done).toContainText('Erledigt (2)')
  await done.getByRole('button', { name: 'Entfernen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Entfernen' }).click()
  await expect(page.getByText('Deine Liste ist leer')).toBeVisible()
})

test('new item with a new aisle lands in "Nicht in diesem Laden"', async ({ page }) => {
  await openApp(page)
  await openAddSheet(page)
  await page.getByTestId('search').fill('Zimt')
  await page.getByTestId('create-new').click()
  await expect(page.getByTestId('new-item-name')).toHaveValue('Zimt')
  await page.getByTestId('new-item-aisle').selectOption({ label: 'Neu…' })
  await page.getByTestId('new-aisle-name').fill('Backzutaten')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await closeSheet(page)
  const section = page.getByTestId('not-in-shop')
  await expect(section).toContainText('Nicht in diesem Laden')
  await expect(section).toContainText('Backzutaten')
  await expect(section.locator('[data-name="Zimt"]')).toContainText('1 Stk')
})

test('new item with a new unit; duplicate name shows an inline error', async ({ page }) => {
  await openApp(page)
  await openAddSheet(page)
  await page.getByTestId('search').fill('Fenchel')
  await page.getByTestId('create-new').click()
  await page.getByTestId('new-item-unit').selectOption({ label: 'Neu…' })
  await page.getByTestId('new-unit-name').fill('Knolle')
  await page.getByTestId('new-unit-step').fill('0,5')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByTestId('amount-input')).toHaveValue('0,5')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect(page.getByTestId('search')).toHaveValue('')
  // creating a unit that exists must show the store error
  await page.getByTestId('search').fill('Fenchelsamen')
  await page.getByTestId('create-new').click()
  await page.getByTestId('new-item-unit').selectOption({ label: 'Neu…' })
  await page.getByTestId('new-unit-name').fill('knolle')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('alert')).toContainText('Name existiert schon.')
})

test('data persists across a reload', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Äpfel', '2')
  await closeSheet(page)
  await page.reload()
  await expect(row(page, 'Äpfel')).toContainText('2 kg')
})

test('shop selector lists shops and keeps the selection', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('shop-selector').click()
  const radio = page.getByRole('radio', { name: 'Standard' })
  await expect(radio).toHaveAttribute('aria-checked', 'true')
  await radio.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('menu navigates to the placeholder views and back', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('menuitem', { name: 'Katalog' }).click()
  await expect(page.getByRole('heading', { name: 'Katalog' })).toBeVisible()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('menuitem', { name: 'Läden' }).click()
  await expect(page.getByRole('heading', { name: 'Läden' })).toBeVisible()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByTestId('shop-selector')).toBeVisible()
})
