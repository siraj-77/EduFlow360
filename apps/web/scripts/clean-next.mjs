import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wipe the Next.js build output. Runs as the first half of the
 * `dev:e2e` script (see `package.json`), so the wipe COMPLETES
 * before `next dev` starts.
 *
 * WHY A FILE AND NOT SHELL TEXT
 * -----------------------------------
 * The wipe used to be inline shell in the webServer command:
 * `node -e "require('node:fs').rmSync('.next')" && npm run dev`.
 * Extracting it makes the wipe a named, hand-runnable step
 * (`node scripts/clean-next.mjs`) rather than shell text embedded
 * in a config value.
 *
 * WHY CHAINED INTO THE SERVER COMMAND AND NOT `globalSetup`
 * -----------------------------------------------------------
 * Playwright starts the webServer plugin BEFORE it runs
 * `globalSetup` — the plugin setup tasks precede the global-setup
 * tasks in the runner's task list. A `globalSetup` wipe therefore
 * deletes `.next` out from under the already-running dev server.
 * That was tried on 2026-10-09 (OPS-112) and failed 27 of 37
 * e2e tests with `ENOENT ... routes-manifest.json` and webpack
 * pack-cache ENOENTs; the chained form passes 37/37. The `&&`
 * chain is the ordering guarantee.
 *
 * The path is resolved from this file rather than `process.cwd()`,
 * so the wipe always targets `apps/web/.next` however the script
 * was invoked. `force: true` makes a missing `.next` a no-op,
 * which is the normal state on a fresh checkout.
 */
const nextDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.next');

rmSync(nextDir, { recursive: true, force: true });
