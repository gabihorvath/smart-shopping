import { expect, test, type Locator, type Page } from '@playwright/test'
import { addItem, closeSheet, openApp, pickItem, row } from './helpers'

async function openCatalog(page: Page, tab?: 'Artikel' | 'Einheiten' | 'Gänge') {
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('menuitem', { name: 'Katalog' }).click()
  await expect(page.getByRole('heading', { name: 'Katalog' })).toBeVisible()
  if (tab) await page.getByRole('tab', { name: tab }).click()
}

async function backToList(page: Page) {
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByTestId('shop-selector')).toBeVisible()
}

const dialog = (page: Page) => page.getByRole('dialog')
const alert = (page: Page) => page.getByRole('alertdialog')

async function createItem(page: Page, name: string, unit?: string, aisle?: string) {
  await page.getByTestId('fab').click()
  await page.getByTestId('new-item-name').fill(name)
  if (unit) await page.getByTestId('new-item-unit').selectOption({ label: unit })
  if (aisle) await page.getByTestId('new-item-aisle').selectOption({ label: aisle })
  await dialog(page).getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog(page)).toHaveCount(0)
}

async function createAisle(page: Page, name: string) {
  await page.getByTestId('fab').click()
  await page.getByTestId('aisle-name').fill(name)
  await dialog(page).getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog(page)).toHaveCount(0)
}

async function createUnit(page: Page, name: string, step: string) {
  await page.getByTestId('fab').click()
  await page.getByTestId('unit-name').fill(name)
  await page.getByTestId('unit-step-input').fill(step)
  await dialog(page).getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog(page)).toHaveCount(0)
}

/** Manual mouse drag with intermediate moves (Sortable needs several dragover events). */
async function dragHandle(page: Page, from: Locator, to: Locator, dy: number) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + Math.sign(dy) * 10, { steps: 3 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + dy, { steps: 15 })
  await page.mouse.up()
}

