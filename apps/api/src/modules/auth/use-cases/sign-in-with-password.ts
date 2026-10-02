import type { IClock } from '../domain/ports/clock.js';
import type {
  ISessionRepository,
  IssuedSession,
  SessionActor,
} from '../domain/ports/session-repository.js';
import type { IPasswordHasher, PasswordHashParameters } from '../domain/ports/password-hasher.js';
import type { IUserCredentialRepository } from '../domain/repositories/user-credential-repository.js';

/**
 * Signing in with an email/username and a password.
 *
 * ## Why this route is mandatory infrastructure, not a fallback
 *
 * `D57` ratified **must-link** Google sign-in: a Google identity must already be
 * linked to a `User`, linking requires an authenticated session, and the only way
 * to obtain one is a password. So without this route nobody can ever link
 * anything and the entire sign-in path is dead. It is not a convenience beside
 * OIDC; it is the thing OIDC depends on.
 *
 * ## The enumeration problem, and the trap inside it
 *
 * "No such user" and "wrong password" must be indistinguishable — same status,
 * same body, same time.
 *
 * The obvious fix is to skip the password check when no account matches. **That
 * makes the missing user faster, and a faster response IS the oracle.** argon2id
 * is deliberately expensive: `ADR-007` chose it because memory-hard cracking
 * costs an attacker far more than a GPU does bcrypt, and that expense is paid on
 * every verification. A route that spends it for a real account and returns
 * immediately for a fake one hands out a perfect account-existence oracle, and no
 * amount of rate limiting or response-shaping compensates for a 40 ms difference.
 *
 * So the mitigation is the standard one and it is implemented here without
 * exception: **every request performs exactly one argon2id verification.** When no
 * account matches, the password is verified against a fixed dummy hash produced at
 * the same cost parameters, which can never succeed and costs the same as a real
 * one.
 *
 * `sign-in-with-password.spec.ts` asserts that as a FACT — `verify` was called
 * once, on both paths — rather than inferring it from a timing distribution.
 * `login-over-http.integration.spec.ts` then measures real wall-clock time over a
 * socket with a coarse band, as corroboration.
 *
 * ## The other costs that had to be equalised
 *
 * - **The database.** `IUserCredentialRepository.recordFailedSignIn` is keyed on
 *   the IDENTIFIER, so an unknown identifier issues the same UPDATE and the same
 *   SELECT and simply matches zero rows. No early return.
 * - **The lockout check.** A locked account still has its password verified before
 *   the lock is reported, so `429` costs what `401` costs.
 *
 * ## What is still leaked, stated rather than hidden
 *
 * **`429` says an account exists.** That is the corpus's decision, not an
 * oversight: `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` line 723
 * specifies "lockout at 5 fails/10 min -> 429" for this story, and
 * `EduFlow_School_Setup_Workflow_v1.md` line 1080 names "lockout after 5
 * failures" as an authentication test. A lockout that answered 401 instead would
 * be indistinguishable — and then the lockout would be invisible to the user it
 * exists for, who would keep typing a correct password at a server silently
 * refusing them.
 *
 * So the leak is accepted, bounded by the per-source throttle on the route, and
 * recorded here. The alternative — a 401 on lockout — was rejected because it
 * makes the control indistinguishable from a wrong password, which is a worse
 * failure for the person it protects.
 *
 * ## Why there is exactly one `try`/`catch` in this file
 *
 * The verify-and-rehash upgrade. If the rewrite of a stronger digest fails, the
 * password was still proved: refusing the sign-in would lock a legitimate user out
 * of their own account because an opportunistic maintenance write failed. The
 * catch is therefore deliberate, narrow, and loud — it warns and continues, and
 * it never touches the authentication decision. Every other failure propagates:
 * `AGENTS.md` 8 forbids swallowing, and a silent catch on the sign-in path is how
 * an outage becomes a mystery.
 */

/** What a sign-in attempt produced. Never carries the password or the identifier. */
export type PasswordSignInOutcome =
  /** Authenticated. The session is the caller's to deliver to the browser. */
  | { readonly outcome: 'signed-in'; readonly session: IssuedSession }
  /**
   * Not authenticated. ONE answer for every cause: no such account, wrong
   * password, suspended, or not yet activated. Splitting these would be the
   * oracle.
   */
  | { readonly outcome: 'rejected' }
  /**
   * The account is locked. Carries when it expires so the route can answer 429
   * with a `Retry-After`, which is what makes the lock visible to its own victim.
   */
  | { readonly outcome: 'locked'; readonly lockedUntil: Date };

/** The lockout threshold and duration. From configuration (`AGENTS.md` 2.14). */
export interface SignInLockoutPolicy {
  readonly maxAttempts: number;
  readonly lockoutMs: number;
}

export interface SignInWithPasswordDeps {
  readonly users: IUserCredentialRepository;
  readonly hasher: IPasswordHasher;
  readonly sessions: ISessionRepository;
  readonly clock: IClock;
  /**
   * A digest no password matches, hashed at THIS deployment's cost parameters.
   *
   * Injected rather than computed here for two reasons: `use-cases/` may not mint
   * randomness (`AGENTS.md` 2.4), and the cost parameters must be the ones the
   * deployment actually uses — a dummy hashed at different parameters would be
   * measurably cheaper and would reintroduce the oracle it exists to remove.
   */
  readonly dummyHash: string;
  /** The parameters a rehash would be written at. `ADR-007`. */
  readonly hashParameters: PasswordHashParameters;
  readonly sessionTtlMs: number;
  readonly refreshTtlMs: number;
  readonly lockout: SignInLockoutPolicy;
}

