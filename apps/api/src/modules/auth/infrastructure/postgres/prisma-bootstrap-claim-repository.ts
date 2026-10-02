import { createHash } from 'node:crypto';
// `PrismaClient` is a value: `new PrismaClient()` is never called here, but the
// transaction client type comes off the same namespace and `Prisma` is used only in
// type position (`Prisma.UserWhereInput`, `Prisma.TransactionClient`), so the whole
// statement is type-only.
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  BootstrapClaimOutcome,
  BootstrapCredential,
  BootstrapIdentity,
  IBootstrapClaimRepository,
} from '../../domain/repositories/bootstrap-claim-repository.js';

/**
 * The Prisma implementation of `IBootstrapClaimRepository`.
 *
 * ## The transaction is the whole point of this file
 *
 * Three statements, one transaction, in this order:
 *
 *   1. `SELECT` the row whose `setup_token_hash` equals the presented token's
 *      SHA-256, to learn WHICH row and whether its window is still open.
 *   2. A conditional `UPDATE` that NULLs both token columns, scoped to that row
 *      id AND the same hash AND a live expiry. Its affected-row count is the
 *      verdict, and it is what makes concurrent claims collapse to one winner.
 *   3. The credential write: `passwordHash`, `passwordAlgorithm`, `status`,
 *      `mustChangePassword`, `passwordUpdatedAt`, plus whatever identifiers the
 *      caller supplied.
 *
 * Two commits is the defect the story names, and it is not hypothetical: the
 * first commits a spent token, the second can fail for reasons that have nothing
 * to do with the token — a unique-identifier collision, a lost connection, a
 * process killed between them — and the installation is then unreachable with no
 * recovery path. `$transaction` is what makes those three statements one act, and
 * `prisma-bootstrap-claim-repository.integration.spec.ts` proves it by making
 * statement 3 throw and reading the token back still unspent.
 *
 * ## Why the argon2 hash is NOT computed inside here
 *
 * The caller hashes first. argon2 is deliberately expensive and memory-hard, and
 * a transaction that opened before the hash would hold a row lock for the
 * duration of a KDF — turning every concurrent claim into a queue behind the
 * slowest thing in the request. It also means a hash failure costs nothing at
 * all, because nothing has been written.
 *
 * ## Why statement 1 is a bare `SELECT` and not a locking read
 *
 * It reads no state it then trusts. Statement 2 re-checks the hash and the expiry
 * inside its own `WHERE`, so a row that changed between the two statements — or
 * that is being changed by a concurrent claim right now — matches nothing and the
 * claim is refused. Locking at statement 1 would be redundant work that only
 * makes the concurrency story harder to read.
 *
 * ## `gt`, not `gte`
 *
 * A token is valid while `expiresAt > now`; at the exact expiry instant it is
 * already dead. This is the same exclusive boundary `decideSetupToken` and
 * `PrismaSetupTokenRepository.consume` use, and a `gte` here would let a token
 * live for one more millisecond than every other layer believes.
 *
 * ## Why only SHA-256 of the token
 *
 * As in `PrismaSetupTokenRepository`: the token is 256 bits of CSPRNG output with
 * nothing to brute-force and no work factor to tune, so a password KDF would cost
 * the school CPU and buy nothing. It is still never written down, and never
 * logged.
 *
 * ## `schoolId`
 *
 * Carried on every statement because `AGENTS.md` 2.1 requires the column even
 * though isolation here is physical. It is metadata, and on this deployment it is
 * also what keeps a claim inside the school whose token it was.
 */

/**
 * The client handle an interactive transaction hands its callback.
 *
 * Narrower than `PrismaClient` on purpose, and named so that neither the row-lock
 * behaviour nor `Prisma.TransactionClient` can drift into a signature without it
 * being visible. Both are structurally satisfied by Prisma's own transaction
 * client, which is what the `$transaction` callback receives.
 */
export type BootstrapClaimTransaction = Prisma.TransactionClient;

/**
 * What statement 3 writes. Kept as a named type so the protected method's
 * signature reads as a sentence and so a future column has one place to appear.
 */
interface CredentialWrite {
  readonly userId: string;
  readonly passwordHash: string;
  readonly passwordAlgorithm: string;
  readonly mustChangePassword: false;
  readonly passwordUpdatedAt: Date;
  readonly identity: BootstrapIdentity | undefined;
}

/**
 * Raised inside the transaction to abort it.
 *
 * A sentinel rather than a `return`, and the reason is specific: Prisma's
 * interactive `$transaction` commits when its callback RESOLVES. Returning
 * `{ claimed: false }` after statement 2 matched zero rows would commit a
 * transaction that had already written nothing — harmless today, but it is a
 * refusal that is one statement away from being a commit, and the whole safety
 * argument here is that a refusal cannot commit.
 */
class ClaimRefused extends Error {
  constructor() {
    super('the bootstrap claim was refused');
    this.name = 'ClaimRefused';
  }
}

