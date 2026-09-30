import { existsSync, globSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every spec file on disk must be executed by some runner.
 *
 * `apps/web/web-port.spec.ts` existed on 2026-09-29 and had never run. It
 * matched neither of its package's Vitest `include` globs - the file sat at the
 * package root while the globs were `src/**` and `tests/**` - and Vitest
 * applies `include` as a filter even to explicit command-line arguments, so
 * naming the file on the command line found nothing either.
 *
 * What it guarded is why the finding was P0. The test exists because on
 * 2026-09-29 an unrelated application holding port 3000 answered Playwright's
 * readiness probe with a 200, and all 11 e2e tests ran against it. The port
 * was then centralised into one constant, and this test was written to hold the
 * one accepted duplication of that number in place. It could not: it never ran.
 *
 * A test that does not run is worse than no test. It survives review, it looks
 * like evidence, and it blocks deletion of the real fix. `D36`.
 *
 * `coverage-gate.spec.ts` and `e2e-gate.spec.ts` already answer "is this gate
 * wired to anything?" for two specific gates. This is the general oracle for
 * the class, so the defect cannot recur in a fourth package unobserved.
 *
 * The glob engine is `node:fs`'s own `globSync`, not a re-implementation and not
 * a new dependency: the same `**`, brace and extglob forms the configs already
 * use all resolve, including Vitest's `**\/*.{test,spec}.?(c|m)[jt]s?(x)`
 * default.
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

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

const ROOT = repoRoot();

const WORKSPACE_DIRS = [
  'apps/api',
  'apps/web',
  'packages/config',
  'packages/shared-types',
  'packages/ui-kit',
  'packages/i18n-resources',
];

/** Vitest 2.x defaults, used by any package with no `vitest.config.*`. */
const VITEST_DEFAULT_INCLUDE = ['**/*.{test,spec}.?(c|m)[jt]s?(x)'];
const VITEST_DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
];

/** Directories that are never source, whatever a glob says. */
const NEVER_SOURCE = [
  'node_modules',
  'dist',
  '.next',
  'coverage',
  'test-results',
  'playwright-report',
  '.turbo',
];

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

function configPathFor(dir: string, name: string): string | undefined {
  return [`${name}.config.ts`, `${name}.config.js`, `${name}.config.mts`, `${name}.config.mjs`]
    .map((f) => join(ROOT, dir, f))
    .find((p) => existsSync(p));
}

/**
 * Read a `key: ['a', 'b']` array out of a config file.
 *
 * Deliberately a plain text read rather than an import: importing a Vitest
 * config executes its plugins, and a config's `include` is data about which
 * files a runner will collect, not behaviour to be run.
 */
function stringArrayIn(config: string, key: string): string[] | undefined {
  const start = config.search(new RegExp(`\\b${key}\\s*:`));
  if (start === -1) return undefined;
  const open = config.indexOf('[', start);
  if (open === -1) return undefined;
  const close = config.indexOf(']', open);
  if (close === -1) return undefined;
  return [...config.slice(open, close).matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
}

/** Every spec or test file physically present under a package, as posix relative paths. */
function specFilesOnDisk(pkgDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (NEVER_SOURCE.includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(spec|test)\.[cm]?[jt]s[x]?$/.test(entry.name)) {
        found.push(relative(pkgDir, full).split('\\').join('/'));
      }
    }
  };
  walk(pkgDir);
  return found.sort();
}

/** Expand globs to a set of posix relative paths, tolerating a pattern that matches nothing. */
function expand(pkgDir: string, patterns: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const pattern of patterns) {
    for (const hit of globSync(pattern, { cwd: pkgDir })) {
      out.add(relative(pkgDir, join(pkgDir, hit)).split('\\').join('/'));
    }
  }
  return out;
}

interface Owner {
  readonly runner: string;
  readonly globs: string[];
}

