import { expect, test, type Locator, type Page } from '@playwright/test'
import { addItem, closeSheet, openApp, row } from './helpers'

async function createShop(page: Page, name: string) {
  await page.getByTestId('shop-selector').click()
  await page.getByTestId('new-shop').click()
  await page.getByTestId('new-shop-name').fill(name)
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

/** Editor opened from the selector sheet: one Back returns straight to the main list. */
async function backToList(page: Page) {
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByTestId('shop-selector')).toBeVisible()
}

async function activate(page: Page, name: string) {
  await page.getByTestId('shop-selector').click()
  await page.getByRole('radio', { name }).click()
  await expect(page.getByTestId('shop-selector')).toContainText(name)
  await expect(page.getByRole('dialog')).toHaveCount(0) // choice is written before the sheet closes
}

/** Manual mouse drag with intermediate moves (Sortable needs several dragover events). */
async function dragHandle(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 3 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 10, { steps: 15 })
  await page.mouse.up()
}

const groupNames = async (page: Page) =>
  (await page.getByTestId('aisle-group').allTextContents()).map((t) => t.trim())

test('create a shop from the selector opens its editor; the active shop is unchanged', async ({
  page,
}) => {
  await openApp(page)
  await createShop(page, 'Rewe')
  // copied from Standard: all aisles are included
  await expect(page.getByTestId('excluded-aisle')).toHaveCount(0)
  await expect(page.getByTestId('included-aisle')).toHaveCount(11)
  await backToList(page)
  await expect(page.getByTestId('shop-selector')).toContainText('Standard')
})

test('empty or duplicate name for a new shop shows an inline error', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('shop-selector').click()
  await page.getByTestId('new-shop').click()
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('alert')).toContainText('Name darf nicht leer sein.')
  await page.getByTestId('new-shop-name').fill('standard')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('alert')).toContainText('Name existiert schon.')
})

test('excluding an aisle moves its open items to "Nicht in diesem Laden"', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Äpfel')
  await addItem(page, 'Butter')
  await closeSheet(page)
  await createShop(page, 'Rewe')
  await page.getByRole('checkbox', { name: 'Obst & Gemüse im Laden' }).click()
  await expect(page.getByTestId('excluded-aisle')).toHaveText(/Obst & Gemüse/)
  await expect(page.getByTestId('included-aisle')).toHaveCount(10)
  await backToList(page)
  // still Standard: Äpfel is in its aisle
  await expect(page.getByTestId('not-in-shop')).toHaveCount(0)
  await activate(page, 'Rewe')
  const section = page.getByTestId('not-in-shop')
  await expect(section).toContainText('Äpfel')
  await expect(page.getByTestId('aisle-group').filter({ hasText: 'Butter' })).toBeVisible()
  // checking the aisle again appends it to the end of the order
  await page.getByTestId('shop-selector').click()
  await page.getByRole('button', { name: 'Rewe bearbeiten' }).click()
  await page.getByRole('checkbox', { name: 'Obst & Gemüse im Laden' }).click()
  await expect(page.getByTestId('included-aisle').last()).toHaveAttribute(
    'data-name',
    'Obst & Gemüse',
  )
  await backToList(page)
  await expect(page.getByTestId('not-in-shop')).toHaveCount(0)
  const groups = await groupNames(page)
  expect(groups[0]).toContain('Milchprodukte')
  expect(groups[1]).toContain('Obst')
})

test('dragging the handle reorders the aisles; the list follows after switching shops', async ({
  page,
}) => {
  await openApp(page)
  await addItem(page, 'Äpfel')
  await addItem(page, 'Butter')
  await closeSheet(page)
  await createShop(page, 'Rewe')
  const first = page.getByTestId('included-aisle').nth(0)
  await expect(first).toHaveAttribute('data-name', 'Obst & Gemüse')
  const target = page.getByTestId('included-aisle').nth(2)
  await dragHandle(page, first.getByTestId('drag-handle'), target.getByTestId('drag-handle'))
  await expect(page.getByTestId('included-aisle').nth(0)).not.toHaveAttribute(
    'data-name',
    'Obst & Gemüse',
  )
  const order = await page
    .getByTestId('included-aisle')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))
  expect(order.indexOf('Obst & Gemüse')).toBeGreaterThan(0)
  await backToList(page)
  // Standard still has Obst first
  expect((await groupNames(page))[0]).toContain('Obst')
  await activate(page, 'Rewe')
  expect((await groupNames(page))[0]).toContain('Butter')
  // saved immediately: survives a reload
  await page.reload()
  await expect(page.getByTestId('shop-selector')).toContainText('Rewe')
  expect((await groupNames(page))[0]).toContain('Butter')
})

