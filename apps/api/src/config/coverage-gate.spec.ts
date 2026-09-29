import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The coverage gate must be runnable, not merely configured.
 *
 * `AGENTS.md` section 4 makes `pnpm test:coverage` a mandatory gate and says
 * plainly: "The coverage gate is mandatory, not aspirational." Section 4.1
 * adds that "a test count is not evidence of coverage".
 *
 * A `vitest.config.ts` can declare `coverage.provider: 'v8'` and a full set of
 * `coverage.thresholds` and still enforce nothing, because Vitest resolves the
 * provider package at runtime with a dynamic import. If that package is absent
 * the run dies with `MISSING DEPENDENCY` before a single test executes, and the
 * thresholds are never consulted.
 *
 * That is exactly the state the repository was in when this test was written:
 * every test-bearing package declared `test:coverage`, the configs declared
 * `provider: 'v8'` and the section 4 tiers, and `pnpm test:coverage` exited 1
 * in all of them.
 *
 * These tests assert the invariant so a future package cannot repeat it.
 */

/** Walk up from the cwd until the workspace marker is found, so the test is
 *  anchored to the repository rather than to the working directory. */
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
  devDependencies?: Record<string, string>;
}

const ROOT = repoRoot();

/** Every workspace project, matching the list pnpm itself uses. */
const WORKSPACE_DIRS = ['apps/api', 'apps/web', 'packages/config', 'packages/shared-types', 'packages/ui-kit', 'packages/i18n-resources'];

/** Vitest's default when no config file is present. */
const DEFAULT_PROVIDER = 'v8';

/** Vitest provider name -> the package that implements it. */
const PROVIDER_PACKAGE: Record<string, string> = {
  v8: '@vitest/coverage-v8',
  istanbul: '@vitest/coverage-istanbul',
};

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

function configPathFor(dir: string): string | undefined {
  return ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts', 'vitest.config.mjs'].map((f) => join(ROOT, dir, f)).find((p) => existsSync(p));
}

/**
 * The provider a package will actually use: whatever its config declares, or
 * Vitest's default when it has no config at all. Three of the six workspace
 * packages have no vitest config and rely entirely on the default.
 */
function providerFor(dir: string): string {
  const configPath = configPathFor(dir);
  if (!configPath) return DEFAULT_PROVIDER;
  return /provider:\s*'([^']+)'/.exec(readFileSync(configPath, 'utf8'))?.[1] ?? DEFAULT_PROVIDER;
}

const COVERAGE_GATED = WORKSPACE_DIRS.map((dir) => ({ dir, name: readJson(join(ROOT, dir, 'package.json')).name ?? dir })).filter(({ dir }) => {
  const script = readJson(join(ROOT, dir, 'package.json')).scripts?.['test:coverage'] ?? '';
  return script.includes('vitest run --coverage');
});

describe('the coverage gate is runnable, not merely configured', () => {
  it('finds the packages that declare a coverage gate', () => {
    // A guard on the guard. If the workspace ever changes such that no package
    // runs coverage, the tests below would pass vacuously.
    expect(COVERAGE_GATED.map((p) => p.dir)).toEqual(['apps/api', 'apps/web', 'packages/shared-types', 'packages/ui-kit', 'packages/i18n-resources']);
  });

  describe.each(COVERAGE_GATED)('$name', ({ dir, name }) => {
    it('declares its coverage provider as a devDependency', () => {
      const provider = providerFor(dir);
      const required = PROVIDER_PACKAGE[provider];

      expect(required, `${name} uses coverage provider "${provider}", which this test does not know how to satisfy`).toBeDefined();

      const devDeps = Object.keys(readJson(join(ROOT, dir, 'package.json')).devDependencies ?? {});

      expect(
        devDeps,
        `${name} runs "vitest run --coverage" (provider "${provider}") but does not declare ${required}. The gate will exit 1 with MISSING DEPENDENCY before a single test runs, and no coverage threshold is ever enforced.`,
      ).toContain(required);
    });

    it('can actually resolve its coverage provider from its own node_modules', () => {
      const required = PROVIDER_PACKAGE[providerFor(dir)] as string;

      // pnpm uses an isolated node_modules layout, so a package may only load
      // what it declares. Resolving from the package's own directory is the
      // same resolution Vitest performs, which is why declaring the dependency
      // is necessary but not by itself sufficient.
      const requireFromPackage = createRequire(resolve(ROOT, dir, 'package.json'));

      expect(() => requireFromPackage.resolve(required), `${name} declares ${required} but it is not installed. Run pnpm install.`).not.toThrow();
    });
  });

  it('every vitest config that sets thresholds also sets a provider', () => {
    // A threshold with no provider is inert. This catches the shape of the
    // defect in any config, including one added later.
    for (const dir of WORKSPACE_DIRS) {
      const configPath = configPathFor(dir);
      if (!configPath) continue;

      const config = readFileSync(configPath, 'utf8');
      if (!/thresholds:/.test(config)) continue;

      expect(/provider:\s*'[^']+'/.test(config), `${dir} sets coverage.thresholds but no coverage.provider, so its thresholds are inert`).toBe(true);
    }
  });
});
