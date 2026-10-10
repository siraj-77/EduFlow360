import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { swcPlugin } from './vitest-swc-plugin.js';

/**
 * `DATABASE_URL` lives in the git-ignored `.env` at the repository root, and
 * nothing loaded it. On a clean shell this gate failed with a *collection*
 * error - `Failed Suites 1`, `0 test` - because the suite threw while being
 * imported, before a single test ran. The message named the variable and then
 * told the developer to "set it in .env", which nothing in the toolchain reads.
 * The gate was only ever observed green because a reviewer exported the
 * variable by hand, which hid the defect rather than fixing it.
 *
 * So the config loads the root `.env` itself, using Node's built-in
 * `process.loadEnvFile()`. No dependency is added: `dotenv` would do this too,
 * and would also be a second, subtly different `.env` parser.
 *
 * Three properties this must hold, each of them a decision rather than an
 * implementation detail:
 *
 * 1. **An already-set `DATABASE_URL` wins.** The guard below tests
 *    `process.env.DATABASE_URL` *before* loading, so CI - which injects
 *    the value from a secret - and a developer who exports it keep their value.
 *    `process.loadEnvFile()` leaves an already-set key untouched (measured on
 *    Node 26.7.0; SSOT D46 records a test catching the opposite assumption
 *    before it shipped), so an exported or CI-injected value wins either way.
 *    The guard exists to fail fast with a message that names the variable
 *    when neither the environment nor `.env` supplies it - not to protect
 *    precedence.
 *
 * 2. **Anchored to this file, not to the working directory.** `import.meta.url`
 *    resolves to this config's own path, so `../../.env` is the repository root
 *    however the command was invoked. `process.cwd()` also happens to resolve
 *    to `apps/api` today (pnpm sets the package directory as cwd), but that is
 *    a property of how the script is launched rather than of the file's
 *    location, and it breaks the moment someone runs
 *    `vitest run --config apps/api/vitest.integration.config.ts` from the root.
 *    Both were measured rather than assumed; `import.meta.url` won.
 *    Note this file is a `.ts` config bundled to CommonJS (apps/api is
 *    `"type": "commonjs"`), so `__dirname` would exist at runtime but would
 *    also be a lie the source does not declare. `import.meta.url` is honest
 *    under either output format.
 *
 * 3. **Fail fast, naming the variable** (AGENTS.md section 11: "Start-up must
 *    fail fast naming the missing variable; no silent defaults"). If neither
 *    the environment nor `.env` supplies it, this throws here - at start-up,
 *    before a worker forks and before a suite is collected - instead of
 *    surfacing as a collection error twenty lines of output later.
 *
 * The `.env` is read, never written, and its values are never printed.
 */
const REPO_ROOT_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');

if (!process.env.DATABASE_URL) {
  if (!existsSync(REPO_ROOT_ENV)) {
    throw new Error(
      'DATABASE_URL is not set and no repository-root .env was found at ' +
        REPO_ROOT_ENV +
        '. The integration suite talks to a real PostgreSQL and cannot run without one. ' +
        'Set DATABASE_URL in the environment, or in the git-ignored .env at the repository root.',
    );
  }

  process.loadEnvFile(REPO_ROOT_ENV);

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. The repository-root .env at ' +
        REPO_ROOT_ENV +
        ' was loaded but does not define DATABASE_URL. Add it there, or set it in the environment.',
    );
  }
}

/**
 * Integration tests run against a real, containerized PostgreSQL on an
 * isolated schema (AGENTS.md section 4; Prompt Pack P4).
 *
 * `passWithNoTests` is deliberately `false`, and the gate is therefore
 * RED until `F-7` supplies the first real integration test.
 *
 * It was `true`, and that made `pnpm test:integration` exit 0 while running
 * nothing — in this package and in `apps/web`, whose `test:integration` was
 * the literal script `echo "no web integration suite at P2" && exit 0`. Two of
 * two declaring packages reported a green integration gate that neither
 * provided. `AUD-30-02`.
 *
 * Two ways to make a gate hollow are now covered by
 * `src/config/integration-gate.spec.ts`: a script that always exits 0, and a
 * config that tolerates an empty include glob. Neither is visible to
 * `isPassingStub()`, which is why this file needed its own assertion.
 *
 * The empty `include` below is not the end state. It is the honest
 * intermediate: a gate that fails because it has no test yet tells the next
 * developer exactly what is missing, where a gate that passes because it has
 * no test yet tells them nothing. `D30`.
 *
 * Do not set this back to `true` to make the gate green.
 */
export default defineConfig({
  /**
   * The same SWC transform the unit suite uses, for the reason given in
   * `vitest-swc-plugin.ts`: without `emitDecoratorMetadata` a Nest container
   * built in an integration spec would silently inject `undefined`.
   *
   * Nothing needs it yet — no integration spec builds a Nest application — and
   * it is here anyway because the first one that does would otherwise inherit a
   * defect that fails as a 500 rather than as an error, and an integration
   * suite is exactly where a future route test would live.
   */
  plugins: [swcPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
});
