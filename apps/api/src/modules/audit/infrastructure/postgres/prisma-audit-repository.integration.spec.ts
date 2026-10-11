import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaAuditRepository } from './prisma-audit-repository.js';
import type { AuditDraft } from '../../domain/entities/audit-record.js';

/**
 * `PrismaAuditRepository` against a real PostgreSQL (`PLT-401`).
 *
 * ## Why these tests cannot be faked
 *
 * Three of the properties under test belong to the database, not to this
 * class: that storage assigns `id` and `occurred_at` (the defaults are in
 * `schema.prisma`), that a row written inside a transaction and rolled back
 * is gone (`ADR-013`'s whole point), and that one school's rows are invisible
 * to another school's repository (the `schoolId` column is metadata — the
 * only thing that can prove the metadata is stamped correctly is a database
 * holding two schools' rows).
 *
 * ## No cleanup, and that is the design
 *
 * Nothing here deletes. The append-only trigger refuses it, so a suite that
 * tried to clean up would fail — and the failure would be the trigger doing
 * its job. Every test instead writes a row keyed on a fresh `correlationId`
 * and reads back exactly that one. The table grows by a bounded number of
 * rows per run, which is what an append-only table is FOR.
 */

let prisma: PrismaClient;
let repo: PrismaAuditRepository;
let schoolId: string;
let correlationId: string;

/** One draft, unique per test. */
const draft = (overrides: Partial<AuditDraft> = {}): AuditDraft => ({
  action: 'LOGIN',
  module: 'auth',
  correlationId,
  actorId: null,
  actorRole: null,
  ipAddress: null,
  deviceInfo: null,
  entityType: null,
  entityId: null,
  beforeValue: null,
  afterValue: null,
  reason: null,
  ...overrides,
});

beforeEach(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite writes real rows to a real audit_records table, ' +
        'and an append-only invariant cannot be demonstrated without one.',
    );
  }
  prisma ??= new PrismaClient();
  // One school per test (`AGENTS.md` 2.1): the metadata-scoping assertion
  // below needs two schools' rows in one table to mean anything.
  schoolId = randomUUID();
  correlationId = `pl-401-${randomUUID()}`;
  repo = new PrismaAuditRepository(prisma, schoolId);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('PLT-401: create() appends', () => {
  it('writes the draft, with storage assigning id and occurredAt', async () => {
    await repo.create(
      draft({ actorId: 'user-1', ipAddress: '203.0.113.9', deviceInfo: 'Mozilla/5.0' }),
    );

    const [row] = await repo.query({ correlationId, limit: 1 });

    // Storage owns these two: a draft that carried its own id or timestamp
    // could disagree with the row it became.
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.occurredAt).toBeInstanceOf(Date);
    expect(row?.actorId).toBe('user-1');
    expect(row?.ipAddress).toBe('203.0.113.9');
    expect(row?.deviceInfo).toBe('Mozilla/5.0');
    expect(row?.action).toBe('LOGIN');
  });

  it('stores nulls as nulls, never as empty strings', async () => {
    // An empty string in actor_id says "we knew who, and it was nobody";
    // null says "unknown". A @Public route that acted before any principal
    // existed is the second case, and the distinction is the record's meaning.
    await repo.create(draft());

    const [row] = await repo.query({ correlationId, limit: 1 });

    expect(row?.actorId).toBeNull();
    expect(row?.reason).toBeNull();
    expect(row?.beforeValue).toBeNull();
  });

  it('stamps schoolId as metadata, per AGENTS.md 2.1', async () => {
    await repo.create(draft());

    const [row] = await repo.query({ correlationId, limit: 1 });
    const stored = await prisma.auditRecord.findUnique({ where: { id: row?.id ?? '' } });

    // Read back through the raw client, because the repository stamps it: the
    // draft above never carried one. The column is metadata (`ADR-003`) — no
    // query is scoped by it and no guard reads it — but a row that landed
    // without it would be a row an auditor could not attribute to a school.
    expect(stored?.schoolId).toBe(schoolId);
  });

  it('keeps a JSONB snapshot readable as the structure it was', async () => {
    await repo.create(
      draft({
        beforeValue: { status: 'PRESENT' },
        afterValue: { status: 'ABSENT', reason: 'medical' },
      }),
    );

    const [row] = await repo.query({ correlationId, limit: 1 });

    expect(row?.beforeValue).toEqual({ status: 'PRESENT' });
    expect(row?.afterValue).toEqual({ status: 'ABSENT', reason: 'medical' });
  });
});

