import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // No skipWaiting: src/registerServiceWorker.ts activates a new version when the app is in the background
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon.ico', 'puppace_logo.webp'],
      manifest: false, // uses existing public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Workbox's default, plus public files nothing references
        globIgnores: ['**/node_modules/**/*', 'cocker_spaniel_mascot.webp', 'icons.svg'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Force NetworkOnly on API calls to prevent stale potty/health data
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@heroui')) {
            return 'vendor-heroui';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
  test: {
    // Claude Code session worktrees (.claude/worktrees) are full repo copies: never run their tests too
    exclude: [...configDefaults.exclude, '.claude/**'],
    // The tests expect Paris time, whatever the machine's timezone (npx vitest, an IDE runner)
    env: { TZ: 'Europe/Paris' },
  },
})
