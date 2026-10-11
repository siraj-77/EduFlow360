import { randomBytes, createHash } from 'node:crypto';
import type {
  IPasswordResetTokenRepository,
  IssuedResetToken,
  Redemption,
} from '../modules/auth/domain/repositories/password-reset-token-repository.js';

/**
 * An in-memory reset-token store, for use-case specs.
 *
 * It mints REAL tokens with the same shape as the production store rather
 * than a readable string, so a test that accidentally asserts on the token's
 * contents is asserting on something the real implementation would also
 * produce. The redemption outcomes are driven by SEEDED state (already
 * consumed, expired) rather than by a mode switch, so a test asking for a
 * second redemption gets the same answer the guarded UPDATE would give.
 */
export class FakePasswordResetTokenRepository implements IPasswordResetTokenRepository {
  readonly issued: IssuedResetToken[] = [];
  readonly consumeCalls: string[] = [];

  private rows = new Map<
    string,
    { userId: string; expiresAt: Date; consumedAt: Date | null; tokenPlaintext: string }
  >();

  /** Seed a token the test can present. */
  async seedIssued(params: {
    userId: string;
    ttlMs: number;
    now: Date;
  }): Promise<IssuedResetToken> {
    return this.issue(params);
  }

  /** Mark a previously seeded token as already redeemed. */
  markConsumed(tokenPlaintext: string): void {
    const row = this.rows.get(createHash('sha256').update(tokenPlaintext).digest('hex'));
    if (row !== undefined) row.consumedAt = new Date();
  }

  async issue(params: {
    userId: string;
    ttlMs: number;
    now: Date;
    requestedIp?: string | null;
    requestedDevice?: string | null;
  }): Promise<IssuedResetToken> {
    const tokenPlaintext = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(tokenPlaintext).digest('hex');
    const expiresAt = new Date(params.now.getTime() + params.ttlMs);

    this.rows.set(tokenHash, {
      userId: params.userId,
      expiresAt,
      consumedAt: null,
      tokenPlaintext,
    });

    const issued: IssuedResetToken = {
      tokenId: randomUUID(),
      tokenPlaintext,
      tokenHash,
      expiresAt,
    };
    this.issued.push(issued);
    return issued;
  }

  async consume(params: { tokenPlaintext: string; now: Date }): Promise<Redemption> {
    this.consumeCalls.push(params.tokenPlaintext);
    const row = this.rows.get(createHash('sha256').update(params.tokenPlaintext).digest('hex'));

    if (row === undefined) return { outcome: 'refused', reason: 'unknown' };
    if (row.consumedAt !== null) return { outcome: 'refused', reason: 'already-consumed' };
    if (row.expiresAt.getTime() <= params.now.getTime()) {
      return { outcome: 'refused', reason: 'expired' };
    }

    row.consumedAt = params.now;
    return { outcome: 'consumed', userId: row.userId };
  }
}

/** Local, so the fake carries no dependency on node:crypto's uuid helper. */
function randomUUID(): string {
  return randomBytes(16).toString('hex');
}
