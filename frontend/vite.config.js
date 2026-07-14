import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// The audit console was ported from the PMT internal desktop renderer, which
// consumed the website frontend through `@frontend/*` (and the website's own
// `@/*` + `@shared/*` aliases). The ported shared subtree lives in
// `src/shared`, so all three aliases resolve there and the ported files keep
// their original import paths.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@frontend': path.resolve(__dirname, 'src/shared'),
      '@': path.resolve(__dirname, 'src/shared'),
      '@shared': path.resolve(__dirname, 'src/shared/serverShared'),
    },
  },
  // Export libraries are loaded only when a user clicks PDF/PNG. Pre-bundle
  // them at dev-server startup so the first local export cannot hit Vite's
  // stale on-demand optimized-dependency URL (504 Outdated Optimize Dep).
  optimizeDeps: { include: ['html-to-image', 'jspdf'] },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
