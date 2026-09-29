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