function ownersFor(dir: string): Owner[] {
  const pkgDir = join(ROOT, dir);
  const owners: Owner[] = [];

  /**
   * EVERY Vitest config in the package, not just the default one.
   *
   * `apps/api` has two: `vitest.config.ts` (unit) and
   * `vitest.integration.config.ts`. Reading only the default reported
   * `database-contract.integration.spec.ts` as "exists on disk but no runner
   * collects it" once the unit config began excluding integration specs - which
   * is this oracle working, but the oracle was the thing that was wrong. A
   * separate integration config is a normal arrangement, and an owner list that
   * ignores it reports a false orphan.
   */
  let sawVitestConfig = false;
  for (const name of ['vitest', 'vitest.integration']) {
    const config = configPathFor(dir, name);
    if (!config) continue;
    sawVitestConfig = true;
    const raw = readFileSync(config, 'utf8');
    const include = stringArrayIn(raw, 'include') ?? VITEST_DEFAULT_INCLUDE;
    const exclude = stringArrayIn(raw, 'exclude') ?? VITEST_DEFAULT_EXCLUDE;
    const excluded = expand(pkgDir, exclude);
    const collected = new Set([...expand(pkgDir, include)].filter((f) => !excluded.has(f)));
    if (collected.size > 0) {
      owners.push({ runner: name, globs: [...collected].sort() });
    }
  }

  // A package with no vitest config at all still runs Vitest, on the defaults.
  // `@eduflow/shared-types` and `@eduflow/i18n-resources` are both in that
  // position, and dropping this fallback made the oracle report their specs as
  // orphans - the oracle's own regression, caught by the oracle.
  if (!sawVitestConfig) {
    const excluded = expand(pkgDir, VITEST_DEFAULT_EXCLUDE);
    const collected = new Set(
      [...expand(pkgDir, VITEST_DEFAULT_INCLUDE)].filter((f) => !excluded.has(f)),
    );
    if (collected.size > 0) {
      owners.push({ runner: 'vitest', globs: [...collected].sort() });
    }
  }

  const playwrightConfig = configPathFor(dir, 'playwright');
  if (playwrightConfig) {
    const testDir = /testDir\s*:\s*['"]([^'"]+)['"]/.exec(
      readFileSync(playwrightConfig, 'utf8'),
    )?.[1];
    if (testDir) {
      const abs = join(pkgDir, testDir);
      if (existsSync(abs)) {
        const rel = testDir.replace(/^\.\//, '');
        owners.push({
          runner: 'playwright',
          globs: [...expand(abs, ['**/*.{spec,test}.?(c|m)[jt]s?(x)'])]
            .map((f) => `${rel}/${f}`)
            .sort(),
        });
      }
    }
  }

  return owners;
}

const TESTED = WORKSPACE_DIRS.map((dir) => {
  const pkgDir = join(ROOT, dir);
  return {
    dir,
    name: readJson(join(pkgDir, 'package.json')).name ?? dir,
    pkgDir,
    onDisk: specFilesOnDisk(pkgDir),
  };
}).filter(({ pkgDir }) => statSync(pkgDir).isDirectory());

describe('every spec file on disk is executed by some runner', () => {
  it('finds the packages that hold spec files', () => {
    // A guard on the guard. If the walk ever silently returns nothing, every
    // assertion below would pass without having checked a single file.
    const holders = TESTED.filter((p) => p.onDisk.length > 0).map((p) => p.dir);

    expect(
      holders,
      'no spec files were found anywhere, so the oracle below is asserting nothing',
    ).not.toHaveLength(0);
    expect(holders).toContain('apps/api');
    expect(holders).toContain('apps/web');
  });

  it('gives every detected runner a non-empty glob set', () => {
    // A runner detected from its config but handed zero files is a silent
    // failure mode: every downstream comparison treats its files as unowned and
    // the per-package assertion below reports them, but the "both runners run"
    // check still passes. This is not hypothetical - the first version of this
    // file carried the glob `[jt]s[x]?` instead of `[jt]s?(x)`, which matches
    // nothing at all, and produced a false RED that looked like a repository
    // defect.
    for (const { dir, name } of TESTED.filter((p) => p.onDisk.length > 0)) {
      for (const owner of ownersFor(dir)) {
        expect(
          owner.globs,
          `${name}: the ${owner.runner} config was found but its globs resolved to zero files, so its ownership of anything is being assumed rather than measured`,
        ).not.toHaveLength(0);
      }
    }
  });

  it('sees a spec file in every package that declares a test script', () => {
    for (const { dir, name, pkgDir, onDisk } of TESTED) {
      const script = readJson(join(pkgDir, 'package.json')).scripts?.['test'] ?? '';
      if (!script.includes('vitest')) continue;

      expect(
        onDisk,
        `${name} runs vitest but no *.spec.* file was found under ${dir}`,
      ).not.toHaveLength(0);
    }
  });

  describe.each(TESTED.filter((p) => p.onDisk.length > 0))(
    '$name',
    ({ dir, name, pkgDir, onDisk }) => {
      it('has every spec file on disk matched by a runner include glob', () => {
        const owners = ownersFor(dir);
        const collected = new Set(owners.flatMap((o) => o.globs));
        const unmatched = onDisk.filter((f) => !collected.has(f));

        expect(
          unmatched,
          `${name}: ${unmatched.length} spec file(s) exist on disk but no runner collects them:\n` +
            unmatched.map((f) => `  ${dir}/${f}`).join('\n') +
            `\n\nA file outside every include glob has never run and never will. Vitest applies\n` +
            `include as a filter even to explicit command-line arguments, so passing the path\n` +
            `does not help. Move the file inside the globs, or widen them.`,
        ).toEqual([]);
      });

      it('has no empty spec file', () => {
        const empty = onDisk.filter((f) => statSync(join(pkgDir, f)).size === 0);

        expect(
          empty,
          `${name}: ${empty.map((f) => `${dir}/${f}`).join(', ')} is 0 bytes. A runner collects it and asserts nothing.`,
        ).toEqual([]);
      });
    },
  );

  it('apps/web splits its specs between Vitest and Playwright without overlap', () => {
    const owners = ownersFor('apps/web');
    const runners = owners.map((o) => o.runner).sort();

    expect(
      runners,
      'apps/web must be discovered by both runners, or one of them is running nothing',
    ).toEqual(['playwright', 'vitest']);

    const vitest = new Set(owners.find((o) => o.runner === 'vitest')?.globs ?? []);
    const playwright = owners.find((o) => o.runner === 'playwright')?.globs ?? [];
    const both = playwright.filter((f) => vitest.has(f));

    expect(
      both,
      `these files are claimed by both runners, so each would load the other's test API and fail to parse:\n  ${both.join('\n  ')}`,
    ).toEqual([]);
  });

  it('reads include globs out of the configs rather than assuming them', () => {
    // If the parser silently returned nothing, every package would fall back to
    // the Vitest default and match nearly everything, making the oracle above
    // pass for the wrong reason.
    const apiConfig = readFileSync(join(ROOT, 'apps/api/vitest.config.ts'), 'utf8');
    const webConfig = readFileSync(join(ROOT, 'apps/web/vitest.config.ts'), 'utf8');

    expect(stringArrayIn(apiConfig, 'include'), 'apps/api include globs were not parsed').toEqual([
      'src/**/*.spec.ts',
    ]);
    expect(stringArrayIn(webConfig, 'include'), 'apps/web include globs were not parsed').toEqual([
      'src/**/*.spec.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
    ]);
  });
});