test('only the handle starts a drag', async ({ page }) => {
  await openApp(page)
  await createShop(page, 'Rewe')
  const first = page.getByTestId('included-aisle').nth(0)
  const name = await first.getAttribute('data-name')
  await dragHandle(
    page,
    first.locator('span.truncate'),
    page.getByTestId('included-aisle').nth(2).locator('span.truncate'),
  )
  await expect(page.getByTestId('included-aisle').nth(0)).toHaveAttribute('data-name', name!)
})

test('rename: Enter saves, duplicate shows an error and reverts', async ({ page }) => {
  await openApp(page)
  await createShop(page, 'Rewe')
  const input = page.getByTestId('shop-name')
  await input.fill('Edeka')
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: 'Edeka' })).toBeVisible()
  await input.fill('STANDARD')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Name existiert schon.')
  await expect(input).toHaveValue('Edeka')
  await expect(page.getByRole('heading', { name: 'Edeka' })).toBeVisible()
})

test('switching shops via the selector changes the order of the list', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Äpfel')
  await addItem(page, 'Butter')
  await closeSheet(page)
  await createShop(page, 'Rewe')
  // move Obst & Gemüse to the end: uncheck, check
  await page.getByRole('checkbox', { name: 'Obst & Gemüse im Laden' }).click()
  await page.getByRole('checkbox', { name: 'Obst & Gemüse im Laden' }).click()
  await backToList(page)
  expect((await groupNames(page))[0]).toContain('Obst')
  await activate(page, 'Rewe')
  expect((await groupNames(page))[0]).toContain('Butter')
  await activate(page, 'Standard')
  expect((await groupNames(page))[0]).toContain('Obst')
})

test('active shop persists across reload', async ({ page }) => {
  await openApp(page)
  await createShop(page, 'Rewe')
  await backToList(page)
  await activate(page, 'Rewe')
  await page.reload()
  await expect(page.getByTestId('shop-selector')).toContainText('Rewe')
})

test('delete asks for confirmation; the active shop falls back to the remaining one', async ({
  page,
}) => {
  await openApp(page)
  await createShop(page, 'Rewe')
  await backToList(page)
  await activate(page, 'Rewe')
  await page.getByTestId('shop-selector').click()
  await page.getByRole('button', { name: 'Rewe bearbeiten' }).click()
  await page.getByRole('button', { name: 'Löschen' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Laden „Rewe“ löschen?')
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('heading', { name: 'Rewe' })).toBeVisible()
  await page.getByRole('button', { name: 'Löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
  // opened from the selector: lands on the main list, only Standard is left
  await expect(page.getByTestId('shop-selector')).toContainText('Standard')
  await expect(page.getByRole('heading', { name: 'Läden' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('shop-selector')).toContainText('Standard')
})

test('back from the editor returns to where it was opened from', async ({ page }) => {
  await openApp(page)
  await createShop(page, 'Rewe')
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByTestId('shop-selector')).toBeVisible()
  // via the selector's pencil: straight back to the list
  await page.getByTestId('shop-selector').click()
  await page.getByRole('button', { name: 'Rewe bearbeiten' }).click()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByTestId('shop-selector')).toBeVisible()
  // via Menü -> Läden: back to the shop list, then to the list
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('menuitem', { name: 'Läden' }).click()
  await page.getByTestId('shop-row').filter({ hasText: 'Rewe' }).click()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByRole('heading', { name: 'Läden' })).toBeVisible()
  // deleting from the shop list's editor returns to the shop list
  await page.getByTestId('shop-row').filter({ hasText: 'Rewe' }).click()
  await page.getByRole('button', { name: 'Löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByRole('heading', { name: 'Läden' })).toBeVisible()
  await expect(page.getByTestId('shop-row')).toHaveCount(1)
})

test('the last shop cannot be deleted', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('menuitem', { name: 'Läden' }).click()
  await page.getByTestId('shop-row').click()
  await page.getByRole('button', { name: 'Löschen' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Mindestens ein Laden muss bleiben')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByRole('heading', { name: 'Standard' })).toBeVisible()
})

test('shop list: create a shop inline and open its editor', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('menuitem', { name: 'Läden' }).click()
  await page.getByTestId('new-shop').click()
  await page.getByTestId('new-shop-name').fill('Aldi')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByRole('heading', { name: 'Aldi' })).toBeVisible()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByTestId('shop-row')).toHaveCount(2)
})

test('tapping the item name checks and reopens an item', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Brot')
  await closeSheet(page)
  await row(page, 'Brot').getByText('Brot', { exact: true }).click()
  const done = page.getByTestId('done')
  await expect(done).toContainText('Erledigt (1)')
  await done.getByRole('button', { name: /Erledigt/ }).click()
  await done.getByText('Brot', { exact: true }).click()
  await expect(page.getByTestId('done')).toHaveCount(0)
  await expect(row(page, 'Brot')).toBeVisible()
  // the amount button does not toggle
  await row(page, 'Brot').getByTestId('amount-btn').click()
  await page.getByRole('button', { name: 'Schließen' }).click()
  await expect(row(page, 'Brot')).toBeVisible()
})
