/**
 * SEC-101 — the database deployment script.
 *
 *   node prisma/deploy.mjs            (or: pnpm --filter @eduflow/api deploy:db)
 *
 * Three steps, each fail-fast and each idempotent:
 *
 * 1. `prisma migrate deploy` — applies every pending migration. On a
 *    fresh database that is the whole schema from `0000_baseline`;
 *    on an existing one it is a no-op. Before this script existed
 *    the only way to build a database was `prisma db push`, which
 *    leaves no `_prisma_migrations` table — so `migrate deploy`
 *    could never run, and "fresh clone + pnpm migration:run" had
 *    nothing to run.
 *
 * 2. `hardening/ensure-app-role.sql` — creates the `eduflow_app`
 *    role if it is missing. The immutability hardening revokes from
 *    that role and raises when it does not exist, so a deployment
 *    that skipped this step would fail closed on step 3 rather than
 *    silently skip the revoke. The role is owned by provisioning
 *    (OPS-06); this is the minimum until that lands.
 *
 * 3. `hardening/audit-immutability.sql` — revokes UPDATE, DELETE and
 *    TRUNCATE on `audit_records` from the application role and
 *    installs the append-only trigger (AGENTS.md section 2.7,
 *    PLT-401). Runs after the migrations because the table must
 *    exist first, and is idempotent, so it is safe to re-run on
 *    every deployment.
 *
 * The Prisma CLI is invoked through `process.execPath` so no `.cmd`
 * shim is involved — the same reason `generate.mjs` does this — and
 * `DATABASE_URL` must already be in the environment: the script
 * fails fast naming it rather than defaulting (AGENTS.md section 11).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRISMA_DIR = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(PRISMA_DIR, '..');
const SCHEMA = join(PRISMA_DIR, 'schema.prisma');

/** The Prisma CLI, invoked through node so no .cmd shim is involved. */
function prismaCli() {
  const cli = join(API_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  return existsSync(cli) ? cli : null;
}

function runPrisma(args) {
  const cli = prismaCli();
  if (!cli) {
    throw new Error(
      'Prisma CLI not found at node_modules/prisma/build/index.js. Run `pnpm install` first.',
    );
  }
  execFileSync(process.execPath, [cli, ...args, '--schema', SCHEMA], { stdio: 'inherit' });
}

function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. deploy.mjs applies migrations to a real PostgreSQL and cannot run without one. ' +
        'Set it in the environment, or in the git-ignored .env at the repository root (AGENTS.md section 11).',
    );
  }

  console.log('deploy: applying migrations');
  runPrisma(['migrate', 'deploy']);

  console.log('deploy: ensuring application role eduflow_app');
  runPrisma(['db', 'execute', '--file', join(PRISMA_DIR, 'hardening', 'ensure-app-role.sql')]);

  console.log('deploy: applying audit_records immutability hardening');
  runPrisma(['db', 'execute', '--file', join(PRISMA_DIR, 'hardening', 'audit-immutability.sql')]);

  console.log('deploy: done');
}

main();
