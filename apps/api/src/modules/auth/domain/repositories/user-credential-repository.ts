/**
 * Reading and updating the credential a password sign-in needs, as the
 * application layer sees it.
 *
 * ## Why this port exists separately from `ISessionRepository`
 *
 * Because it answers a different question. `ISessionRepository` owns the session
 * and the refresh-token family; this owns the row that decides whether a
 * password is correct at all — the hash, the algorithm, the account status, and
 * the lockout counters. A port that did both would be a god interface, and
 * `AGENTS.md` 2's Interface Segregation is a rule rather than a slogan.
 *
 * ## Why `findByIdentifier` returns a MATCH and not `null`
 *
 * Because the difference between "no such account" and "here is the account" is
 * the user-enumeration oracle this whole route exists to close, and it is easier
 * to keep closed when the type system says which one you are holding. A caller
 * that wrote `if (record === null)` has made a decision; a caller that wrote
 * `if (!match.matched)` has made the same decision with the enumeration-safe
 * vocabulary in front of them.
 *
 * ## Why `recordFailedAttempt` is keyed on the IDENTIFIER and not the user id
 *
 * For timing, and this is the only reason. An unknown identifier and a known one
 * must cost the same, or "no such user" is distinguishable by how long the
 * response took. Keying the update on the identifier means the same statement is
 * issued either way: for an unknown identifier it simply matches zero rows. There
 * is no code path in which the absence of an account saves a database round trip.
 *
 * ## Why `replaceCredential` exists at all
 *
 * It is `ADR-007`'s verify-and-rehash, and it is the only reason a successful
 * login touches the credential row. A caller MUST invoke it only after a
 * verification has succeeded: writing a fresh hash over an account whose password
 * was not proved would lock the real owner out.
 */

/** Everything a password sign-in needs to decide, and nothing it does not. */
export interface UserCredentialRecord {
  readonly userId: string;
  /** The encoded digest. Never logged, never returned in a response. */
  readonly passwordHash: string;
  /** `User.passwordAlgorithm`; what `IPasswordHasher.verify` is told to expect. */
  readonly passwordAlgorithm: string;
  /** `User.status`. Only `ACTIVE` may sign in. */
  readonly status: string;
  /** How many consecutive failures are on the row. */
  readonly failedLoginAttempts: number;
  /** When a lockout expires, or `null` when the account is not locked. */
  readonly lockedUntil: Date | null;
}

export type IdentifierMatch =
  { readonly matched: true; readonly record: UserCredentialRecord } | { readonly matched: false };

/**
 * What counting a failure produced.
 *
 * `locked-again` and `counted` are separate so the caller can decide what to
 * SAY. What it must never do is say them differently in a way that reveals
 * whether the identifier was real — see `sign-in-with-password.ts`.
 */
export type FailedSignInOutcome =
  /** No account carried that identifier, so nothing was counted. */
  | { readonly outcome: 'unknown-identifier' }
  /** A counter went up and the account is still usable. */
  | { readonly outcome: 'counted'; readonly failedLoginAttempts: number }
  /** The threshold was reached; the account is now locked until this instant. */
  | { readonly outcome: 'locked'; readonly lockedUntil: Date };

export interface IUserCredentialRepository {
  /**
   * Look up the account an identifier names, by email OR username.
   *
   * MUST be one indexed read and MUST return a row whatever its status: a
   * suspended account is a real account, and hiding it here would make "no such
   * user" and "suspended" the same answer — which is a leak in the other
   * direction, and a confusing one.
   */
  findByIdentifier(identifier: string): Promise<IdentifierMatch>;

  /**
   * Count one failed sign-in against whichever account owns `identifier`.
   *
   * MUST issue the same statements whether or not an account matched, so that a
   * missing account is not faster than a wrong password. Reaching
   * `maxAttempts` locks the account until `now + lockoutMs` and resets the
   * counter, so a locked account does not accumulate an unbounded integer.
   *
   * MUST NOT lock an account the caller did not identify, and MUST NOT report
   * differently for a real and a missing identifier beyond what
   * `FailedSignInOutcome` documents.
   */
  recordFailedSignIn(params: {
    readonly identifier: string;
    readonly now: Date;
    /** Threshold. From configuration, never a constant (`AGENTS.md` 2.14). */
    readonly maxAttempts: number;
    /** Lockout duration in milliseconds. From configuration. */
    readonly lockoutMs: number;
  }): Promise<FailedSignInOutcome>;

  /**
   * Clear the failure counter, stamp `lastLoginAt`, and lift a lockout.
   *
   * Only ever called after a password has been verified.
   */
  recordSuccessfulSignIn(params: { readonly userId: string; readonly now: Date }): Promise<void>;

  /**
   * Replace the stored digest with a fresh one at current parameters.
   *
   * `ADR-007`'s verify-and-rehash. Only ever called after a SUCCESSFUL
   * verification, and only when the hasher reported `needsRehash`.
   */
  replaceCredential(params: {
    readonly userId: string;
    readonly passwordHash: string;
    readonly passwordAlgorithm: string;
    readonly now: Date;
  }): Promise<void>;
}
