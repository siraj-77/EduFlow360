import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  IPasswordResetTokenRepository,
  IssuedResetToken,
  Redemption,
} from '../../domain/repositories/password-reset-token-repository.js';

/**
 * `PrismaPasswordResetTokenRepository` — the reset credential's store
 * (`PLT-105`).
 *
 * ## Randomness and hashing live here, in infrastructure
 *
 * `randomBytes(32)` mints and `createHash('sha256')` stores — the same two
 * primitives `PrismaSessionRepository` uses on its tokens. Neither may appear
 * in a domain or use-case file (`AGENTS.md` 2.4, enforced by ESLint), and
 * this file is where the rule says they belong.
 *
 * ## The school, stamped on every statement
 *
 * `schoolId` from the constructor, the way every other repository in this
 * module carries it: the draft never supplies one, so a caller cannot forget
 * it and cannot forge another school's (`AGENTS.md` 2.1 — metadata, not a
 * scoping mechanism).
 */
export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  /** 256 bits, base64url — 43 characters, the same shape as a session token. */
  private mintToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(tokenPlaintext: string): string {
    return createHash('sha256').update(tokenPlaintext).digest('hex');
  }

  async issue(params: {
    userId: string;
    ttlMs: number;
    now: Date;
    requestedIp?: string | null;
    requestedDevice?: string | null;
  }): Promise<IssuedResetToken> {
    const tokenPlaintext = this.mintToken();
    const expiresAt = new Date(params.now.getTime() + params.ttlMs);

    const row = await this.prisma.passwordResetToken.create({
      data: {
        schoolId: this.schoolId,
        userId: params.userId,
        // Only the hash is stored. The plaintext exists in the emailed link
        // and in the POST body that redeems it, and nowhere else.
        tokenHash: this.hash(tokenPlaintext),
        expiresAt,
        // Conditional spreads for the optional device pair: Prisma takes
        // `null` explicitly, and `undefined` means "column default" — which
        // for a nullable column is the same answer, stated differently. The
        // spread keeps the call sites and the stored rows consistent.
        ...(params.requestedIp !== undefined ? { requestedIp: params.requestedIp } : {}),
        ...(params.requestedDevice !== undefined
          ? { requestedDevice: params.requestedDevice }
          : {}),
      },
      select: { id: true },
    });

    return {
      tokenId: row.id,
      tokenPlaintext,
      tokenHash: this.hash(tokenPlaintext),
      expiresAt,
    };
  }

  async consume(params: { tokenPlaintext: string; now: Date }): Promise<Redemption> {
    const tokenHash = this.hash(params.tokenPlaintext);

    // THE decision: one UPDATE, guarded on both conditions. A read-then-write
    // would let two simultaneous redemptions both pass the check.
    const consumed = await this.prisma.passwordResetToken.updateMany({
      where: {
        schoolId: this.schoolId,
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: params.now },
      },
      data: { consumedAt: params.now },
    });

    if (consumed.count > 0) {
      const row = await this.prisma.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { userId: true },
      });

      return { outcome: 'consumed', userId: row.userId };
    }

    // The refusal is classified AFTER, for the log rather than for the
    // decision: the caller never learns WHICH refusal, so a forged link and a
    // used one answer identically to the person holding them.
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { consumedAt: true },
    });

    if (row === null) return { outcome: 'refused', reason: 'unknown' };
    if (row.consumedAt !== null) return { outcome: 'refused', reason: 'already-consumed' };
    return { outcome: 'refused', reason: 'expired' };
  }
}
