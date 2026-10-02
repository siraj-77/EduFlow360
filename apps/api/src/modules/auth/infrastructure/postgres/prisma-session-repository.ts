import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  type ISessionRepository,
  type IssuedSession,
  type RotateResult,
  type SessionActor,
} from '../../domain/ports/session-repository.js';
import type { FoundTokenState } from '../../domain/services/refresh-token-rotation.js';

/**
 * The Prisma implementation of `ISessionRepository`.
 *
 * ## What is stored, and what is not
 *
 * Neither token is stored. `issue` and `rotate` mint a 256-bit random string,
 * hand the plaintext to the caller exactly once, and keep only its SHA-256.
 * The database holds `token_hash` on both `sessions` and `refresh_tokens`, so a
 * dump of this database does not contain a single live credential.
 *
 * SHA-256 rather than argon2id, deliberately and worth stating: these are
 * 256-bit random values, so there is nothing to brute-force and no work factor
 * to tune. Argon exists for low-entropy human passwords. `AGENTS.md` 2.7 asks
 * for credentials never carried recoverably, and a hash achieves that without
 * pretending to be a password store.
 *
 * ## Rotation is one transaction
 *
 * Marking the presented token spent and inserting its successor must be atomic.
 * A crash between the two would leave a successor that no replay could ever
 * invalidate, which silently defeats the entire reuse-detection design in
 * `decideRotation`. That is why `rotate` is a single `$transaction`.
 *
 * ## `schoolId`
 *
 * Every write carries `schoolId`, because `AGENTS.md` 2.1 says so even though
 * isolation here is physical. It is metadata for auditability and licence
 * portability, and omitting it would break the unique keys.
 */
export class PrismaSessionRepository implements ISessionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  /** 256 bits, base64url. `crypto`, never `Math.random`. */
  private mint(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(params: {
    actor: SessionActor;
    sessionTtlMs: number;
    refreshTtlMs: number;
  }): Promise<IssuedSession> {
    const sessionToken = this.mint();
    const refreshToken = this.mint();
    const familyId = randomBytes(16).toString('hex');

    const now = new Date();
    const sessionExpiresAt = new Date(now.getTime() + params.sessionTtlMs);
    const refreshExpiresAt = new Date(now.getTime() + params.refreshTtlMs);

    const session = await this.prisma.session.create({
      data: {
        schoolId: this.schoolId,
        userId: params.actor.userId,
        tokenHash: this.hash(sessionToken),
        expiresAt: sessionExpiresAt,
        // Conditional spreads, because the project compiles with
        // `exactOptionalPropertyTypes` and an explicit `undefined` is not the
        // same as an absent optional column.
        ...(params.actor.deviceLabel !== undefined
          ? { deviceLabel: params.actor.deviceLabel }
          : {}),
        ...(params.actor.ipAddress !== undefined ? { ipAddress: params.actor.ipAddress } : {}),
        ...(params.actor.userAgent !== undefined ? { userAgent: params.actor.userAgent } : {}),
      },
      select: { id: true },
    });

    await this.prisma.refreshToken.create({
      data: {
        schoolId: this.schoolId,
        sessionId: session.id,
        userId: params.actor.userId,
        familyId,
        tokenHash: this.hash(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      sessionId: session.id,
      userId: params.actor.userId,
      familyId,
      sessionTokenPlaintext: sessionToken,
      refreshTokenPlaintext: refreshToken,
      sessionExpiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  }

  async findForRotation(
    refreshTokenPlaintext: string,
  ): Promise<FoundTokenState | { found: false }> {
    const row = await this.prisma.refreshToken.findFirst({
      where: { schoolId: this.schoolId, tokenHash: this.hash(refreshTokenPlaintext) },
      select: {
        usedAt: true,
        revokedAt: true,
        familyId: true,
        session: { select: { revokedAt: true } },
      },
    });

    if (!row) return { found: false };

    return {
      found: true,
      usedAt: row.usedAt,
      // A token individually revoked is a family-level revocation, so reuse
      // detection can see it without a second column.
      familyRevokedAt: row.revokedAt,
      sessionRevokedAt: row.session.revokedAt,
      familyId: row.familyId,
    };
  }

  async rotate(params: {
    tokenId: string;
    familyId: string;
    sessionId: string;
    refreshTtlMs: number;
    now: Date;
  }): Promise<RotateResult> {
    const successor = this.mint();
    const expiresAt = new Date(params.now.getTime() + params.refreshTtlMs);

    const [created] = await this.prisma.$transaction([
      // Spend the presented token first. `usedAt` set is what makes a replay
      // visible to `decideRotation`.
      this.prisma.refreshToken.update({
        where: { id: params.tokenId },
        data: { usedAt: params.now },
        select: { id: true },
      }),
      // Then issue the successor in the SAME family, so reuse revokes both.
      this.prisma.refreshToken.create({
        data: {
          schoolId: this.schoolId,
          sessionId: params.sessionId,
          userId: (
            await this.prisma.refreshToken.findUniqueOrThrow({
              where: { id: params.tokenId },
              select: { userId: true },
            })
          ).userId,
          familyId: params.familyId,
          tokenHash: this.hash(successor),
          expiresAt,
        },
        select: { id: true },
      }),
    ]);

    await this.prisma.refreshToken.update({
      where: { id: params.tokenId },
      data: { replacedByTokenId: created.id },
    });

    return {
      sessionId: params.sessionId,
      familyId: params.familyId,
      refreshTokenPlaintext: successor,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async revokeFamily(params: {
    familyId: string;
    reason: string;
    now: Date;
    revokeSession?: boolean;
  }): Promise<{ tokensRevoked: number }> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { schoolId: this.schoolId, familyId: params.familyId, revokedAt: null },
      select: { id: true, sessionId: true },
    });

    if (tokens.length === 0) return { tokensRevoked: 0 };

    const sessionIds = [...new Set(tokens.map((t) => t.sessionId))];

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { id: { in: tokens.map((t) => t.id) } },
        data: { revokedAt: params.now, revokedReason: params.reason },
      }),
      ...(params.revokeSession
        ? [
            this.prisma.session.updateMany({
              where: { id: { in: sessionIds }, revokedAt: null },
              data: { revokedAt: params.now, revokedReason: params.reason },
            }),
          ]
        : []),
    ]);

    return { tokensRevoked: tokens.length };
  }

  async revokeSession(params: { sessionId: string; reason: string; now: Date }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { id: params.sessionId, revokedAt: null },
        data: { revokedAt: params.now, revokedReason: params.reason },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId: params.sessionId, revokedAt: null },
        data: { revokedAt: params.now, revokedReason: params.reason },
      }),
    ]);
  }

  async findByToken(
    sessionTokenPlaintext: string,
  ): Promise<{ sessionId: string; userId: string } | null> {
    const row = await this.prisma.session.findFirst({
      where: { schoolId: this.schoolId, tokenHash: this.hash(sessionTokenPlaintext) },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!row) return null;
    // A revoked or expired row resolves to nothing. Checked here rather than in
    // a WHERE clause so a caller cannot forget, and so the check is one place.
    if (row.revokedAt !== null || row.expiresAt.getTime() <= Date.now()) return null;

    return { sessionId: row.id, userId: row.userId };
  }

  async revokeExpired(now: Date): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { expiresAt: { lte: now }, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'expired' },
    });
    return result.count;
  }
}
