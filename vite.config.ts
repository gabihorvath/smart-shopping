/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/smart-shopping/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Einkaufsliste',
        short_name: 'Einkauf',
        lang: 'de',
        description: 'Private Einkaufsliste',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#FFF8F0',
        theme_color: '#FFF8F0',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
