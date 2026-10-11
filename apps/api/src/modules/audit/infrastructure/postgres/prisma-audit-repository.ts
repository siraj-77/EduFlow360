import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuditDraft, AuditRecord } from '../../domain/entities/audit-record.js';
import type {
  AuditQueryCriteria,
  AuditWriteTransaction,
  IAuditRepository,
} from '../../domain/repositories/audit-repository.js';

/**
 * `PrismaAuditRepository` — the only writer `audit_records` has
 * (`PLT-401`, `AGENTS.md` 2.7).
 *
 * ## What this class does NOT have, and cannot be given
 *
 * No update. No delete. The port declares two methods and
 * `audit-repository.spec.ts` walks the whole source tree asserting no
 * delegate-level mutation call exists anywhere; the `REVOKE` and the
 * `BEFORE UPDATE OR DELETE` trigger in
 * `prisma/hardening/audit-immutability.sql` refuse them at the connection
 * level even for a caller that never comes through this class. This file's
 * job is to be the honest half of that pair: the write path that exists.
 *
 * ## `schoolId` is stamped here, as metadata
 *
 * `ADR-003` gives every school its own database, so nothing is scoped by
 * `schoolId` and no guard reads it. It is carried anyway — on every statement,
 * the way `PrismaPermissionGrantReader` carries it — because a row that
 * cannot be attributed to a school is a row a licence port or an auditor
 * cannot use. The integration spec proves the stamp with two schools' rows in
 * one table.
 *
 * ## The transaction branch, and why it is not a cast
 *
 * `ADR-013`: the audit insert joins the caller's transaction. The port's
 * `AuditWriteTransaction` is a structural interface naming the one operation
 * the domain needs, so a Prisma transaction client satisfies it as-is and the
 * narrowing happens in the type system rather than through `as unknown as`.
 * The two branches below build the SAME input; only the client it goes
 * through differs.
 */
export class PrismaAuditRepository implements IAuditRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  async create(draft: AuditDraft, transaction?: AuditWriteTransaction): Promise<void> {
    const data: Prisma.AuditRecordCreateInput = {
      // Metadata, stamped by the repository rather than supplied by the
      // draft: a caller cannot forget it, and a caller cannot forge another
      // school's.
      schoolId: this.schoolId,
      // NO id and NO occurredAt: both are schema defaults, and a repository
      // that assigned them would be a repository whose rows can disagree with
      // their own timestamps.
      correlationId: draft.correlationId,
      action: draft.action,
      module: draft.module,
      actorId: draft.actorId,
      actorRole: draft.actorRole,
      ipAddress: draft.ipAddress,
      deviceInfo: draft.deviceInfo,
      entityType: draft.entityType,
      entityId: draft.entityId,
      // `Json?` columns in Prisma distinguish SQL NULL from JSON null.
      // `DbNull` is the SQL NULL this schema means — `JsonNull` would store
      // the four characters `null` as a JSON document, and a reader checking
      // `WHERE before_value IS NULL` would then find a row it should not.
      beforeValue:
        draft.beforeValue === null ? Prisma.DbNull : (draft.beforeValue as Prisma.InputJsonValue),
      afterValue:
        draft.afterValue === null ? Prisma.DbNull : (draft.afterValue as Prisma.InputJsonValue),
      reason: draft.reason,
    };

    if (transaction === undefined) {
      await this.prisma.auditRecord.create({ data });
      return;
    }

    await transaction.auditRecord.create({ data });
  }

  async query(criteria: AuditQueryCriteria): Promise<readonly AuditRecord[]> {
    // Conditional spreads throughout, because `exactOptionalPropertyTypes` is
    // on: an explicit `undefined` in a Prisma `where` is not the same as an
    // absent clause, and the difference here would silently widen a filter
    // into "match anything".
    const rows = await this.prisma.auditRecord.findMany({
      where: {
        schoolId: this.schoolId,
        ...(criteria.action !== undefined ? { action: criteria.action } : {}),
        ...(criteria.module !== undefined ? { module: criteria.module } : {}),
        ...(criteria.actorId !== undefined ? { actorId: criteria.actorId } : {}),
        ...(criteria.entityType !== undefined ? { entityType: criteria.entityType } : {}),
        ...(criteria.entityId !== undefined ? { entityId: criteria.entityId } : {}),
        ...(criteria.correlationId !== undefined ? { correlationId: criteria.correlationId } : {}),
        ...(criteria.occurredFrom !== undefined
          ? { occurredAt: { gte: criteria.occurredFrom } }
          : {}),
        ...(criteria.occurredTo !== undefined ? { occurredAt: { lt: criteria.occurredTo } } : {}),
      },
      // Newest first. An audit viewer opens on "what just happened", and a
      // reader that wants oldest-first reverses a page, not the query.
      orderBy: { occurredAt: 'desc' },
      take: criteria.limit,
      ...(criteria.offset !== undefined ? { skip: criteria.offset } : {}),
    });

    // The row-to-entity mapping, and the one place the two vocabularies meet.
    // `before_value` is `Json | null`; the domain's `unknown` is the honest
    // type for a value the schema typed as JSON and this code does not
    // interpret.
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      action: row.action,
      module: row.module,
      correlationId: row.correlationId,
      actorId: row.actorId,
      actorRole: row.actorRole,
      ipAddress: row.ipAddress,
      deviceInfo: row.deviceInfo,
      entityType: row.entityType,
      entityId: row.entityId,
      beforeValue: row.beforeValue,
      afterValue: row.afterValue,
      reason: row.reason,
    }));
  }
}
