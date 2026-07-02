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
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
