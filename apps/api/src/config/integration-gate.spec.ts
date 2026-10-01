import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The integration gate must not report success without running a test.
 *
 * `AGENTS.md` section 4 makes `pnpm test:integration` one of the nine gates
 * that must be green before production code is merged. On 2026-09-30 this gate
 * was green in **both** packages that declared it, and neither ran anything:
 *
 *   - `apps/web/package.json` declared the literal script
 *     `echo "no web integration suite at P2" && exit 0`.
 *   - `apps/api/vitest.integration.config.ts` set `passWithNoTests: true`
 *     over an `include` glob matching zero files.
 *
 * Two of two. `AUD-30-02`.
 *
 * `isPassingStub()` already existed in `e2e-gate.spec.ts` and detects exactly
 * the first shape - it was written on 2026-09-29 to stop `test:e2e` reporting a
 * green from a stub, and it works. It was simply never pointed at
 * `test:integration`. The same file also had no equivalent for the second
 * shape, because `passWithNoTests` is a config key rather than a script.
 *
 * Two ways to make a gate hollow are covered here, and a third is covered
 * because it is the obvious wrong fix: deleting every `test:integration`
 * script would make this file pass while `pnpm test:integration` reported
 * success having run nothing at all. `AGENTS.md` section 4 requires the gate to
 * exist, so "nobody declares it" is a defect, not a resolution.
 *
 * **The gate is left RED on purpose.** `passWithNoTests: false` over an empty
 * `include` glob exits non-zero, and that is the honest state until `F-7`
 * supplies the first real integration test against a containerized PostgreSQL.
 * A red gate is honest; a green one that ran nothing is worse. `D30`.
 */

/** A script that always exits 0 and never invokes a runner. */
function isPassingStub(script: string): boolean {
  const alwaysSucceeds = /exit\s+0/.test(script);
  const invokesRunner = /playwright|vitest|jest|detox|cypress|node\s+--test|node\s+.*\btest\b/.test(
    script,
  );
  return alwaysSucceeds && !invokesRunner;
}

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

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

const ROOT = repoRoot();
const WORKSPACE_PACKAGES = [
  'apps/api',
  'apps/web',
  'packages/config',
  'packages/shared-types',
  'packages/ui-kit',
  'packages/i18n-resources',
];

function readManifest(dir: string): PackageJson {
  return JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as PackageJson;
}

function declaringIntegration(dir: string): string | undefined {
  return readManifest(dir).scripts?.['test:integration'];
}

const DECLARING = WORKSPACE_PACKAGES.filter((dir) => declaringIntegration(dir) !== undefined);

