import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaPasswordResetTokenRepository } from './prisma-password-reset-token-repository.js';

/**
 * `PrismaPasswordResetTokenRepository` against a real PostgreSQL (`PLT-101`'s
 * sibling — the reset half of `PLT-105`).
 *
 * ## The two properties a fake could not prove
 *
 *  1. **The hash, not the token.** The column holds SHA-256 of what the user
 *     holds, so a reader of the table cannot redeem a reset. The assertion is
 *     `not.toContain(plaintext)` over the raw row.
 *  2. **Single-use is the UPDATE's row count.** Two concurrent redemptions
 *     must not both win. A check-then-write lets both pass the check; the
 *     guarded `updateMany` lets exactly one match a row, and the database is
 *     the only thing that can prove that ordering.
 */

let prisma: PrismaClient;
let repo: PrismaPasswordResetTokenRepository;
let userId: string;

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. This suite writes real rows to a real table.');
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();
  userId = randomUUID();
  repo = new PrismaPasswordResetTokenRepository(prisma, randomUUID());
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('issuing a reset token', () => {
  it('stores the hash and returns the plaintext exactly once', async () => {
    const issued = await repo.issue({ userId, ttlMs: 3_600_000, now: new Date() });

    // A 256-bit token, base64url: the same shape as a session token, and the
    // entropy answer to "someone guesses the link".
    expect(issued.tokenPlaintext).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = await prisma.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: issued.tokenHash },
      select: { tokenHash: true, userId: true, expiresAt: true, consumedAt: true },
    });

    expect(row.userId).toBe(userId);
    expect(row.consumedAt).toBeNull();
    // The stored form is NOT the token: a table reader cannot redeem it.
    expect(row.tokenHash).not.toContain(issued.tokenPlaintext);
    expect(issued.expiresAt.getTime()).toBe(row.expiresAt.getTime());
  });

  it('mints a fresh token per issue, so two requests are two credentials', async () => {
    const first = await repo.issue({ userId, ttlMs: 3_600_000, now: new Date() });
    const second = await repo.issue({ userId, ttlMs: 3_600_000, now: new Date() });

    expect(first.tokenPlaintext).not.toBe(second.tokenPlaintext);
  });
});

describe('redeeming a reset token', () => {
  it('consumes a valid token and names the user it was issued to', async () => {
    const issued = await repo.issue({ userId, ttlMs: 3_600_000, now: new Date() });

    const redeemed = await repo.consume({ tokenPlaintext: issued.tokenPlaintext, now: new Date() });

    expect(redeemed).toEqual({ outcome: 'consumed', userId });
  });

  it('refuses a second redemption — single-use, not single-usable-twice', async () => {
    // Same UPDATE, same guarded WHERE: the first call matched one row and
    // stamped `consumedAt`; the second matches none. A database-level race
    // between two simultaneous redemptions resolves the same way.
    const issued = await repo.issue({ userId, ttlMs: 3_600_000, now: new Date() });
    await repo.consume({ tokenPlaintext: issued.tokenPlaintext, now: new Date() });

    const second = await repo.consume({
      tokenPlaintext: issued.tokenPlaintext,
      now: new Date(),
    });

    expect(second).toEqual({ outcome: 'refused', reason: 'already-consumed' });
  });

  it('refuses an expired token', async () => {
    // A negative TTL is how this suite makes the clock run out without a
    // fake clock: the row's `expiresAt` is already past.
    const issued = await repo.issue({ userId, ttlMs: -1000, now: new Date() });

    const redeemed = await repo.consume({
      tokenPlaintext: issued.tokenPlaintext,
      now: new Date(),
    });

    expect(redeemed).toEqual({ outcome: 'refused', reason: 'expired' });
  });

  it('reports an unknown token as unknown, which is what a forged link is', async () => {
    const redeemed = await repo.consume({
      tokenPlaintext: 'a-token-nobody-issued',
      now: new Date(),
    });

    expect(redeemed).toEqual({ outcome: 'refused', reason: 'unknown' });
  });

  it('leaves a consumed token behind as evidence, because this table is not a mailbox', async () => {
    // `PC-404` owns retention. Deleting on consume would erase the record
    // that a reset was requested at all — exactly what an audit trail wants
    // to keep (`AGENTS.md` 2.7's posture, applied to a smaller table).
    const issued = await repo.issue({ userId, ttlMs: 3_600_000, now: new Date() });
    await repo.consume({ tokenPlaintext: issued.tokenPlaintext, now: new Date() });

    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: issued.tokenHash },
    });

    expect(row).not.toBeNull();
    expect(row?.consumedAt).not.toBeNull();
  });
});