export class PrismaBootstrapClaimRepository implements IBootstrapClaimRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  /** 256 bits of token, hashed. Never stored, never logged (`AGENTS.md` 2.13`). */
  private hash(setupTokenPlaintext: string): string {
    return createHash('sha256').update(setupTokenPlaintext).digest('hex');
  }

  async claim(params: {
    readonly setupTokenPlaintext: string;
    readonly credential: BootstrapCredential;
    readonly now: Date;
    readonly identity?: BootstrapIdentity;
  }): Promise<BootstrapClaimOutcome> {
    const tokenHash = this.hash(params.setupTokenPlaintext);
    const now = params.now;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // ── 1. Which row, and is its window still open? ──────────────────────
        // `setupTokenExpiresAt === null` is treated as DEAD, matching
        // `decideSetupToken`: a hash with no window is a malformed credential,
        // and fail-closed is the only safe reading of one.
        const row = await tx.user.findFirst({
          where: { schoolId: this.schoolId, setupTokenHash: tokenHash },
          select: { id: true, setupTokenExpiresAt: true },
        });

        if (row === null) throw new ClaimRefused();
        if (row.setupTokenExpiresAt === null) throw new ClaimRefused();
        if (row.setupTokenExpiresAt.getTime() <= now.getTime()) throw new ClaimRefused();

        // ── 2. Spend it. This conditional UPDATE is the concurrency guard. ──
        // The first claimant takes the row lock; the others block and then
        // re-evaluate this WHERE against the committed row, find the hash NULL,
        // and match nothing. A `findUnique`-then-`update` would let both through,
        // which is the case the story calls "the case a naive implementation
        // passes and this one must not".
        const spent = await tx.user.updateMany({
          where: {
            id: row.id,
            schoolId: this.schoolId,
            setupTokenHash: tokenHash,
            setupTokenExpiresAt: { gt: now },
          },
          data: { setupTokenHash: null, setupTokenExpiresAt: null },
        });

        if (spent.count !== 1) throw new ClaimRefused();

        // ── 3. The credential, in the SAME transaction. ──────────────────────
        const written = await this.writeCredential(tx, {
          userId: row.id,
          passwordHash: params.credential.passwordHash,
          passwordAlgorithm: params.credential.passwordAlgorithm,
          // `false`, never `true`. The story is explicit: "mustChangePassword
          // stays false; the user chose this password deliberately." Forcing a
          // change would mean asking the only administrator of a single-school
          // installation to choose a second password, immediately, having just
          // chosen the first.
          mustChangePassword: false,
          passwordUpdatedAt: params.credential.now,
          identity: params.identity,
        });

        if (written !== 1) throw new ClaimRefused();

        return { claimed: true, userId: row.id } satisfies BootstrapClaimOutcome;
      });
    } catch (cause) {
      // The sentinel becomes a refusal; anything else is a real fault and keeps
      // propagating. Swallowing a genuine error here would report "refused" for a
      // transaction whose fate nobody knows, which is precisely the ambiguity
      // this repository exists to remove.
      if (cause instanceof ClaimRefused) return { claimed: false };
      throw cause;
    }
  }

  /**
   * Statement 3. `protected` so a failure can be injected between the two writes.
   *
   * ## Why the seam exists, stated plainly
   *
   * Because a crash cannot be scheduled and the acceptance criterion is about a
   * crash. A subclass that throws here reproduces it exactly: statement 2 has
   * already executed inside the open transaction, so the rollback it provokes is
   * the same rollback a process death would cause.
   *
   * It is `protected` rather than an injected callback because a callback would
   * be a test-only parameter on a production interface — a permanent invitation to
   * pass `undefined` in production. Overriding a method is ordinary extension,
   * costs nothing when unused, and exists in the type for subclasses only.
   *
   * ## Returns the affected-row count, and the caller checks it
   *
   * Because a zero-row write must abort the transaction rather than commit a
   * spent token against a credential that was never written. That is the same
   * failure the sentinel exists for, reached from the other direction.
   */
  protected async writeCredential(
    tx: BootstrapClaimTransaction,
    write: CredentialWrite,
  ): Promise<number> {
    // Conditional spreads because `exactOptionalPropertyTypes` is on: an explicit
    // `undefined` is not the same as an absent optional column, and Prisma would
    // reject the former.
    const identity = write.identity ?? {};

    const written = await tx.user.updateMany({
      where: { id: write.userId, schoolId: this.schoolId },
      data: {
        passwordHash: write.passwordHash,
        passwordAlgorithm: write.passwordAlgorithm,
        status: 'ACTIVE',
        mustChangePassword: write.mustChangePassword,
        passwordUpdatedAt: write.passwordUpdatedAt,
        ...(identity.email !== undefined ? { email: identity.email } : {}),
        ...(identity.username !== undefined ? { username: identity.username } : {}),
      },
    });

    return written.count;
  }
}
