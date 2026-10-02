import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  ConsumeResult,
  ISetupTokenRepository,
  IssuedSetupToken,
} from '../../domain/repositories/setup-token-repository.js';
import type {
  PresentedSetupToken,
  SetupTokenDeploymentState,
} from '../../domain/services/setup-token.js';

/**
 * The Prisma implementation of `ISetupTokenRepository`.
 *
 * ## What is stored, and what is not
 *
 * Only SHA-256, for the same reason `PrismaSessionRepository` stores only
 * SHA-256 of its two tokens, and with more force here: a setup token is an
 * UNAUTHENTICATED route to the administrator account, so a dump of this database
 * that contained one would be a dump of the school's only administrator
 * credential. There is no second copy of the token anywhere in this repository,
 * and no way to recover one from the row.
 *
 * SHA-256 rather than argon2id, deliberately and for the reason the session
 * repository gives: this is a 256-bit random value with nothing to brute-force
 * and no work factor to tune. Argon exists for low-entropy human passwords. The
 * setup TOKEN is not a human password — it is machine-generated and 256 bits
 * wide — so hashing it with a password KDF would cost the school CPU on every
 * bootstrap and buy nothing. `ADR-007` governs `User.passwordHash`, which is a
 * different column holding a different kind of secret.
 *
 * ## Consumption is ONE conditional UPDATE, and that is the whole story
 *
 * The acceptance criterion is that two concurrent claims cannot both succeed. A
 * `findUnique`-then-`update` sequence cannot deliver it: both callers read the
 * live row, both see a valid token, and both write. Two administrators.
 *
 * So `consume` is a single `UPDATE ... WHERE setup_token_hash = $1 AND
 * setup_token_expires_at > $2`, and the affected-row count IS the verdict. The
 * correctness comes from PostgreSQL rather than from this code:
 *
 *   - the first UPDATE takes a row-level exclusive lock on the matching row;
 *   - the other UPDATE statements block on that lock;
 *   - when the winner commits, each blocked statement RE-EVALUATES its WHERE
 *     clause against the new row version (EvalPlanQual under READ COMMITTED),
 *     finds `setup_token_hash IS NULL`, and matches nothing.
 *
 * That is why the answer is `count > 0` and not "did the update throw". There
 * is no error to catch and no transaction to open: a conditional UPDATE is
 * already atomic, and wrapping it in one would only add a failure mode.
 *
 * `id` is deliberately absent from the WHERE clause. The hash alone identifies
 * the row, and adding an id would mean reading it first — which is the
 * read-then-write this method exists to avoid.
 *
 * ## `schoolId`
 *
 * Carried on every query because `AGENTS.md` 2.1 says so even though isolation
 * here is physical. It is metadata, and it keeps the lookups inside the unique
 * keys the schema already declares.
 */
export class PrismaSetupTokenRepository implements ISetupTokenRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  /** 256 bits, base64url. `crypto`, never `Math.random`. */
  private mint(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(setupTokenPlaintext: string): string {
    return createHash('sha256').update(setupTokenPlaintext).digest('hex');
  }

  async issue(params: { userId: string; ttlMs: number; now: Date }): Promise<IssuedSetupToken> {
    const setupTokenPlaintext = this.mint();
    const setupTokenExpiresAt = new Date(params.now.getTime() + params.ttlMs);

    // `updateMany` rather than `update`, so the school scope is part of the
    // statement instead of an assumption about which id was passed in. A count
    // of zero is a caller bug, and it fails loudly rather than reporting a token
    // that was never stored.
    const updated = await this.prisma.user.updateMany({
      where: { id: params.userId, schoolId: this.schoolId },
      data: {
        setupTokenHash: this.hash(setupTokenPlaintext),
        setupTokenExpiresAt,
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        `cannot issue a setup token: no user ${params.userId} in school ${this.schoolId}`,
      );
    }

    return { setupTokenPlaintext, setupTokenExpiresAt };
  }

  async inspect(setupTokenPlaintext: string): Promise<PresentedSetupToken> {
    // No expiry filter here, on purpose. The rule in `decideSetupToken` owns the
    // expiry comparison, so an expired token stays VISIBLE to it and can be
    // reported with the same verdict as a forgery. Filtering in SQL would push a
    // security decision into a query string and collapse two distinct states
    // into one "not found".
    const row = await this.prisma.user.findFirst({
      where: { schoolId: this.schoolId, setupTokenHash: this.hash(setupTokenPlaintext) },
      select: { id: true, setupTokenExpiresAt: true },
    });

    return {
      match: row === null ? null : { userId: row.id, expiresAt: row.setupTokenExpiresAt },
      deployment: await this.deploymentState(),
    };
  }

  async consume(params: { setupTokenPlaintext: string; now: Date }): Promise<ConsumeResult> {
    const spent = await this.prisma.user.updateMany({
      where: {
        schoolId: this.schoolId,
        setupTokenHash: this.hash(params.setupTokenPlaintext),
        // `gt`, not `gte`: at the exact expiry instant the token is already
        // dead. A nullable column also drops out of this comparison entirely, so
        // a row carrying a hash with no window cannot be consumed — fail closed.
        setupTokenExpiresAt: { gt: params.now },
      },
      data: { setupTokenHash: null, setupTokenExpiresAt: null },
    });

    return { consumed: spent.count > 0 };
  }

  /**
   * Which of the three bootstrap states this deployment is in.
   *
   * Option (b) of the story put the token in two nullable columns on the one
   * `INVITED` row, so consumption is expressed by NULLING them — and NULL is also
   * what an unissued token looks like. The two are therefore indistinguishable
   * from the token columns alone, and this reads the ACCOUNT instead.
   *
   * The order is the precedence, not an optimisation: a deployment holding a
   * token is `token-issued` even if that token has expired, because an expired
   * token is still the live way in until it is replaced or consumed.
   */
  private async deploymentState(): Promise<SetupTokenDeploymentState> {
    const issued = await this.prisma.user.findFirst({
      where: { schoolId: this.schoolId, setupTokenHash: { not: null } },
      select: { id: true },
    });
    if (issued !== null) return 'token-issued';

    // `INVITED` with no credential is the row the seed creates and the state the
    // completion use-case leaves. It is what "a first administrator is still
    // outstanding" means in the database.
    const outstanding = await this.prisma.user.findFirst({
      where: { schoolId: this.schoolId, status: 'INVITED', passwordHash: null },
      select: { id: true },
    });

    return outstanding !== null ? 'no-token-issued' : 'bootstrap-claimed';
  }
}
