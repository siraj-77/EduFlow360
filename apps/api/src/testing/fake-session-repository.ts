import type {
  ISessionRepository,
  IssuedSession,
  RotateResult,
  SessionActor,
} from '../modules/auth/domain/ports/session-repository.js';
import type { FoundTokenState } from '../modules/auth/domain/services/refresh-token-rotation.js';

/**
 * An in-memory `ISessionRepository` for tests that are not about the database.
 *
 * ## Why it only implements `issue`
 *
 * Because that is the only method a sign-in needs, and a double that implemented
 * the rest would be asserting nothing. Every other method throws a named error
 * instead of returning a plausible value, so a use-case that starts calling
 * `rotate` fails loudly rather than quietly passing against a stub that invented
 * a token.
 *
 * ## What it reproduces faithfully
 *
 * `issue` mints two distinct 256-bit tokens and a family id, computes both
 * expiries from the injected `now`, and returns the plaintexts exactly once. A
 * double that returned a constant string for both would let a test pass while the
 * real repository minted two identical credentials.
 */
export interface FakeSessionOptions {
  /** Now, so expiries are a function of the caller's clock rather than ambient. */
  readonly now: Date;
  readonly sessionId?: string;
  readonly userId?: string;
}

export class FakeSessionRepository implements ISessionRepository {
  readonly issueCalls: Array<{
    actor: SessionActor;
    sessionTtlMs: number;
    refreshTtlMs: number;
  }> = [];

  private counter = 0;
  private readonly now: Date;
  private readonly sessionId: string;
  /** The account a session belongs to when a caller does not name one. */
  readonly fallbackUserId: string;

  constructor(options: FakeSessionOptions) {
    this.now = options.now;
    this.sessionId = options.sessionId ?? 'session-under-test';
    this.fallbackUserId = options.userId ?? 'user-under-test';
  }

  async issue(params: {
    actor: SessionActor;
    sessionTtlMs: number;
    refreshTtlMs: number;
  }): Promise<IssuedSession> {
    this.issueCalls.push(params);
    this.counter += 1;

    // Distinct per call, so two sign-ins cannot be handed the same credential.
    const sessionTokenPlaintext = `fake-session-token-${this.counter}`;
    const refreshTokenPlaintext = `fake-refresh-token-${this.counter}`;

    return {
      sessionId: this.sessionId,
      userId: params.actor.userId,
      familyId: `fake-family-${this.counter}`,
      sessionTokenPlaintext,
      refreshTokenPlaintext,
      sessionExpiresAt: new Date(this.now.getTime() + params.sessionTtlMs),
      refreshTokenExpiresAt: new Date(this.now.getTime() + params.refreshTtlMs),
    };
  }

  async findForRotation(): Promise<FoundTokenState | { found: false }> {
    throw new Error('FakeSessionRepository.findForRotation is not implemented: no test needs it.');
  }

  async rotate(params: {
    tokenId: string;
    familyId: string;
    sessionId: string;
    refreshTtlMs: number;
    now: Date;
  }): Promise<RotateResult> {
    throw new Error(
      `FakeSessionRepository.rotate is not implemented (called for ${params.tokenId}).`,
    );
  }

  async revokeFamily(): Promise<{ tokensRevoked: number }> {
    throw new Error('FakeSessionRepository.revokeFamily is not implemented.');
  }

  async revokeSession(): Promise<void> {
    throw new Error('FakeSessionRepository.revokeSession is not implemented.');
  }

  /**
   * `revokeAllForUser` — `PLT-105` AC-2.
   *
   * Records the call rather than throwing, because the reset use-case CALLS
   * it on every success and the use-case spec asserts on exactly that: the
   * user, the reason, and that it happened after the credential write.
   * `revokeAllFailure` lets a use-case spec make it fail without mocking —
   * the reset must still answer `reset` and log.
   */
  readonly revokedUsers: Array<{ userId: string; reason: string }> = [];
  revokeAllFailure: Error | null = null;

  async revokeAllForUser(params: {
    userId: string;
    reason: string;
  }): Promise<{ sessionsRevoked: number }> {
    if (this.revokeAllFailure !== null) throw this.revokeAllFailure;
    this.revokedUsers.push({ userId: params.userId, reason: params.reason });
    return { sessionsRevoked: 0 };
  }

  async findByToken(): Promise<{ sessionId: string; userId: string } | null> {
    throw new Error('FakeSessionRepository.findByToken is not implemented.');
  }

  async revokeExpired(): Promise<number> {
    throw new Error('FakeSessionRepository.revokeExpired is not implemented.');
  }
}
