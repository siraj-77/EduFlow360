import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The end-to-end gate must actually run end-to-end tests.
 *
 * `AGENTS.md` section 4 lists E2E among the seven gates that must be green
 * before any production code is merged. A gate that reports success without
 * testing anything is worse than a gate that fails, because it is counted as
 * coverage it does not provide. `AGENTS.md` section 4.1: "a test count is not
 * evidence of coverage."
 *
 * Three separate ways this gate was hollow when this test was written, all
 * of them making `pnpm test:e2e` report success or failure for reasons that
 * had nothing to do with the application:
 *
 *   1. The Playwright `testDir` existed and was EMPTY, so `playwright test`
 *      exited 1 with "Error: No tests found".
 *   2. The config declared a `baseURL` but no `webServer`, so even a real
 *      spec could only pass if a developer had already started the app by
 *      hand. The suite was not self-contained and could not run unattended.
 *   3. `apps/api` declared `test:e2e` as `echo ... && exit 0` - a script
 *      that always succeeds. Root `pnpm test:e2e` runs turbo over every
 *      workspace package, so this stub was reporting a green e2e gate for a
 *      package that has no e2e test, would not pass e2e test, and has no way
 *      to run Playwright.
 */

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate pnpm-workspace.yaml above ' + process.cwd());
}

const ROOT = repoRoot();
const WEB = join(ROOT, 'apps/web');
const E2E_DIR = join(WEB, 'tests/e2e');
const CONFIG = join(WEB, 'playwright.config.ts');

const WORKSPACE_PACKAGES = [
  'apps/api',
  'apps/web',
  'packages/config',
  'packages/shared-types',
  'packages/ui-kit',
  'packages/i18n-resources',
];

/** A script that always exits 0 and never invokes a runner. */
function isPassingStub(script: string): boolean {
  const alwaysSucceeds = /exit\s+0/.test(script);
  const invokesRunner = /playwright|vitest|jest|detox|cypress|node\s+--test|node\s+.*\btest\b/.test(
    script,
  );
  return alwaysSucceeds && !invokesRunner;
}

function specFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /\.spec\.tsx?$/.test(f));
}

