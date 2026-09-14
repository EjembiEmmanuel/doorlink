import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Next aliases `server-only` internally; outside Next it does not
      // resolve at all. Pointing it at an empty module lets server-only
      // code be unit tested without weakening the guard in the app build,
      // where Next still enforces it.
      'server-only': path.resolve(import.meta.dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
