import { defineConfig, devices } from '@playwright/test';
import { WEB_PORT } from './web-port';

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
 *    ran against the wrong application. See `web-port.ts`.
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
 * `/` is a **404** here: the app is locale-prefixed (`/en`, `/ta`, `/si`,
 * `/ar`), so probing the root makes Playwright wait out its full timeout on a
 * server that is up and serving. The tests navigate to `/${locale}`
 * themselves, so only the probe needs the real path.
 */
const PROBE_PATH = '/en';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  // Self-contained: `pnpm test:e2e` must not require a dev server started by
  // hand, or the suite silently tests whatever happens to be listening.
  //
  // `dev`, not `start`: `next start` serves a production build, and on this
  // scaffold a stale `.next` build fails at runtime with Next 15's "Page
  // changed from static to dynamic at runtime" — a build artefact problem
  // masquerading as a test failure. The dev server compiles from source, so
  // the suite cannot be broken by a build left over from an earlier commit.
  webServer: {
    command: 'npm run dev',
    url: `${BASE_URL}${PROBE_PATH}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(WEB_PORT) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