describe('the integration gate runs integration tests', () => {
  describe('the stub detector', () => {
    // A guard on the guard. If isPassingStub stopped recognising the shape it
    // was written for, every assertion below would pass without checking
    // anything - which is the same class of defect this file exists to catch.
    it('recognises a script that exits 0 without a runner', () => {
      expect(isPassingStub('echo "no web integration suite at P2" && exit 0')).toBe(true);
    });

    it('does not flag a script that invokes a runner', () => {
      expect(isPassingStub('vitest run --config vitest.integration.config.ts')).toBe(false);
    });

    it('does not flag a real failing command, however it is phrased', () => {
      expect(isPassingStub('vitest run --coverage || exit 1')).toBe(false);
      expect(isPassingStub('playwright test')).toBe(false);
    });
  });

  it('at least one package declares an integration gate', () => {
    expect(
      DECLARING,
      'no workspace package declares test:integration, so `pnpm test:integration` would report success having run nothing. AGENTS.md section 4 requires the gate. Removing every script is not the fix; supplying a real test is.',
    ).not.toHaveLength(0);
  });

  describe.each(DECLARING)('$dir', (dir) => {
    it('does not declare a test:integration that always passes', () => {
      const script = declaringIntegration(dir) as string;

      expect(
        isPassingStub(script),
        `${dir} declares test:integration as "${script}" - a script that always exits 0 without running a test. Root pnpm test:integration runs turbo over every package, so this reports a green integration gate it does not provide. Either remove the script so turbo skips the package, or make it run a real test.`,
      ).toBe(false);
    });
  });

  describe('every vitest integration config', () => {
    const CONFIGS = WORKSPACE_PACKAGES.map((dir) => ({
      dir,
      path: [
        'vitest.integration.config.ts',
        'vitest.integration.config.js',
        'vitest.integration.config.mts',
        'vitest.integration.config.mjs',
      ]
        .map((f) => join(ROOT, dir, f))
        .find((p) => existsSync(p)),
    })).filter((c): c is { dir: string; path: string } => c.path !== undefined);

    it('finds the integration configs on disk', () => {
      // Without this, an empty CONFIGS would make every case below vacuous.
      expect(
        CONFIGS.map((c) => c.dir),
        'no vitest.integration.config.* was found, so the passWithNoTests assertions are checking nothing',
      ).not.toHaveLength(0);
    });

    it.each(CONFIGS)('$dir does not set passWithNoTests', ({ path }) => {
      const config = readFileSync(path, 'utf8');

      expect(
        /passWithNoTests\s*:\s*true/.test(config),
        `${path} sets passWithNoTests: true. Vitest then exits 0 when its include glob matches no files, so the integration gate reports success having run nothing. This is the second hollow-gate shape, and unlike a script stub it is invisible to isPassingStub(). Leave it false: the gate stays red until F-7 supplies a real integration test, which is the honest state.`,
      ).toBe(false);
    });

    /**
     * The gate is also unreachable without help. `DATABASE_URL` lives in the
     * git-ignored `.env` at the repository root and nothing loaded it, so on a
     * clean shell `pnpm test:integration` died as a *collection* error
     * (`Failed Suites 1`, `0 test`) while telling the developer to "set it in
     * .env" - advice no tool in the repository acted on. Every earlier green
     * observation of this gate came from a reviewer exporting the variable by
     * hand, which hid the defect instead of fixing it.
     *
     * These are text-level assertions on the config, deliberately the same
     * idiom already used for `passWithNoTests` above: a config cannot be
     * imported inside a unit test, because importing it is precisely the act
     * that throws when the variable is absent. The ordering assertion below is
     * the load-bearing one - it is what makes "never override an
     * already-set variable" structural rather than aspirational.
     *
     * Every pattern here is anchored to executable form - a real `if (...)`, a
     * real call with an argument, a quoted literal - rather than to the bare
     * name. The first version of these assertions matched this paragraph and
     * the config's own doc comment, which proved nothing: `indexOf('loadEnvFile')`
     * reports an offset inside prose, not inside code. A guard that can be
     * satisfied by a comment is not a guard.
     */
    it.each(CONFIGS)('$dir loads DATABASE_URL from the repository-root .env', ({ path }) => {
      const config = readFileSync(path, 'utf8');

      expect(
        /process\.loadEnvFile\(\s*[A-Za-z_$]/.test(config),
        `${path} does not call process.loadEnvFile(<path>). The integration suite needs DATABASE_URL, which lives in the git-ignored .env at the repository root. Without this the gate fails at collection time with no test run at all. Node's built-in loader is sufficient; do not add dotenv.`,
      ).toBe(true);

      expect(
        /['"]\.\.\/\.\.\/\.env['"]/.test(config),
        `${path} does not reference the quoted literal '../../.env', so it is not looking at the repository root. The config lives in apps/api, so the root .env is two levels up.`,
      ).toBe(true);
    });

    it.each(CONFIGS)(
      '$dir checks DATABASE_URL before loading, so it never overrides it',
      ({ path }) => {
        const config = readFileSync(path, 'utf8');

        const guardAt = config.search(/\bif\s*\(\s*!\s*process\.env\.DATABASE_URL\s*\)/);
        const loadAt = config.search(/process\.loadEnvFile\(\s*[A-Za-z_$]/);

        expect(
          guardAt,
          `${path} has no executable \`if (!process.env.DATABASE_URL)\` guard around the load. process.loadEnvFile() overwrites existing keys, so loading unconditionally would silently replace a value CI injected from a secret and make the gate non-deterministic across environments.`,
        ).toBeGreaterThanOrEqual(0);
        expect(loadAt, `${path} does not call process.loadEnvFile(<path>)`).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          guardAt,
          `${path} loads the .env at offset ${loadAt} but only checks DATABASE_URL at offset ${guardAt}. The check has to come first, or an already-set DATABASE_URL gets overwritten.`,
        ).toBeLessThan(loadAt);
      },
    );

    it.each(CONFIGS)('$dir names DATABASE_URL when it cannot start', ({ path }) => {
      const config = readFileSync(path, 'utf8');

      expect(
        /throw new Error\(\s*['"`]?[\s\S]{0,4}DATABASE_URL is not set/.test(config),
        `${path} has no start-up error naming DATABASE_URL. AGENTS.md section 11 requires start-up to fail fast naming the missing variable, with no silent default.`,
      ).toBe(true);
    });

    it.each(CONFIGS)('$dir does not hardcode a database credential', ({ path }) => {
      const config = readFileSync(path, 'utf8');

      expect(
        /postgres(?:ql)?:\/\/[^:]+:[^@]+@/.test(config),
        `${path} contains what looks like an inline PostgreSQL connection string. The URL belongs in the git-ignored .env or the environment. A credential in a tracked config is a leaked credential.`,
      ).toBe(false);
    });
  });
});