describe('the e2e gate runs real end-to-end tests', () => {
  describe('apps/web', () => {
    it('has a Playwright config', () => {
      expect(
        existsSync(CONFIG),
        'apps/web/playwright.config.ts is missing, so pnpm test:e2e cannot run',
      ).toBe(true);
    });

    it('the e2e testDir contains at least one spec', () => {
      const specs = specFiles(E2E_DIR);

      expect(
        specs,
        'apps/web/tests/e2e contains no *.spec.ts. Playwright exits 1 with "Error: No tests found", which is the current state of pnpm test:e2e. An empty testDir is not a passing gate - it is a gate that cannot run.',
      ).not.toHaveLength(0);
    });

    it('every e2e spec declares at least one test', () => {
      for (const spec of specFiles(E2E_DIR)) {
        const body = readFileSync(join(E2E_DIR, spec), 'utf8');
        expect(
          /^\s*(?:test|it)\s*\(/m.test(body),
          `apps/web/tests/e2e/${spec} declares no test(), so Playwright would run it and assert nothing`,
        ).toBe(true);
      }
    });

    it('no e2e spec file is empty', () => {
      // A zero-byte spec is a spec that cannot fail.
      for (const spec of specFiles(E2E_DIR)) {
        expect(
          statSync(join(E2E_DIR, spec)).size,
          `apps/web/tests/e2e/${spec} is 0 bytes`,
        ).toBeGreaterThan(0);
      }
    });

    it('the config is self-contained, so the suite can run unattended', () => {
      const config = readFileSync(CONFIG, 'utf8');

      // Without a webServer block the suite can only pass if a developer has
      // already started the app. In CI that means a separate manual step, and
      // locally it means the gate is only runnable on a prepared machine.
      expect(
        /webServer\s*:/.test(config),
        'apps/web/playwright.config.ts declares no webServer, so pnpm test:e2e requires a dev server to be already running by hand. The suite is not self-contained.',
      ).toBe(true);
    });

    it('the config declares a baseURL for the suite to assert against', () => {
      expect(
        /baseURL\s*:/.test(readFileSync(CONFIG, 'utf8')),
        'apps/web/playwright.config.ts declares no baseURL',
      ).toBe(true);
    });

    it('the e2e port is defined once and both baseURL and webServer.url derive from it', () => {
      const config = readFileSync(CONFIG, 'utf8');

      // Two hard-coded ports drift apart, and the failure is silent and
      // confusing: Playwright probes webServer.url, tests navigate to
      // baseURL, and a mismatch looks like an application bug.
      //
      // On 2026-09-29 port 3000 was hard-coded in the dev script, the start
      // script, baseURL and webServer.url. An unrelated application already
      // bound to 3000 answered the probe with a 307 to its own login page and
      // a 200, Playwright declared the server ready, and the whole suite ran
      // against that app. Every assertion failed for reasons unrelated to
      // EduFlow, and none of the failures mentioned the port.
      //
      // Comments are stripped first, and only literal digits count. The config
      // documents this incident in prose, and the correct form
      // `127.0.0.1:${E2E_PORT}` is a template expression, not a hard-coded
      // port. A first version of this assertion flagged both, which is the
      // failure mode of a regex test: it rejects the fix it was written for.
      const code = config.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      const literalPorts = [...code.matchAll(/(?:localhost|127\.0\.0\.1):(\d+)/g)].map((m) => m[0]);

      expect(
        literalPorts,
        `playwright.config.ts hard-codes a port in ${literalPorts.join(', ')}. Define it once as a constant and derive baseURL, webServer.url and webServer.env.PORT from it.`,
      ).toHaveLength(0);

      expect(
        /webServer\s*:\s*\{[\s\S]*?env\s*:\s*\{[\s\S]*?PORT\s*:/m.test(code),
        'playwright.config.ts does not pass PORT to the webServer, so the app ignores the port the suite chose and binds its own default',
      ).toBe(true);
    });

    it('the suite refuses to reuse an existing server on its port', () => {
      // This is the assertion that actually prevents the silent failure.
      // With `reuseExistingServer: true`, Playwright's readiness probe accepts
      // whatever is already listening: on 2026-09-29 an unrelated app answered
      // a 307 with a 200 and the suite ran against it, 11 failures, none of
      // which mentioned the port. With it false, an occupied port is a loud
      // startup error instead of a wrong test run.
      //
      // Deliberately not asserting the default port value. Setting it back to
      // 3000 is a style regression; reusing a foreign server on 3000 is a
      // correctness one, and only this flag separates them.
      const code = readFileSync(CONFIG, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');

      expect(
        /webServer\s*:\s*\{[\s\S]*?reuseExistingServer\s*:\s*false/.test(code),
        'playwright.config.ts does not set reuseExistingServer: false. Playwright would then accept any server already listening on the e2e port and silently run the suite against it.',
      ).toBe(true);
    });
  });

  describe('every workspace package', () => {
    it('no package declares an e2e script that always passes', () => {
      const stubs: string[] = [];

      for (const dir of WORKSPACE_PACKAGES) {
        const manifest = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as {
          scripts?: Record<string, string>;
        };
        const script = manifest.scripts?.['test:e2e'];
        if (script && isPassingStub(script)) stubs.push(`${dir} -> ${script}`);
      }

      expect(
        stubs,
        `these packages declare a test:e2e that always exits 0 without running a test. Root pnpm test:e2e runs turbo over every package, so each one reports a green e2e gate it does not provide: ${stubs.join(' | ')}. Either remove the script so turbo skips the package, or make it run a real test.`,
      ).toHaveLength(0);
    });
  });
});