/** Optional context to persist against the session. */
export interface SignInDevice {
  readonly deviceLabel?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export class SignInWithPassword {
  constructor(private readonly deps: SignInWithPasswordDeps) {}

  async signIn(params: {
    readonly identifier: string;
    readonly password: string;
    readonly device?: SignInDevice;
  }): Promise<PasswordSignInOutcome> {
    const { users, hasher, sessions, clock } = this.deps;
    const now = clock.now();

    const match = await users.findByIdentifier(params.identifier);
    const record = match.matched ? match.record : null;

    // ── The mitigation. One verification, unconditionally. ───────────────────
    // When there is no account, this verifies against `dummyHash` at the same cost
    // parameters. It cannot succeed, and it costs what a real verification costs,
    // which is the entire point: a missing user is no longer faster.
    //
    // Note the algorithm label is the same in both branches. Passing a different
    // one would be a different string reaching argon2, and the two are not the
    // same length.
    const verification = await hasher.verify(
      params.password,
      record === null ? this.deps.dummyHash : record.passwordHash,
      record === null ? 'argon2id' : record.passwordAlgorithm,
    );

    if (record === null || !verification.verified) {
      return this.refuse(params.identifier, now);
    }

    // ── Locked, checked AFTER the verification above. ────────────────────────
    // Order is the whole timing argument: a lockout answered before the hash is
    // checked would make `429` tens of milliseconds cheaper than `401`, which is
    // an oracle in the opposite direction and just as exploitable.
    if (record.lockedUntil !== null && record.lockedUntil.getTime() > now.getTime()) {
      return { outcome: 'locked', lockedUntil: record.lockedUntil };
    }

    // ── Status. Anything but ACTIVE cannot sign in. ──────────────────────────
    // `INVITED` matters most: it is the state `PLT-107` leaves the bootstrap
    // administrator in until its one-time token is spent, and a password that
    // "works" in that state would bypass the setup route entirely.
    //
    // No failure is counted here. An outsider who knows a username must not be
    // able to lock a suspended employee out of their own record by guessing —
    // the account is already unusable, so counting only harms its owner.
    if (record.status !== 'ACTIVE') return { outcome: 'rejected' };

    // ── Verify-and-rehash, on success only. ─────────────────────────────────
    // `needsRehash` is `false` on the failed branch by construction
    // (`password-hasher.ts`), so reading it here cannot leak the stored algorithm
    // through a refused sign-in.
    if (verification.verified && verification.needsRehash) {
      await this.upgradeStoredCredential(record.userId, params.password, now);
    }

    await users.recordSuccessfulSignIn({ userId: record.userId, now });

    const actor: SessionActor = {
      userId: record.userId,
      // Conditional spreads rather than `label: device?.deviceLabel`.
      // `exactOptionalPropertyTypes` is on, and `PrismaSessionRepository` rejects
      // an explicit `undefined` where an absent optional column is meant.
      ...(params.device?.deviceLabel !== undefined
        ? { deviceLabel: params.device.deviceLabel }
        : {}),
      ...(params.device?.ipAddress !== undefined ? { ipAddress: params.device.ipAddress } : {}),
      ...(params.device?.userAgent !== undefined ? { userAgent: params.device.userAgent } : {}),
    };

    const session = await sessions.issue({
      actor,
      sessionTtlMs: this.deps.sessionTtlMs,
      refreshTtlMs: this.deps.refreshTtlMs,
    });

    return { outcome: 'signed-in', session };
  }

  /**
   * Count the failure and report the one answer.
   *
   * `recordFailedSignIn` is called for BOTH a missing account and a wrong
   * password, and the repository issues the same statements either way. That is
   * what keeps the database cost identical; see
   * `PrismaUserCredentialRepository.recordFailedSignIn`.
   *
   * The returned outcome is `locked` only when THIS attempt is what crossed the
   * threshold. An unknown identifier can never cross it, because there is no row
   * to count on — which is the one asymmetry the port documents, and it is not
   * observable in the response.
   */
  private async refuse(identifier: string, now: Date): Promise<PasswordSignInOutcome> {
    const counted = await this.deps.users.recordFailedSignIn({
      identifier,
      now,
      maxAttempts: this.deps.lockout.maxAttempts,
      lockoutMs: this.deps.lockout.lockoutMs,
    });

    if (counted.outcome === 'locked') {
      return { outcome: 'locked', lockedUntil: counted.lockedUntil };
    }
    return { outcome: 'rejected' };
  }

  /**
   * Rewrite a stale digest at the current parameters.
   *
   * `ADR-007`'s migration path: a legacy or under-parameterised hash is upgraded
   * on a successful sign-in, with no reset and no second column.
   *
   * The one `catch` in this file, and its justification is in the header: the
   * password has already been proved, so a failed maintenance write must not deny
   * a legitimate sign-in. It warns rather than staying silent, because a
   * permanently failing upgrade is an operational problem someone must see.
   *
   * `console.warn` is permitted by the base ESLint config's `no-console`
   * allow-list. This moves to the `AGENTS.md` 2.15 structured logger, and to its
   * dual file-and-database write, with `PLT-502`.
   */
  private async upgradeStoredCredential(
    userId: string,
    password: string,
    now: Date,
  ): Promise<void> {
    try {
      const rehashed = await this.deps.hasher.hash(password, this.deps.hashParameters);
      await this.deps.users.replaceCredential({
        userId,
        passwordHash: rehashed.hash,
        passwordAlgorithm: rehashed.algorithm,
        now,
      });
    } catch {
      console.warn(
        'SignInWithPassword: verified a password that needed rehashing but could not rewrite it. ' +
          'The sign-in stands; the stored digest keeps its old parameters until the next one. ' +
          'Repeated occurrences mean this deployment needs attention.',
      );
    }
  }
}
