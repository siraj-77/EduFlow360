import { type IClock } from './clock.js';
import type { FoundTokenState } from '../services/refresh-token-rotation.js';

/**
 * DI token for this port.
 *
 * Declared here rather than in `auth.module.ts` for a structural reason:
 * `SessionGuard` — which lives in `common/guards/`, because it guards every route in
 * the application rather than one module — needs to inject this port. If the token
 * were declared in `auth.module.ts`, that guard would have to import the whole module
 * graph, which reaches `@prisma/client` and every controller, to read one symbol.
 * Declared here, `common/` depends on a port and nothing else.
 *
 * `CLOCK` already established the pattern; this is the same decision applied to a
 * port a cross-cutting control needs. `auth.module.ts` re-exports it, so existing
 * import sites are unaffected.
 */
export const I_SESSION_REPOSITORY = Symbol('ISessionRepository');

/**
 * The tokens and records `issue` and its neighbours return.
 *
 * ## Why the interface is shaped around rotation
 *
 * `ADR-008` wants a refresh token to be single-use, with rotation inside a
 * `familyId`, and a reuse of an already-rotated token treated as evidence of
 * theft. Those are the three things the application layer actually decides, so
 * they are the three things on this interface. `findForRotation` returns the
 * *state*, not the row, because `decideRotation` needs to reason about state
 * and doing that in SQL would put a security rule in a query string.
 *
 * ## The tokens themselves
 *
 * `issue` returns the plaintext tokens **once**. Neither is ever stored, and
 * neither is ever returned again - the repository holds SHA-256 hashes. A
 * caller that logs the result of `issue` has written a live credential to
 * disk, which is why the return type names them `plaintext`.
 */
export interface IssuedSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly familyId: string;
  /**
   * The session cookie value. Returned once, never stored, never logged
   * (`AGENTS.md` 2.13).
   */
  readonly sessionTokenPlaintext: string;
  /** The first refresh token. Single-use; rotated on every refresh. */
  readonly refreshTokenPlaintext: string;
  readonly sessionExpiresAt: Date;
  readonly refreshTokenExpiresAt: Date;
}

/** What to persist about the browser that started a session. */
export interface SessionActor {
  readonly userId: string;
  readonly deviceLabel?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

export interface RotateResult {
  readonly sessionId: string;
  readonly familyId: string;
  /** The successor token. The presented one is now spent. */
  readonly refreshTokenPlaintext: string;
  readonly refreshTokenExpiresAt: Date;
}

export interface ISessionRepository {
  /**
   * Open a session and its first refresh-token family.
   *
   * Expiry comes from the caller and both tokens are minted here, so a use-case
   * cannot accidentally issue one without the other.
   */
  issue(params: {
    readonly actor: SessionActor;
    readonly sessionTtlMs: number;
    readonly refreshTtlMs: number;
  }): Promise<IssuedSession>;

  /** Locate a refresh token by its plaintext, for rotation. */
  findForRotation(refreshTokenPlaintext: string): Promise<FoundTokenState | { found: false }>;

  /**
   * Consume a refresh token and mint its successor in the same family.
   *
   * Must be atomic: marking the old token spent and inserting the new one in the
   * same family is what makes reuse detectable. A crash between them would issue
   * a successor that no replay can ever invalidate.
   */
  rotate(params: {
    readonly tokenId: string;
    readonly familyId: string;
    readonly sessionId: string;
    readonly refreshTtlMs: number;
    /** When the presented token is marked spent. Injected, never ambient. */
    readonly now: Date;
  }): Promise<RotateResult>;

  /**
   * Revoke every refresh token in a family, and optionally the session with it.
   *
   * This is the theft response: one call contains a compromised credential.
   */
  revokeFamily(params: {
    readonly familyId: string;
    readonly reason: string;
    readonly now: Date;
    /** Also revoke the session, not just the refresh chain. */
    readonly revokeSession?: boolean;
  }): Promise<{ readonly tokensRevoked: number }>;

  /** Revoke one session and everything under it. */
  revokeSession(params: {
    readonly sessionId: string;
    readonly reason: string;
    readonly now: Date;
  }): Promise<void>;

  /** Resolve a session from its plaintext cookie value, or `null`. */
  findByToken(sessionTokenPlaintext: string): Promise<{ sessionId: string; userId: string } | null>;

  /** Sweep sessions whose `expiresAt` has passed. Returns the count. */
  revokeExpired(now: Date): Promise<number>;
}

/** Injected into anything that mints or ages a session. Re-exported for convenience. */
export type { IClock };
