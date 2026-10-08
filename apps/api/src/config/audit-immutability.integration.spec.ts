import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * PLT-401 — the append-only proof, executed against a real PostgreSQL.
 *
 * `schema-generation.spec.ts` proves the hardening SQL exists and
 * contains the right statements. This file proves the statements
 * WORK: it applies them to the live database and then shows that
 * an UPDATE and a DELETE against `audit_records` fail at the
 * database connection level — through the same Prisma client the
 * application uses, not through a SQL shell. That distinction is
 * the acceptance criterion: a repository convention (AGENTS.md
 * section 2.7, "the repository exposes only create() and query()")
 * binds nothing but the code that follows it, while a trigger binds
 * every connection, including a future migration, a support session,
 * and the table owner.
 *
 * The suite applies the hardening itself (role first, then the
 * hardening file — the hardening raises when the role is missing,
 * because revoking from a role that does not exist is a silent
 * no-op). Both steps are idempotent, so the suite is safe to re-run,
 * and `prisma/deploy.mjs` performs the same two steps at deployment
 * time. Doing them here too keeps the suite self-contained: CI runs
 * `test:integration` without ever invoking `deploy:db`.
 *
 * The proof row is deliberately NOT cleaned up. It cannot be — the
 * trigger rejects the DELETE — and that is the point. Retention is
 * archival, never deletion (PLT-404). Each run leaves one row,
 * identifiable by its `SEC_101_IMMUTABILITY_PROOF` action.
 *
 * Requires DATABASE_URL. Fails loudly rather than skipping — a
 * skipped test that reports success is the defect class EPIC-A
 * removed.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. This test talks to a real PostgreSQL and cannot be ' +
      'run without one. Set it in .env (git-ignored) or the environment.',
  );
}

const prisma = new PrismaClient();

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRISMA_CLI = join(API_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const SCHEMA = join(API_ROOT, 'prisma', 'schema.prisma');
const ENSURE_ROLE = join(API_ROOT, 'prisma', 'hardening', 'ensure-app-role.sql');
const HARDENING = join(API_ROOT, 'prisma', 'hardening', 'audit-immutability.sql');

beforeAll(async () => {
  await prisma.$connect();

  if (!existsSync(PRISMA_CLI)) {
    throw new Error(`Prisma CLI not found at ${PRISMA_CLI}. Run \`pnpm install\` first.`);
  }

  // The Prisma CLI is invoked through node so no .cmd shim is
  // involved — the same reason `generate.mjs` and `deploy.mjs` do
  // this. `db execute` applies a whole SQL file in one simple
  // query, which is what a multi-statement file with BEGIN/COMMIT
  // and DO blocks needs.
  execFileSync(
    process.execPath,
    [PRISMA_CLI, 'db', 'execute', '--file', ENSURE_ROLE, '--schema', SCHEMA],
    { stdio: 'inherit' },
  );
  execFileSync(
    process.execPath,
    [PRISMA_CLI, 'db', 'execute', '--file', HARDENING, '--schema', SCHEMA],
    { stdio: 'inherit' },
  );
});

describe('PLT-401: audit_records is append-only at the database connection level', () => {
  const CORRELATION_ID = `sec-101-${randomUUID()}`;
  const ACTION = 'SEC_101_IMMUTABILITY_PROOF';
  let rowId = '';

  it('accepts an INSERT through the application connection', async () => {
    // The append-only half of the contract: the trail must still be
    // writable. A protection that blocks writes is not immutability,
    // it is a broken audit log.
    const row = await prisma.auditRecord.create({
      data: {
        schoolId: randomUUID(),
        correlationId: CORRELATION_ID,
        action: ACTION,
        module: 'platform',
      },
    });
    rowId = row.id;
    expect(rowId).not.toBe('');
  });

  it('has the append-only trigger installed on the table', async () => {
    // The trigger is what makes the invariant true of the table
    // rather than true of one role. Asserting its presence first
    // means a missing trigger fails here, not mysteriously in the
    // mutation tests below.
    const rows = await prisma.$queryRawUnsafe<{ tgname: string }[]>(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'public.audit_records'::regclass
         AND tgname = 'audit_records_append_only'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('rejects an UPDATE with the append-only violation', async () => {
    await expect(
      prisma.auditRecord.update({
        where: { id: rowId },
        data: { action: 'TAMPERED' },
      }),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a DELETE with the append-only violation', async () => {
    await expect(prisma.auditRecord.delete({ where: { id: rowId } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('leaves the row exactly as it was written', async () => {
    // Both mutations above were rejected by the trigger, so the row
    // must still carry its original action. This is the assertion
    // that fails if the protection is ever weakened to a warning,
    // or if the trigger is dropped "to make the tests pass".
    const row = await prisma.auditRecord.findUnique({ where: { id: rowId } });
    expect(row?.action).toBe(ACTION);
    expect(row?.correlationId).toBe(CORRELATION_ID);
  });
});
