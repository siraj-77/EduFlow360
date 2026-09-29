import { defineConfig, devices } from '@playwright/test';
import { WEB_PORT } from './src/lib/web-port';

/**
 * Playwright. Configured at P2 so `pnpm test:e2e` is runnable and a real
 * failure is distinguishable from "not configured" (AGENTS.md 4).
 *
 * The three flows listed in `testMatch` are the RTL/theme/locale
 * archetypes every later screen copies (DSN-03), so they are the earliest
 * place to catch a broken shell.
 *
 * TWO RULES, BOTH OF WHICH EXIST BECAUSE OF AN INCIDENT
 * ----------------------------------------------------
 * 1. The port comes from `WEB_PORT` and is never written out here. On
 *    2026-09-29 it was hard-coded in four places, an unrelated app answered
 *    the readiness probe on that port with a 307 and a 200, and all 11 tests
 *    ran against the wrong application. See `src/lib/web-port.ts`.
 *
 * 2. `reuseExistingServer: false`. This is the assertion that actually
 *    prevents the silent failure: with it true, the probe accepts whatever is
 *    already listening. With it false, an occupied port is a loud startup
 *    error instead of a wrong test run.
 *
 * `PORT` is passed through to the web server as well, because Next binds its
 * own default otherwise and the two silently disagree.
 */
const BASE_URL = `http://localhost:${WEB_PORT}`;

/**
 * The readiness probe must hit a URL that actually returns 2xx.
 *
 * This was `/en`, with a comment explaining that `/` is a 404 because the app
 * is locale-prefixed. **That 404 was a defect, not a design decision** —
 * `src/middleware.ts` was missing, so nothing negotiated a locale — and this
 * probe had been quietly working around it. A test config accommodating a
 * broken route is how a broken route survives review, and the comment made it
 * read as intended behaviour. `FIX-04`.
 *
 * `src/middleware.ts` now redirects `/` to the best-matching locale, so the
 * probe is back to the root: the thing a visitor actually types. If this ever
 * needs to change again, check whether the *application* broke before assuming
 * the *configuration* is wrong.
 */
const PROBE_PATH = '/';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  /**
   * Per-TEST budget, not per-navigation. Raising `navigationTimeout` alone did
   * not help: the failure was Playwright's 30s test timeout expiring while
   * `/ar` cold-compiled, which the navigation budget cannot extend. Same root
   * cause as the note on `use.navigationTimeout` below.
   */
  timeout: 90_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    /**
     * Navigation needs more than the 30s default, and the reason is structural
     * rather than a slow machine.
     *
     * The web server above deliberately deletes `.next` on every run, so each
     * suite starts with no build cache and compiles every route from source.
     * The Arabic routes are last to be requested, so `/ar` and `/ar/sign-in`
     * routinely exceeded 30s of cold compile and failed as
     * `page.goto: Test timeout of 30000ms exceeded` — a failure that has
     * nothing to do with the assertions under test. Two extra locales' worth of
     * compile time is a fixed cost of the stale-cache fix, so the budget is
     * raised rather than the cache left dirty.
     */
    navigationTimeout: 90_000,
    // Locators on this page wait on `next dev` streaming a route, so the action
    // budget needs the same headroom for the same reason.
    actionTimeout: 30_000,
  },
  // Self-contained: `pnpm test:e2e` must not require a dev server started by
  // hand, or the suite silently tests whatever happens to be listening.
  //
  // `dev`, not `start`: `next start` serves a production build, and on this
  // scaffold a stale `.next` fails at runtime with Next 15's "Page changed from
  // static to dynamic at runtime" — a build artefact problem masquerading as a
  // test failure. The dev server compiles from source, so the suite cannot be
  // broken by a production build left over from an earlier commit.
  //
  // AND `.next` IS CLEARED FIRST, which the comment above used to claim was
  // unnecessary. It is not. `next dev` writes to the same `.next` an interactive
  // `pnpm dev` session uses, so a suite started after someone has been looking
  // at the app inherits their half-written webpack cache. Twice on 2026-09-30
  // that produced `ENOENT ... 0.pack.gz_` cache errors and a cascade of 500s
  // across all four locales — sixteen failing tests, none of which mentioned a
  // stale build. The suite was not testing the application; it was testing
  // someone's leftover editor state.
  //
  // `node -e ... rmSync` rather than `rm -rf`, for the same reason as
  // `AGENTS.md` §8 records: this is a Windows workstation.
  webServer: {
    command:
      'node -e "require(\'node:fs\').rmSync(\'.next\',{recursive:true,force:true})" && npm run dev',
    url: `${BASE_URL}${PROBE_PATH}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(WEB_PORT) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