const aisleNames = (page: Page) =>
  page.getByTestId('aisle-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))

test('add an item in the catalog and find it in the add flow', async ({ page }) => {
  await openApp(page)
  await openCatalog(page)
  await createItem(page, 'Zimtstangen', 'Pkg', 'Gewürze & Öle')
  await expect(page.locator('[data-testid="catalog-item"][data-name="Zimtstangen"]')).toBeVisible()
  await backToList(page)
  await page.getByTestId('fab').click()
  await pickItem(page, 'Zimtstangen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await closeSheet(page)
  const group = page.getByTestId('aisle-group').filter({ hasText: 'Gewürze & Öle' })
  await expect(group.locator('[data-name="Zimtstangen"]')).toContainText('1 Pkg')
})

test('search filters the catalog (umlauts and case ignored)', async ({ page }) => {
  await openApp(page)
  await openCatalog(page)
  await page.getByTestId('catalog-search').fill('apfel')
  await expect(page.locator('[data-testid="catalog-item"][data-name="Äpfel"]')).toBeVisible()
  await expect(page.locator('[data-testid="catalog-item"][data-name="Butter"]')).toHaveCount(0)
})

test('editing the aisle of an item moves its row to another group on the list', async ({
  page,
}) => {
  await openApp(page)
  await addItem(page, 'Äpfel')
  await closeSheet(page)
  await expect(
    page
      .getByTestId('aisle-group')
      .filter({ hasText: 'Obst & Gemüse' })
      .locator('[data-name="Äpfel"]'),
  ).toBeVisible()
  await openCatalog(page)
  await page.getByRole('button', { name: 'Äpfel bearbeiten' }).click()
  await page.getByTestId('new-item-aisle').selectOption({ label: 'Getränke' })
  await dialog(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await backToList(page)
  await expect(
    page.getByTestId('aisle-group').filter({ hasText: 'Getränke' }).locator('[data-name="Äpfel"]'),
  ).toBeVisible()
  await expect(page.getByTestId('aisle-group').filter({ hasText: 'Obst & Gemüse' })).toHaveCount(0)
})

test('deleting an item is blocked while on the list, allowed after removal', async ({ page }) => {
  await openApp(page)
  await addItem(page, 'Äpfel')
  await closeSheet(page)
  await openCatalog(page)
  await page.getByRole('button', { name: 'Äpfel bearbeiten' }).click()
  await page.getByTestId('item-delete').click()
  await expect(alert(page)).toContainText('Artikel „Äpfel“ löschen?')
  await alert(page).getByRole('button', { name: 'Löschen' }).click()
  await expect(alert(page)).toContainText('Artikel ist noch auf der Liste.')
  await alert(page).getByRole('button', { name: 'OK' }).click()
  await dialog(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(page.locator('[data-testid="catalog-item"][data-name="Äpfel"]')).toBeVisible()

  await backToList(page)
  await row(page, 'Äpfel').getByRole('button', { name: 'Äpfel entfernen' }).click()
  await openCatalog(page)
  await page.getByRole('button', { name: 'Äpfel bearbeiten' }).click()
  await page.getByTestId('item-delete').click()
  await alert(page).getByRole('button', { name: 'Löschen' }).click()
  await expect(page.locator('[data-testid="catalog-item"][data-name="Äpfel"]')).toHaveCount(0)
})

test('a unit with step 0,25 is used by the amount +/- buttons', async ({ page }) => {
  await openApp(page)
  await openCatalog(page, 'Einheiten')
  await createUnit(page, 'Becher', '0,25')
  await expect(
    page.locator('[data-testid="unit-row"][data-name="Becher"] [data-testid="unit-step"]'),
  ).toHaveText('0,25')
  await page.getByRole('tab', { name: 'Artikel' }).click()
  await createItem(page, 'Joghurt-Mix', 'Becher', 'Milchprodukte & Eier')
  await backToList(page)
  await page.getByTestId('fab').click()
  await pickItem(page, 'Joghurt-Mix')
  const input = page.getByTestId('amount-input')
  await expect(input).toHaveValue('0,25')
  await page.getByRole('button', { name: 'Mehr' }).click()
  await expect(input).toHaveValue('0,5')
  await page.getByRole('button', { name: 'Weniger' }).click()
  await expect(input).toHaveValue('0,25')
})

test('invalid unit step is marked and blocks saving', async ({ page }) => {
  await openApp(page)
  await openCatalog(page, 'Einheiten')
  await page.getByTestId('fab').click()
  await page.getByTestId('unit-name').fill('Becher')
  await page.getByTestId('unit-step-input').fill('abc')
  await expect(page.getByTestId('unit-step-input')).toHaveClass(/border-red-500/)
  await expect(dialog(page).getByRole('button', { name: 'Anlegen' })).toBeDisabled()
  await page.getByTestId('unit-step-input').fill('0')
  await expect(dialog(page).getByRole('button', { name: 'Anlegen' })).toBeDisabled()
})

test('deleting a unit in use is blocked with the count; unused can be deleted', async ({
  page,
}) => {
  await openApp(page)
  await openCatalog(page, 'Einheiten')
  await page.getByRole('button', { name: 'kg bearbeiten', exact: true }).click()
  await page.getByTestId('unit-delete').click()
  await alert(page).getByRole('button', { name: 'Löschen' }).click()
  await expect(alert(page)).toContainText(/Einheit wird noch von \d+ Artikeln verwendet\./)
  await alert(page).getByRole('button', { name: 'OK' }).click()
  await dialog(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(page.locator('[data-testid="unit-row"][data-name="kg"]')).toBeVisible()

  await createUnit(page, 'Leer', '1')
  await page.getByRole('button', { name: 'Leer bearbeiten' }).click()
  await page.getByTestId('unit-delete').click()
  await alert(page).getByRole('button', { name: 'Löschen' }).click()
  await expect(page.locator('[data-testid="unit-row"][data-name="Leer"]')).toHaveCount(0)
})

test('a new aisle is listed last and its items appear in "Nicht in diesem Laden"', async ({
  page,
}) => {
  await openApp(page)
  await openCatalog(page, 'Gänge')
  await createAisle(page, 'Reformhaus')
  const names = await aisleNames(page)
  expect(names[names.length - 1]).toBe('Reformhaus')
  await page.getByRole('tab', { name: 'Artikel' }).click()
  await createItem(page, 'Dinkelwaffeln', 'Pkg', 'Reformhaus')
  await backToList(page)
  await addItem(page, 'Dinkelwaffeln')
  await closeSheet(page)
  await expect(page.getByTestId('not-in-shop')).toContainText('Reformhaus')
  await expect(page.getByTestId('not-in-shop')).toContainText('Dinkelwaffeln')
})

test('reordering aisles changes the catalog and "Nicht in diesem Laden" order, not the shop order', async ({
  page,
}) => {
  await openApp(page)
  await openCatalog(page, 'Gänge')
  await createAisle(page, 'Aaa')
  await createAisle(page, 'Bbb')
  await page.getByRole('tab', { name: 'Artikel' }).click()
  await createItem(page, 'Item-A', 'Stk', 'Aaa')
  await createItem(page, 'Item-B', 'Stk', 'Bbb')
  await backToList(page)
  await addItem(page, 'Item-A')
  await addItem(page, 'Item-B')
  await closeSheet(page)
  const notInShop = () =>
    page.getByTestId('not-in-shop').getByTestId('aisle-group').allTextContents()
  let groups = await notInShop()
  expect(groups[0]).toContain('Aaa')
  expect(groups[1]).toContain('Bbb')

  await openCatalog(page, 'Gänge')
  const rows = page.getByTestId('aisle-row')
  await dragHandle(
    page,
    rows.filter({ hasText: 'Bbb' }).getByTestId('drag-handle'),
    rows.filter({ hasText: 'Aaa' }).getByTestId('drag-handle'),
    -10,
  )
  await expect.poll(async () => (await aisleNames(page)).slice(-2)).toEqual(['Bbb', 'Aaa'])

  // catalog tab follows
  await page.getByRole('tab', { name: 'Artikel' }).click()
  const heads = await page.getByTestId('catalog-group').locator('h2').allTextContents()
  expect(heads.slice(-2).map((t) => t.trim())).toEqual(['Bbb', 'Aaa'])

  await backToList(page)
  groups = await notInShop()
  expect(groups[0]).toContain('Bbb')
  expect(groups[1]).toContain('Aaa')

  // the shop's own order is unchanged: Standard has no Aaa/Bbb and starts with Obst
  await page.getByTestId('shop-selector').click()
  await page.getByRole('button', { name: 'Standard bearbeiten' }).click()
  const included = await page
    .getByTestId('included-aisle')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))
  expect(included[0]).toBe('Obst & Gemüse')
  const excluded = await page
    .getByTestId('excluded-aisle')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))
  expect(excluded).toEqual(['Bbb', 'Aaa'])

  // saved immediately: survives a reload
  await page.reload()
  await openCatalog(page, 'Gänge')
  expect((await aisleNames(page)).slice(-2)).toEqual(['Bbb', 'Aaa'])
})

test('deleting an aisle in use is blocked with the count; unused one is removed from the shop editor', async ({
  page,
}) => {
  await openApp(page)
  await openCatalog(page, 'Gänge')
  await page.getByRole('button', { name: 'Obst & Gemüse bearbeiten' }).click()
  await page.getByTestId('aisle-delete').click()
  await alert(page).getByRole('button', { name: 'Löschen' }).click()
  await expect(alert(page)).toContainText(/Gang wird noch von \d+ Artikeln verwendet\./)
  await alert(page).getByRole('button', { name: 'OK' }).click()
  await dialog(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(page.locator('[data-testid="aisle-row"][data-name="Obst & Gemüse"]')).toBeVisible()

  // Tiefkühl is in the shop; make it unused first by checking its item count in the list
  await createAisle(page, 'Leer')
  // put the new aisle into the shop, then delete it
  await backToList(page)
  await page.getByTestId('shop-selector').click()
  await page.getByRole('button', { name: 'Standard bearbeiten' }).click()
  await page.getByRole('checkbox', { name: 'Leer im Laden' }).click()
  await expect(page.getByTestId('included-aisle').last()).toHaveAttribute('data-name', 'Leer')
  await page.getByRole('button', { name: 'Zurück' }).click() // editor opened from the selector -> list
  await openCatalog(page, 'Gänge')
  await page.getByRole('button', { name: 'Leer bearbeiten' }).click()
  await page.getByTestId('aisle-delete').click()
  await alert(page).getByRole('button', { name: 'Löschen' }).click()
  await expect(page.locator('[data-testid="aisle-row"][data-name="Leer"]')).toHaveCount(0)
  await backToList(page)
  await page.getByTestId('shop-selector').click()
  await page.getByRole('button', { name: 'Standard bearbeiten' }).click()
  await expect(page.getByTestId('included-aisle').filter({ hasText: 'Leer' })).toHaveCount(0)
  await expect(page.getByTestId('excluded-aisle').filter({ hasText: 'Leer' })).toHaveCount(0)
})

test('duplicate names show an inline error for items, units and aisles', async ({ page }) => {
  await openApp(page)
  await openCatalog(page)
  await page.getByTestId('fab').click()
  await page.getByTestId('new-item-name').fill('äpfel')
  await dialog(page).getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText('Name existiert schon.')
  await dialog(page).getByRole('button', { name: 'Schließen' }).click()

  await page.getByRole('tab', { name: 'Einheiten' }).click()
  await page.getByTestId('fab').click()
  await page.getByTestId('unit-name').fill('KG')
  await dialog(page).getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText('Name existiert schon.')
  await dialog(page).getByRole('button', { name: 'Schließen' }).click()

  await page.getByRole('tab', { name: 'Gänge' }).click()
  await page.getByTestId('fab').click()
  await page.getByTestId('aisle-name').fill('getränke')
  await dialog(page).getByRole('button', { name: 'Anlegen' }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText('Name existiert schon.')
})

test('the selected tab is remembered when re-entering the catalog', async ({ page }) => {
  await openApp(page)
  await openCatalog(page, 'Gänge')
  await backToList(page)
  await openCatalog(page)
  await expect(page.getByRole('tab', { name: 'Gänge' })).toHaveAttribute('aria-selected', 'true')
})
