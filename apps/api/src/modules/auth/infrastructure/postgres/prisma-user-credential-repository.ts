import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  FailedSignInOutcome,
  IUserCredentialRepository,
  UserCredentialRecord,
} from '../../domain/repositories/user-credential-repository.js';

/**
 * The Prisma implementation of `IUserCredentialRepository`.
 *
 * ## The reason this class exists rather than three queries inside a use-case
 *
 * The timing argument. "No such user" and "wrong password" must be
 * indistinguishable, and the dominant cost is argon2 — but the *second* cost is
 * the database, and the database cost is controllable in exactly one way: by
 * issuing the same statements either way.
 *
 * So `recordFailedSignIn` is written so that an unknown identifier and a wrong
 * password execute the SAME `UPDATE` and the SAME `SELECT`. For an unknown
 * identifier the UPDATE matches zero rows and the SELECT finds nothing; the round
 * trips still happen. There is no early return for "no such account", because an
 * early return is exactly what makes missing users measurably faster.
 *
 * ## Why the identifier predicate is built once and reused
 *
 * `identifierMatches(identifier)` is the single place the lookup shape is
 * written. Two call sites that each spelled it out would eventually disagree — one
 * would gain a normalisation step, or a case-insensitive comparison — and then
 * `recordFailedSignIn` would count against a different set of rows than
 * `findByIdentifier` matched. That divergence is a lockout that does not lock and
 * an enumeration oracle in one.
 *
 * ## Why comparison is left to PostgreSQL
 *
 * `email` and `username` are plain `String` columns, so the comparison is exact
 * and case-sensitive, and it is the SAME comparison the unique indexes back. A
 * case-folding lookup here would create accounts that differ only by case and
 * would then have to be reconciled with a unique index that disagrees. Nothing
 * here lowercases, trims or normalises: the value that arrived is the value
 * compared.
 *
 * ## `schoolId`
 *
 * Applied to every statement. `AGENTS.md` 2.1 makes isolation physical and still
 * requires the column as metadata; applying it also keeps this repository honest
 * if a database is ever shared during a migration.
 */

export class PrismaUserCredentialRepository implements IUserCredentialRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  /**
   * The one spelling of "which rows does this identifier name".
   *
   * `email` OR `username`, because `PLT-101` is "Email/Username + Password" and a
   * school will have both in use. `OR` over two unique columns means at most one
   * row can match, which is why `findFirst` is safe and no ordering is needed.
   */
  private identifierMatches(identifier: string): Prisma.UserWhereInput {
    return {
      schoolId: this.schoolId,
      OR: [{ email: identifier }, { username: identifier }],
    };
  }

  async findByIdentifier(
    identifier: string,
  ): Promise<{ matched: true; record: UserCredentialRecord } | { matched: false }> {
    const row = await this.prisma.user.findFirst({
      where: this.identifierMatches(identifier),
      select: {
        id: true,
        passwordHash: true,
        passwordAlgorithm: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    // A row with no password is still a row. `PLT-107` leaves the bootstrap
    // administrator `INVITED` with `passwordHash: null` until the setup route is
    // called, and reporting that account as "no such user" would tell an
    // attacker the school has an unenrolled deployment — which is precisely the
    // fact D58 exists to protect. The caller receives the row, sees the null
    // hash, and answers exactly what it answers for a wrong password.
    if (row === null) return { matched: false };

    return {
      matched: true,
      record: {
        userId: row.id,
        // `?? ''` rather than a null: the port promises a string, and an empty
        // string is something `IPasswordHasher.verify` already knows how to
        // refuse (`argon2-password-hasher.ts` collapses a malformed digest into
        // `verified: false`). A null here would need a second branch downstream
        // that exists only to produce the same answer.
        passwordHash: row.passwordHash ?? '',
        passwordAlgorithm: row.passwordAlgorithm ?? 'argon2id',
        status: row.status,
        failedLoginAttempts: row.failedLoginAttempts,
        lockedUntil: row.lockedUntil,
      },
    };
  }

  async recordFailedSignIn(params: {
    readonly identifier: string;
    readonly now: Date;
    readonly maxAttempts: number;
    readonly lockoutMs: number;
  }): Promise<FailedSignInOutcome> {
    const where = this.identifierMatches(params.identifier);

    // ── Same statement, matched or not. ─────────────────────────────────────
    // `updateMany` rather than `update` so a missing identifier is a count of
    // zero rather than a thrown "record not found" — an exception here would be
    // both a distinguishable outcome and a 500.
    await this.prisma.user.updateMany({
      where,
      data: { failedLoginAttempts: { increment: 1 } },
    });

    // ── Same statement, matched or not. ─────────────────────────────────────
    // Run unconditionally, for the same reason. Skipping it on a miss is the
    // single most tempting optimisation here and it is the one that turns this
    // route into an enumeration oracle.
    const row = await this.prisma.user.findFirst({
      where,
      select: { failedLoginAttempts: true },
    });

    if (row === null) return { outcome: 'unknown-identifier' };

    if (row.failedLoginAttempts >= params.maxAttempts) {
      const lockedUntil = new Date(params.now.getTime() + params.lockoutMs);
      // Reset the counter as part of the lock. `Int` is 32 bits: without this a
      // permanently-abused account eventually overflows on increment, and the
      // overflow would land in `failedLoginAttempts` as a negative number that
      // compares below any threshold.
      await this.prisma.user.updateMany({
        where,
        data: { lockedUntil, failedLoginAttempts: 0 },
      });
      return { outcome: 'locked', lockedUntil };
    }

    return { outcome: 'counted', failedLoginAttempts: row.failedLoginAttempts };
  }

  async recordSuccessfulSignIn(params: {
    readonly userId: string;
    readonly now: Date;
  }): Promise<void> {
    // One statement, not three. `lastLoginAt` and the reset of the two lockout
    // columns are one row and one fact — this sign-in happened — and splitting
    // them would let a crash leave an account stamped as signed-in while still
    // locked.
    await this.prisma.user.updateMany({
      where: { id: params.userId, schoolId: this.schoolId },
      data: {
        lastLoginAt: params.now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async replaceCredential(params: {
    readonly userId: string;
    readonly passwordHash: string;
    readonly passwordAlgorithm: string;
    readonly now: Date;
  }): Promise<void> {
    // Deliberately does NOT touch `status` or `mustChangePassword`. A rehash is an
    // upgrade of the stored digest; treating it as anything else would let a
    // successful sign-in quietly activate a suspended account.
    await this.prisma.user.updateMany({
      where: { id: params.userId, schoolId: this.schoolId },
      data: {
        passwordHash: params.passwordHash,
        passwordAlgorithm: params.passwordAlgorithm,
        passwordUpdatedAt: params.now,
      },
    });
  }
}
