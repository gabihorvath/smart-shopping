import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/smart-shopping/`,
    serviceWorkers: 'block',
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/smart-shopping/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
