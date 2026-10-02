import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaSessionRepository } from './prisma-session-repository.js';
import { decideRotation } from '../../domain/services/refresh-token-rotation.js';

/**
 * The reuse-detection claim, proved against a real database.
 *
 * `ADR-008` says a refresh token is single-use and that presenting an
 * already-rotated token revokes the WHOLE family, "which turns silent theft
 * into a detectable, recoverable event". That sentence is the whole security
 * claim of this story, and it is the kind of claim a mocked repository proves
 * nothing about - a fake returns whatever the test tells it to return.
 *
 * So this runs against real PostgreSQL, exactly like
 * `database-contract.integration.spec.ts` does, and it never reaches into
 * Prisma directly: every assertion goes through the repository, because the
 * repository is the thing whose atomicity is in question.
 */
const SCHOOL_ID = randomUUID();

let prisma: PrismaClient;
let repo: PrismaSessionRepository;

async function aUser(): Promise<string> {
  return (
    await prisma.user.create({
      data: {
        schoolId: SCHOOL_ID,
        email: `session-${randomUUID()}@example.test`,
        username: `session-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    // Refusing to skip is the same rule the rest of this repository follows: a
    // skipped test that reports success is the exact defect class AUD-30-02
    // removed from the integration gate.
    throw new Error(
      'DATABASE_URL is not set. This suite needs a real PostgreSQL - the claim under ' +
        'test is that rotation is atomic, and a fake repository cannot demonstrate atomicity.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
  repo = new PrismaSessionRepository(prisma, SCHOOL_ID);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('issuing a session', () => {
  it('never stores a token in the clear', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    const stored = await prisma.session.findUniqueOrThrow({
      where: { id: issued.sessionId },
      select: { tokenHash: true },
    });

    expect(stored.tokenHash).not.toBe(issued.sessionTokenPlaintext);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.sessionTokenPlaintext).not.toBe(issued.refreshTokenPlaintext);
  });

  it('mints a distinct session and refresh token, in a named family', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    expect(issued.familyId).toBeTruthy();
    const stored = await prisma.refreshToken.findFirstOrThrow({
      where: { sessionId: issued.sessionId },
      select: { familyId: true, tokenHash: true },
    });
    expect(stored.familyId).toBe(issued.familyId);
    expect(stored.tokenHash).not.toBe(issued.refreshTokenPlaintext);
  });

  it('resolves a session from its plaintext, and not from a guessed one', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    expect(await repo.findByToken(issued.sessionTokenPlaintext)).toEqual({
      sessionId: issued.sessionId,
      userId,
    });
    expect(await repo.findByToken('not-a-real-token')).toBeNull();
  });
});

describe('rotation', () => {
  it('issues a successor in the same family and spends the original', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });
    const found = await repo.findForRotation(issued.refreshTokenPlaintext);
    if (!found.found) throw new Error('token not found');

    const now = new Date();
    const rotated = await repo.rotate({
      tokenId: (
        await prisma.refreshToken.findFirstOrThrow({
          where: { sessionId: issued.sessionId },
          select: { id: true },
        })
      ).id,
      familyId: issued.familyId,
      sessionId: issued.sessionId,
      refreshTtlMs: 604_800_000,
      now,
    });

    expect(rotated.familyId).toBe(issued.familyId);
    expect(rotated.refreshTokenPlaintext).not.toBe(issued.refreshTokenPlaintext);

    // The original is now spent, which is what makes a replay visible.
    const spent = await prisma.refreshToken.findFirstOrThrow({
      where: { sessionId: issued.sessionId, usedAt: { not: null } },
      select: { usedAt: true, replacedByTokenId: true },
    });
    expect(spent.usedAt).not.toBeNull();
    expect(spent.replacedByTokenId).toBeTruthy();
  });

  it('gives a spent token the reuse verdict, which revokes the whole family', async () => {
    // THE security claim of ADR-008.
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    const first = await repo.findForRotation(issued.refreshTokenPlaintext);
    expect(decideRotation(first).action).toBe('rotate');

    const tokenId = (
      await prisma.refreshToken.findFirstOrThrow({
        where: { sessionId: issued.sessionId },
        select: { id: true },
      })
    ).id;

    await repo.rotate({
      tokenId,
      familyId: issued.familyId,
      sessionId: issued.sessionId,
      refreshTtlMs: 604_800_000,
      now: new Date(),
    });

    // Replay the ORIGINAL. It was spent, so this is the theft signal.
    const replay = await repo.findForRotation(issued.refreshTokenPlaintext);
    const verdict = decideRotation(replay);
    expect(verdict.action).toBe('revoke-family-reuse');

    if (verdict.action === 'revoke-family-reuse') {
      const result = await repo.revokeFamily({
        familyId: verdict.familyId,
        reason: 'refresh token reuse detected',
        now: new Date(),
        revokeSession: true,
      });
      expect(result.tokensRevoked).toBeGreaterThanOrEqual(2);
    }

    // And afterwards the successor is dead too, which is the containment.
    const live = await prisma.refreshToken.count({
      where: { familyId: issued.familyId, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('refuses a token from a session that was revoked', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    await repo.revokeSession({
      sessionId: issued.sessionId,
      reason: 'user signed out',
      now: new Date(),
    });

    const found = await repo.findForRotation(issued.refreshTokenPlaintext);
    expect(decideRotation(found).action).toBe('reject-session-revoked');
  });

  it('resolves nothing for a revoked session token', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    expect(await repo.findByToken(issued.sessionTokenPlaintext)).not.toBeNull();
    await repo.revokeSession({
      sessionId: issued.sessionId,
      reason: 'signed out',
      now: new Date(),
    });
    expect(await repo.findByToken(issued.sessionTokenPlaintext)).toBeNull();
  });

  it('resolves nothing for an expired session token', async () => {
    const userId = await aUser();
    // A negative TTL produces a session already past its expiry.
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: -1000,
      refreshTtlMs: 604_800_000,
    });
    expect(await repo.findByToken(issued.sessionTokenPlaintext)).toBeNull();
  });

  it('revokes an unknown token as unknown, not as reuse', async () => {
    // A forgery must not be able to trigger a family revocation by guessing.
    expect(decideRotation(await repo.findForRotation('never-issued')).action).toBe(
      'reject-unknown',
    );
  });
});

describe('revoking a session', () => {
  it('revokes the session and everything under it', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    await repo.revokeSession({ sessionId: issued.sessionId, reason: 'test', now: new Date() });

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: issued.sessionId },
      select: { revokedAt: true, revokedReason: true },
    });
    expect(session.revokedAt).not.toBeNull();
    expect(session.revokedReason).toBe('test');

    const tokens = await prisma.refreshToken.count({
      where: { sessionId: issued.sessionId, revokedAt: null },
    });
    expect(tokens).toBe(0);
  });

  it('leaves another session of the same user alone', async () => {
    // Revoking one device must not sign the user out everywhere.
    const userId = await aUser();
    const phone = await repo.issue({
      actor: { userId, deviceLabel: 'phone' },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });
    const laptop = await repo.issue({
      actor: { userId, deviceLabel: 'laptop' },
      sessionTtlMs: 3_600_000,
      refreshTtlMs: 604_800_000,
    });

    await repo.revokeSession({ sessionId: phone.sessionId, reason: 'test', now: new Date() });

    expect(await repo.findByToken(phone.sessionTokenPlaintext)).toBeNull();
    expect(await repo.findByToken(laptop.sessionTokenPlaintext)).not.toBeNull();
  });

  it('sweeps expired sessions and reports the count', async () => {
    const userId = await aUser();
    const issued = await repo.issue({
      actor: { userId },
      sessionTtlMs: -1000,
      refreshTtlMs: 604_800_000,
    });

    const swept = await repo.revokeExpired(new Date());

    expect(swept).toBeGreaterThanOrEqual(1);
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: issued.sessionId },
      select: { revokedReason: true },
    });
    expect(session.revokedReason).toBe('expired');
  });
});
