import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      /**
       * AGENTS.md section 4 coverage tiers, enforced per path glob.
       * Adapters are contract-tested, not coverage-gated.
       */
      thresholds: {
        'src/**/domain/**/*.ts': {
          lines: 90,
          branches: 85,
        },
        'src/**/use-cases/**/*.ts': {
          lines: 90,
          branches: 85,
        },
        'src/**/*.controller.ts': {
          lines: 70,
        },
      },
    },
  },
});
