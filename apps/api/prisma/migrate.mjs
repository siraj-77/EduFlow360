/**
 * SEC-115 — the migration runner.
 *
 *   node prisma/migrate.mjs migrate deploy            (pnpm migration:run)
 *   node prisma/migrate.mjs migrate dev --name <n>  (pnpm migration:generate)
 *
 * WHY THIS EXISTS
 * ---------------
 * The Prisma CLI reads `.env` beside `schema.prisma`
 * (`apps/api/prisma/.env`), which does not exist. `DATABASE_URL`
 * lives in the git-ignored `.env` at the repository root. So a bare
 * `prisma migrate deploy` failed with `Validation Error Count: 1` in
 * any shell that had not exported `DATABASE_URL` by hand — the gate
 * was only ever green because a reviewer exported the variable, which
 * hid the defect rather than fixing it. That is the same failure mode
 * `vitest.integration.config.ts` and `seed.mjs` each record for their
 * own loader; this closes it for the Prisma CLI, the one loader that
 * still had it.
 *
 * This wrapper loads the repository-root `.env` before the Prisma CLI
 * runs, using Node's built-in `process.loadEnvFile()` — no dependency
 * added, and no second `.env` parser that could disagree with the
 * first about precedence. `process.loadEnvFile()` does NOT replace an
 * already-set key (measured on Node 26.7.0; SSOT D46), so a
 * `DATABASE_URL` exported in the environment, or injected by CI from a
 * secret, wins over the file — the same precedence the API application
 * itself uses (`env-files.ts`).
 *
 * The Prisma CLI is invoked through `process.execPath` so no `.cmd`
 * shim is involved — the same reason `deploy.mjs` and `generate.mjs`
 * do this — and every argument after the script name is forwarded, so
 * `migrate deploy`, `migrate dev --name <name>` and any future Prisma
 * subcommand all work unchanged. `--schema` is appended last so this
 * wrapper always targets the checked-in schema regardless of the
 * working directory it was launched from.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRISMA_DIR = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(PRISMA_DIR, '..');
const SCHEMA = join(PRISMA_DIR, 'schema.prisma');

/**
 * Load the repository-root `.env`, if there is one.
 *
 * Tolerated when absent, because a deployment may inject
 * `DATABASE_URL` through the environment instead — and
 * `process.loadEnvFile` throws when the file is missing. A genuinely
 * missing variable is Prisma's error to raise, with a better message
 * than this could write.
 */
try {
  process.loadEnvFile(join(PRISMA_DIR, '..', '..', '..', '.env'));
} catch {
  // No root .env. The variable must come from the environment; Prisma will say so if it does not.
}

/** The Prisma CLI, invoked through node so no .cmd shim is involved. */
function prismaCli() {
  const cli = join(API_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  return existsSync(cli) ? cli : null;
}

function main() {
  const cli = prismaCli();
  if (!cli) {
    throw new Error(
      'Prisma CLI not found at node_modules/prisma/build/index.js. Run `pnpm install` first.',
    );
  }

  // Forward every argument after the script name, then pin the schema.
  const args = process.argv.slice(2);
  execFileSync(process.execPath, [cli, ...args, '--schema', SCHEMA], { stdio: 'inherit' });
}

main();
