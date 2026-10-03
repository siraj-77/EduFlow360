import type { PrismaClient } from '@prisma/client';
import type {
  ExternalIdentityRecord,
  IExternalIdentityRepository,
  LinkExternalIdentityOutcome,
  LinkExternalIdentityParams,
} from '../../domain/ports/external-identity-repository.js';

/**
 * The Prisma implementation of `IExternalIdentityRepository`.
 *
 * ## Why `link` reads before it writes, and why that is safe
 *
 * `link` must not re-point an identity that is already bound to another account, so
 * it has to know what is there. That is a read-then-write, and a read-then-write is
 * where races live.
 *
 * The race is settled by the schema, not by this class: `@@unique([schoolId,
 * provider, providerSubject])` means a second concurrent insert **fails**. So the
 * worst case is not two rows — it is one insert throwing `P2002`, which is caught
 * below, re-read, and reported through the same three outcomes. There is no window
 * in which two rows for one `(provider, subject)` exist.
 *
 * ## Why the refusal is `already-linked-elsewhere` and not an exception
 *
 * An exception would be a 500, and a 500 that means "this Google account is already
 * someone's" is both a poor answer and a slow brute-force oracle for the set of
 * already-linked identities. The refusal is a **value**, so the caller decides the
 * status code, and this repository never learns what a user is told.
 *
 * ## `schoolId`
 *
 * On every write, because `AGENTS.md` 2.1 says so even though isolation here is
 * physical: it is metadata for auditability and licence portability, and the
 * composite unique key names it.
 *
 * ## Why `providerEmail` is written but never read
 *
 * It is a snapshot so a human reading a "connected accounts" screen sees something.
 * It is not in any `where` clause anywhere in this file, and it is not unique in the
 * schema, because two unrelated people can share an address and merging them would
 * combine two families' children (`AGENTS.md` 2.13).
 * `database-contract.integration.spec.ts` holds that line with a test.
 */

/**
 * Prisma's code for a unique-constraint violation.
 *
 * Checked by CODE rather than by `instanceof PrismaClientKnownRequestError`: the
 * class identity is not stable across a duplicated `@prisma/client` in a monorepo,
 * and a check that can silently stop matching turns a race into an unhandled 500.
 * `code` is part of Prisma's documented error contract, so a failure to match means
 * something genuinely else went wrong and is rethrown.
 */
const UNIQUE_VIOLATION = 'P2002';

const isUniqueViolation = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  'code' in cause &&
  (cause as { code?: unknown }).code === UNIQUE_VIOLATION;

export class PrismaExternalIdentityRepository implements IExternalIdentityRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  async findBySubject(provider: string, subject: string): Promise<ExternalIdentityRecord | null> {
    // `findFirst` rather than `findUnique`, because the unique key is the COMPOSITE
    // `(schoolId, provider, providerSubject)` and this repository is scoped by
    // `schoolId` — so naming all three would work too, and `findFirst` keeps the
    // scope predicate visible in one place instead of split across the key.
    const row = await this.prisma.externalIdentity.findFirst({
      where: { schoolId: this.schoolId, provider, providerSubject: subject },
      select: { userId: true, provider: true, providerSubject: true },
    });

    if (row === null) return null;

    return { userId: row.userId, provider: row.provider, subject: row.providerSubject };
  }

  async link(params: LinkExternalIdentityParams): Promise<LinkExternalIdentityOutcome> {
    const existing = await this.findBySubject(params.provider, params.subject);
    if (existing !== null) return this.classify(existing.userId, params.userId);

    try {
      await this.prisma.externalIdentity.create({
        data: {
          schoolId: this.schoolId,
          provider: params.provider,
          providerSubject: params.subject,
          userId: params.userId,
          // Conditional spreads, because the project compiles with
          // `exactOptionalPropertyTypes` and an explicit `undefined` is not the same
          // as an absent optional column.
          ...(params.email !== null ? { providerEmail: params.email } : {}),
          ...(params.emailVerified !== null ? { providerEmailVerified: params.emailVerified } : {}),
        },
        select: { id: true },
      });

      return { outcome: 'linked' };
    } catch (cause) {
      if (!isUniqueViolation(cause)) throw cause;

      // Lost the race. The winner's row is now authoritative, so the answer depends
      // on WHO won — never on what this caller hoped for.
      const winner = await this.findBySubject(params.provider, params.subject);
      // A unique violation on some OTHER constraint (there is none today, but a
      // future column could add one) would land here with no row for this pair.
      // Rethrowing is the honest answer: it is not a lost race.
      if (winner === null) throw cause;

      return this.classify(winner.userId, params.userId);
    }
  }

  /**
   * The decision, stated once.
   *
   * `already-linked-elsewhere` is a REFUSAL and the row is untouched. This is the
   * single place that decides it, so there is no second code path that could decide
   * it differently.
   */
  private classify(ownerUserId: string, requestedUserId: string): LinkExternalIdentityOutcome {
    return ownerUserId === requestedUserId
      ? { outcome: 'already-linked' }
      : { outcome: 'already-linked-elsewhere' };
  }
}
