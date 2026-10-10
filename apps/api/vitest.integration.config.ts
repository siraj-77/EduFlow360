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
 * Bound the pool every spec's `new PrismaClient()` opens.
 *
 * Prisma's default pool is `num_physical_cpus * 2 + 1`, which is
 * smaller than the eight concurrent connections the setup-token claim
 * test dispatches on a small runner, so those claims would queue behind
 * the pool's connection timeout instead of running together - and the
 * test would then measure the pool, not the database's atomicity. An
 * explicit limit that comfortably fits the widest concurrent burst keeps
 * the measurement honest. It is appended here, in the one place all
 * fourteen specs inherit, rather than repeated in each spec's
 * `new PrismaClient()`.
 *
 * `connection_limit` is a Prisma connection-string parameter, so it
 * rides the same URL the specs already read; an existing query string
 * (CI passes `?schema=public`) is preserved with `&`.
 */
function withBoundedPool(url: string): string {
  if (/connection_limit=\d+/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=15`;
}

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  // Unreachable: the guard above already threw when neither the
  // environment nor .env supplied DATABASE_URL. This branch exists only
  // to narrow the type for withBoundedPool.
  throw new Error('DATABASE_URL is not set.');
}
process.env.DATABASE_URL = withBoundedPool(databaseUrl);

/**
 * Integration tests run against a real PostgreSQL (AGENTS.md section 4;
 * Prompt Pack P4).
 *
 * What "isolated" means here, stated honestly rather than claimed: the
 * suite is SERIALIZED (`fileParallelism: false` below) and every spec
 * namespaces its rows under a unique `schoolId`, so no two specs write
 * the same rows and no spec runs concurrently with another. It is NOT
 * isolated by schema or by database. Locally the suite runs against the
 * developer's own database (the `DATABASE_URL` in the git-ignored root
 * `.env`), so its rows accumulate there; in CI it runs against a fresh,
 * dedicated database the workflow provisions and migrates. A dedicated
 * test database - created, migrated and dropped per run, so the suite
 * never touches the development database - is the remaining isolation
 * gap and is owned by provisioning (OPS-06), not by this config. It is
 * recorded here rather than asserted, because a config that claims an
 * isolation it does not implement is the defect class FIX-18 removed
 * from ARCHITECTURE.md section 17.
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
    // SEC-112: spec files run one at a time. The default is parallel,
    // which let fourteen specs each open their own PrismaClient against
    // one database at the same time - the mechanism behind the
    // setup-token concurrency flake. Serializing the files removes the
    // cross-file races; the eight contenders inside the setup-token test
    // still run concurrently on one pool, which is the claim under test.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
