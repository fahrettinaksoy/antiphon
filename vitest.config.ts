import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src'),
      '@shared': resolve('shared'),
      '@schema': resolve('packages/schema/src'),
      '@runtime': resolve('packages/runtime/src')
    }
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'electron/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 20000
  }
})
