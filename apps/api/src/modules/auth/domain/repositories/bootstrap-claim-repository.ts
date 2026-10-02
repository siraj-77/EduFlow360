/**
 * Spending the one-time setup token AND setting the first administrator's
 * credential, as the application layer sees it.
 *
 * ## Why this is a separate port and not a method on `ISetupTokenRepository`
 *
 * Because the two writes must share ONE transaction, and an interface that
 * offered them separately could not promise that.
 *
 * `ISetupTokenRepository.consume` is already a single conditional `UPDATE` whose
 * affected-row count is the verdict — one statement, therefore already atomic,
 * and deliberately not wrapped in a transaction of its own. It was written for
 * one job and the story says so: "the credential write and the token consumption
 * MUST share ONE transaction".
 *
 * Adding a `claimAndSetCredential` beside it would leave `consume` reachable, and
 * a caller could still spend a token without writing a credential. A separate
 * port makes the atomic pair the only thing this interface can do: there is no
 * method here that spends the token on its own, and the use-case that holds this
 * port holds nothing else that could.
 *
 * ## Why the pair is irreversible, and there is no `release()`
 *
 * Option (b) of the story put the token in two nullable columns on the single
 * `INVITED` row. Once consumed, the school's only way in is gone, and the story
 * records in its own task list that a deployment which loses its token has no
 * in-product recovery. So this port deliberately exposes no way to un-spend one,
 * no `markConsumed` without a credential, and no `delete`.
 *
 * ## Why the credential arrives already hashed
 *
 * The caller hashes with `IPasswordHasher` BEFORE calling, deliberately, and the
 * reason is this interface's transaction: argon2 is expensive and holds memory,
 * and opening a transaction to then spend tens of milliseconds and tens of
 * megabytes inside it would hold a row lock for the duration and make every
 * concurrent claim queue behind a KDF. Hashing first also means a hash failure
 * costs nothing, because nothing has been written yet.
 */

/** What to write onto the account. Never the plaintext. */
export interface BootstrapCredential {
  /**
   * The encoded digest from `IPasswordHasher.hash`, destined for
   * `User.passwordHash`.
   *
   * Never logged, never returned in a response (`AGENTS.md` 2.13).
   */
  readonly passwordHash: string;
  /** The label destined for `User.passwordAlgorithm`. Read back by verify-and-rehash. */
  readonly passwordAlgorithm: string;
  /** Stamped onto `User.passwordUpdatedAt`. Injected, never ambient. */
  readonly now: Date;
}

/**
 * The login identifiers the caller may set at the same time.
 *
 * Both optional and both independent, because the setup token already
 * identifies exactly one row: they are a convenience for a deployment seeded
 * with placeholders, never an input to the claim. Absent means "leave the
 * existing value alone", which is why they are absent rather than `undefined` —
 * `exactOptionalPropertyTypes` is on, and the two are different states.
 */
export interface BootstrapIdentity {
  readonly email?: string;
  readonly username?: string;
}

/**
 * What the claim did.
 *
 * `{ claimed: false }` deliberately carries nothing else. The loser of a race,
 * an expired token and a forgery all get this same value, because telling them
 * apart is the oracle `setup-token.ts` exists to prevent.
 */
export type BootstrapClaimOutcome =
  { readonly claimed: true; readonly userId: string } | { readonly claimed: false };

export interface IBootstrapClaimRepository {
  /**
   * Spend the token and write the credential, or do neither.
   *
   * MUST be one transaction. Two commits are the defect this port exists to make
   * impossible to express: the first would spend the school's only way in, and
   * the second — if it then failed — would leave nobody with a password and no
   * recovery path.
   *
   * MUST decide the winner with a conditional update whose `WHERE` includes the
   * presented hash and the expiry, and MUST report the affected-row count. A
   * read-then-write inside the transaction is still a read-then-write, and
   * "exactly one of two concurrent claims succeeds" does not hold.
   *
   * MUST NOT resolve as a refusal on anything other than the claim losing or the
   * token being unacceptable. A genuine fault — a dead connection, a failed
   * statement — must REJECT, because swallowing it would report a refusal while
   * the transaction's fate is unknown.
   */
  claim(params: {
    /** The token as presented. SHA-256'd here; never stored, never logged. */
    readonly setupTokenPlaintext: string;
    readonly credential: BootstrapCredential;
    /** When the claim is made. Injected, never ambient (`AGENTS.md` 2.4). */
    readonly now: Date;
    /** Optional replacements for the account's login identifiers. */
    readonly identity?: BootstrapIdentity;
  }): Promise<BootstrapClaimOutcome>;
}
