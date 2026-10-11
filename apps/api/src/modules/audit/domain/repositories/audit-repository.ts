import type { AuditDraft, AuditRecord } from '../entities/audit-record.js';

/** DI token. A symbol because an `interface` has no runtime value to resolve against. */
export const IAUDIT_REPOSITORY = Symbol('IAuditRepository');

/**
 * The audit repository: `create()` and `query()`, and the proof that nothing
 * else exists lives in `audit-repository.spec.ts` (`PLT-401` T3).
 *
 * ## Why there is no update and no delete, stated at the port
 *
 * `AGENTS.md` 2.7 is not satisfied by a repository that declines to expose a
 * mutation method; it is satisfied by there being nothing to call. So the
 * interface has two methods, and the spec that guards this file walks the
 * whole source tree asserting no delegate-level mutation call exists
 * anywhere. The database-level half — `REVOKE` plus the
 * `BEFORE UPDATE OR DELETE` trigger — is what binds connections that do not
 * go through this port at all; `audit-immutability.integration.spec.ts`
 * proves it against a real PostgreSQL.
 *
 * ## The `transaction` parameter is `ADR-013`, and it is not optional in
 * spirit
 *
 * A sensitive action commits its business change and its audit row in ONE
 * transaction, so that "the action happened" and "the record exists" cannot
 * come apart. The parameter is typed optional only because a caller with no
 * open transaction is a legitimate state today — the first transactional
 * use-case in this repository has not shipped. Every caller that opens a
 * transaction passes it; the integration spec proves the join works by
 * rolling one back.
 *
 * ## The handle is opaque on purpose
 *
 * The domain must not name Prisma (`AGENTS.md` 2.2 — the ESLint ban on
 * `@prisma/client` in `domain/**` is mechanical). So the domain declares a
 * branded handle it cannot construct, and `PrismaAuditRepository` performs
 * the single narrowing cast at the infrastructure boundary, where naming
 * Prisma is the adapter's job.
 */
export interface IAuditRepository {
  /**
   * Append one record. The only write this interface has, ever.
   *
   * `void` because `ADR-013` wrote it that way and because the caller that
   * opened a transaction already holds its own handle on what it committed:
   * a second read to learn the row's id would be a read inside the very
   * transaction the ADR is trying to keep short.
   */
  create(draft: AuditDraft, transaction?: AuditWriteTransaction): Promise<void>;

  /**
   * Read the trail. Serves `PLT-403`'s viewer: filter by actor, action,
   * module, entity or time window, paged.
   *
   * Ordered by `occurredAt` descending — newest first, because the question
   * an auditor opens with is "what happened most recently".
   */
  query(criteria: AuditQueryCriteria): Promise<readonly AuditRecord[]>;
}

/**
 * A caller's open transaction (`ADR-013`).
 *
 * Structural, and that is the whole design. The domain declares the ONE
 * operation it needs from a transaction — the append — and Prisma's
 * transaction client satisfies the shape without importing Prisma, without a
 * brand, and without a cast at any call site. A branded opaque handle was the
 * first design and it was wrong for a reason worth recording: every caller
 * would have had to cast its real transaction client into the brand, and a
 * cast that every call site must write is a cast somebody eventually skips.
 *
 * The method (not property) syntax is load-bearing twice over: it is what
 * lets TypeScript's bivariant parameter checking accept Prisma's own generic
 * `create`, and it keeps `AGENTS.md` 2.2's ban on `@prisma/client` inside
 * `domain/**` intact — the interface names `auditRecord` the way
 * `ISessionCookieDelivery` names a cookie, as domain vocabulary.
 */
export interface AuditWriteTransaction {
  /** The only write this port can perform, on the caller's transaction. */
  auditRecord: {
    create(args: unknown): Promise<unknown>;
  };
}

/** What a reader may filter on. Everything optional; `limit` is required. */
export interface AuditQueryCriteria {
  /** Exact action key — the `@Audited` argument. */
  readonly action?: string | undefined;
  /** The controller's route prefix. */
  readonly module?: string | undefined;
  readonly actorId?: string | undefined;
  readonly entityType?: string | undefined;
  readonly entityId?: string | undefined;
  /**
   * The request this row belongs to. Not a viewer's usual filter — an
   * operator searching by trace id is the caller — and the cheapest way for a
   * test to read back exactly the row it wrote, which an append-only table
   * makes otherwise impossible (there is no DELETE to clean up with).
   */
  readonly correlationId?: string | undefined;
  /** Inclusive lower bound on `occurredAt` (UTC storage). */
  readonly occurredFrom?: Date | undefined;
  /** Exclusive upper bound on `occurredAt` (UTC storage). */
  readonly occurredTo?: Date | undefined;
  /**
   * Page size. Required, not defaulted: an unbounded read of an append-only
   * table is how a viewer becomes an outage, and the bound is `PLT-403`'s
   * pagination design to choose — no default is invented here.
   */
  readonly limit: number;
  readonly offset?: number | undefined;
}
