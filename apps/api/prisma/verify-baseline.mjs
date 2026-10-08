/**
 * SEC-101 — the shadow-database check (action plan B-1, T3).
 *
 *   node prisma/verify-baseline.mjs      (or: pnpm --filter @eduflow/api verify:baseline)
 *
 * Proves the baseline migration is complete and self-sufficient:
 *
 * 1. creates a scratch database,
 * 2. applies ONLY the committed migrations to it (`prisma migrate
 *    deploy`, with `DATABASE_URL` pointed at the scratch database),
 * 3. diffs the result against `schema.prisma`
 *    (`prisma migrate diff --from-schema-database …
 *    --to-schema-datamodel … --script`), and fails if the diff is
 *    anything but empty,
 * 4. drops the scratch database.
 *
 * An empty diff means the migration history reproduces the schema
 * exactly: nothing lives only in `db push`, and nothing in the
 * schema is missing from the migrations. That is the acceptance
 * criterion "fresh clone + pnpm migration:run produces a working
 * database", checked mechanically instead of by assertion.
 *
 * The scratch database is created and dropped through the Prisma
 * client as the `DATABASE_URL` user, which therefore needs CREATEDB
 * — the repository's dev and CI roles have it. `WITH (FORCE)`
 * terminates any leftover connections so a re-run cannot fail on a
 * database the previous run left behind (PostgreSQL 13+; the
 * repository targets 18).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const PRISMA_DIR = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(PRISMA_DIR, '..');
const SCHEMA = join(PRISMA_DIR, 'schema.prisma');
const SCRATCH_DB = 'eduflow_baseline_check';

/** The Prisma CLI, invoked through node so no .cmd shim is involved. */
function prismaCli() {
  const cli = join(API_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  return existsSync(cli) ? cli : null;
}

/** The scratch database's connection string, derived from DATABASE_URL. */
function scratchUrl() {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${SCRATCH_DB}`;
  return url.toString();
}

function runPrisma(args, env) {
  const cli = prismaCli();
  if (!cli) {
    throw new Error(
      'Prisma CLI not found at node_modules/prisma/build/index.js. Run `pnpm install` first.',
    );
  }
  execFileSync(process.execPath, [cli, ...args], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, ...env },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. verify-baseline.mjs creates a scratch PostgreSQL database and cannot run without one. ' +
        'Set it in the environment, or in the git-ignored .env at the repository root (AGENTS.md section 11).',
    );
  }

  const prisma = new PrismaClient();
  try {
    console.log(`verify-baseline: creating scratch database ${SCRATCH_DB}`);
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await prisma.$executeRawUnsafe(`CREATE DATABASE ${SCRATCH_DB}`);

    console.log('verify-baseline: applying migrations to the scratch database');
    runPrisma(['migrate', 'deploy', '--schema', SCHEMA], { DATABASE_URL: scratchUrl() });

    console.log('verify-baseline: diffing the migrated database against schema.prisma');
    const cli = prismaCli();
    // `--exit-code` makes Prisma itself signal the answer: exit 0 when
    // the diff is empty, exit 2 when it is not. Parsing the script text
    // instead would mean special-casing Prisma's "-- This is an empty
    // migration." placeholder, which is a string contract nobody signed.
    // The URL is a command-line argument here, so a failing execFileSync
    // would echo it — credentials included — into the error message; the
    // handlers below print only Prisma's own output, never the command line.
    try {
      execFileSync(
        process.execPath,
        [
          cli,
          'migrate',
          'diff',
          '--from-url',
          scratchUrl(),
          '--to-schema-datamodel',
          SCHEMA,
          '--script',
          '--exit-code',
        ],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
          env: { ...process.env, DATABASE_URL: scratchUrl() },
        },
      );
    } catch (error) {
      if (error.status === 2) {
        console.error(
          'verify-baseline: FAILED — the migrated database differs from schema.prisma.\n' +
            'The baseline migration is incomplete; regenerate it with\n' +
            '`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`\n' +
            'and commit the result. Diff:\n' +
            (error.stdout?.toString() || ''),
        );
      } else {
        console.error(
          'verify-baseline: FAILED — `prisma migrate diff` errored:\n' +
            (error.stderr?.toString() || 'unknown error'),
        );
      }
      process.exitCode = 1;
      return;
    }

    console.log(
      'verify-baseline: PASSED — shadow database matches schema.prisma exactly (empty diff)',
    );
  } finally {
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await prisma.$disconnect();
    console.log(`verify-baseline: dropped scratch database ${SCRATCH_DB}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
