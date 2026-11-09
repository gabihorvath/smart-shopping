import { expect, test } from '@playwright/test'
import { addItem, closeSheet, openApp, row } from './helpers'

test('the installed app starts offline and keeps its data', async ({ page, context }) => {
  await openApp(page)
  // wait until the service worker has precached everything and controls the page
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect
    .poll(
      async () => {
        const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
        if (!controlled) await page.reload()
        return controlled
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  await expect(page.getByTestId('shop-selector')).toBeVisible()

  await addItem(page, 'Äpfel', '2')
  await closeSheet(page)
  await expect(row(page, 'Äpfel')).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('shop-selector')).toBeVisible()
  await expect(row(page, 'Äpfel')).toContainText('2')
})
