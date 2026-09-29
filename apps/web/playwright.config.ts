import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright. Configured at P2 so `pnpm test:e2e` is runnable and a real
 * failure is distinguishable from "not configured" (AGENTS.md 4).
 *
 * The three flows listed in `testMatch` are the RTL/theme/locale
 * archetypes every later screen copies (DSN-03), so they are the earliest
 * place to catch a broken shell.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
