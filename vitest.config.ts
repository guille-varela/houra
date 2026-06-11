import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Los specs de tests/e2e son de Playwright y se ejecutan con `pnpm test:e2e`
    exclude: ['tests/e2e/**', 'node_modules/**'],
    passWithNoTests: true,
  },
})
