import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    /**
     * Integration specs are EXCLUDED, and the exclusion is the point.
     *
     * The `include` glob below ends in `.spec.ts`, and a suffix match also
     * matches a file ending `.integration.spec.ts`. So `pnpm test` - the gate a
     * developer runs to answer "is the product tested?" - would demand a live
     * PostgreSQL and fail on any machine without one. That is the same class of
     * defect as a gate reporting green for the wrong reason: here the unit gate
     * reports RED for the wrong reason, which is worse, because it trains people
     * to ignore it.
     *
     * The two suites are therefore disjoint by construction.
     * `vitest.integration.config.ts` includes only integration specs; this one
     * includes only the rest.
     *
     * Note: no glob pattern is written literally in this comment on purpose. A
     * glob such as the one two lines below contains a forward-slash-asterisk
     * sequence, which silently TERMINATES a block comment. That produced a
     * `SyntaxError: Identifier expected` here, and prettier reported it at the
     * following line rather than at the cause. This repository has now been hit
     * by that footgun three times.
     */
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/*.integration.spec.ts'],
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