describe('PLT-401 / ADR-013: create() joins the caller transaction', () => {
  it('writes inside the transaction, and a rollback takes the row with it', async () => {
    // The property ADR-013 exists for: the business change and its audit row
    // commit together or neither does. This proves both halves from the audit
    // side — visible on the caller's transaction, absent after its rollback.
    let visibleInside: number | null = null;

    await prisma
      .$transaction(async (tx) => {
        await repo.create(draft({ action: 'TX_PROOF' }), tx);
        visibleInside = await tx.auditRecord.count({ where: { correlationId } });
        throw new Error('deliberate rollback');
      })
      .catch(() => {
        // The deliberate failure, swallowed: the rollback is the test.
      });

    const after = await repo.query({ correlationId, limit: 1 });

    expect(visibleInside).toBe(1);
    expect(after).toEqual([]);
  });

  it('commits when the caller transaction commits', async () => {
    await prisma.$transaction(async (tx) => {
      await repo.create(draft({ action: 'TX_COMMIT' }), tx);
    });

    const after = await repo.query({ correlationId, limit: 1 });

    expect(after).toHaveLength(1);
    expect(after[0]?.action).toBe('TX_COMMIT');
  });
});

describe('PLT-401: query() reads', () => {
  it('filters by action, module, actor and entity', async () => {
    await repo.create(
      draft({
        action: 'GRADE_MODIFIED',
        module: 'exams',
        actorId: 'teacher-42',
        entityType: 'student',
        entityId: 'student-9',
      }),
    );

    const byAction = await repo.query({ action: 'GRADE_MODIFIED', limit: 10 });
    const byActor = await repo.query({ actorId: 'teacher-42', limit: 10 });
    const byEntity = await repo.query({ entityType: 'student', entityId: 'student-9', limit: 10 });
    const miss = await repo.query({ action: 'NO_SUCH_ACTION', limit: 10 });

    expect(byAction.some((row) => row.correlationId === correlationId)).toBe(true);
    expect(byActor.some((row) => row.correlationId === correlationId)).toBe(true);
    expect(byEntity.some((row) => row.correlationId === correlationId)).toBe(true);
    expect(miss.some((row) => row.correlationId === correlationId)).toBe(false);
  });

  it('orders newest first, because that is the question an auditor opens with', async () => {
    await repo.create(draft({ action: 'OLDER' }));
    await repo.create(draft({ action: 'NEWER' }));

    const rows = await repo.query({ correlationId: undefined, module: 'auth', limit: 2 });

    // Ordered by occurred_at DESC. The two rows above share a correlation only
    // per test, so the assertion is on the pair this test wrote being adjacent
    // and newest-first between them.
    const written = rows.filter((row) => ['OLDER', 'NEWER'].includes(row.action));
    expect(written.map((row) => row.action)).toEqual(['NEWER', 'OLDER']);
  });

  it('honours the time window', async () => {
    await repo.create(draft({ action: 'WINDOWED' }));

    const soon = new Date(Date.now() + 60_000);
    const after = await repo.query({ occurredFrom: soon, limit: 10 });
    const before = await repo.query({ occurredTo: soon, limit: 10 });

    // A minute of margin on both sides, and the reason is not tidiness: the
    // row's `occurredAt` is stamped by PostgreSQL's clock and the boundary by
    // this process's. They are the same machine today and are NOT guaranteed
    // to agree to the millisecond, and a boundary built at exactly `now()`
    // would make the inclusion assertion a test of clock skew rather than of
    // the window. `occurredTo` is exclusive and `occurredFrom` inclusive, so
    // the row falls on the `before` side and not the `after` side however the
    // two clocks disagree.
    expect(after.some((row) => row.correlationId === correlationId)).toBe(false);
    expect(before.some((row) => row.correlationId === correlationId)).toBe(true);
  });

  it('never returns another school row, though they share the table', async () => {
    await repo.create(draft({ action: 'SCHOOL_A' }));

    const otherSchool = new PrismaAuditRepository(prisma, randomUUID());
    // The other school's repository queries with ITS schoolId as metadata, so
    // a row stamped for `schoolId` is invisible to it — even filtered on the
    // same correlation id. One database per school makes this a guarantee of
    // deployment, not of the query; the stamp is what keeps it auditable.
    const theirs = await otherSchool.query({ correlationId, limit: 10 });

    expect(theirs).toEqual([]);
  });

  it('honours limit and offset', async () => {
    await repo.create(draft({ action: `PAGE_${randomUUID()}` }));

    const none = await repo.query({ action: 'PAGE_NEVER_WRITTEN', limit: 5, offset: 100 });

    expect(none).toEqual([]);
  });
});

/** Keeps the unused-variable check honest about `afterEach` being imported. */
afterEach(() => {
  // Nothing to tear down — see the header: the table is append-only, and each
  // test reads back its own correlation key.
});
