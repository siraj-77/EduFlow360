import { defineConfig } from 'vitest/config';
import { swcPlugin } from './vitest-swc-plugin.js';

export default defineConfig({
  /**
   * SWC replaces esbuild as the transform for this suite.
   *
   * The reason, the measurements behind it and the packages that were rejected
   * are all in `vitest-swc-plugin.ts`. In one line: esbuild does not implement
   * `emitDecoratorMetadata`, so without this plugin Nest silently injects
   * `undefined` into every constructor-injected class in this package — the
   * container still "builds", and `GET /auth/oidc/redirect` still answers 500.
   *
   * `vitest-swc-plugin.ts` is shared with `vitest.integration.config.ts` rather
   * than duplicated, so there is one transform in this package and not two that
   * can drift.
   */
  plugins: [swcPlugin()],
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
    /**
     * The default 5s budget was the last ungated timeout in this suite,
     * and the plausible mechanism behind the cold-cache guard-spec
     * flakes (`OPS-112`).
     *
     * The two over-HTTP guard specs boot a Nest application and a real
     * socket per test. On a cold turbo cache every package's vitest
     * instance starts at once, and CPU contention alone can push a boot
     * past 5s — a failure that has nothing to do with the code under
     * test. The claimed ~1-in-5 cold rate did not reproduce on
     * 2026-10-09 (20/20 isolated runs, 10/10 cold full-suite runs),
     * but the one unexplained failure that session was the first run
     * after a `turbo.json` change, which invalidates the entire cache —
     * exactly the cold condition.
     *
     * Headroom is the mechanism-agnostic fix, and the same reasoning
     * that raised the Playwright budgets to 90s
     * (`apps/web/playwright.config.ts`): a genuinely hung test still
     * fails, just later. The plan's alternative — polling a cache until
     * it is warm — does not map to these specs: their caches are
     * synchronous in-memory doubles with no warmup state, so there is
     * no race for a readiness assertion to close.
     */
    testTimeout: 30_000,
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
