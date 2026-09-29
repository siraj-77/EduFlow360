import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
    /**
     * `tests/e2e/**` is Playwright, not Vitest. Both runners match `*.spec.ts`,
     * so without this the unit gate loads a Playwright file and dies with
     * "Playwright Test did not expect test.describe() to be called here" —
     * which reads as a broken test rather than a mis-scoped one.
     * `pnpm test:e2e` owns that directory.
     */
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      /**
       * AGENTS.md section 4: frontend logic-bearing hooks and utilities
       * are gated at 80% line. Presentational components are smoke-tested,
       * not coverage-gated.
       */
      thresholds: {
        'src/**/hooks/**/*.ts': { lines: 80 },
        'src/**/hooks/**/*.tsx': { lines: 80 },
        'src/lib/**/*.ts': { lines: 80 },
      },
    },
  },
});
