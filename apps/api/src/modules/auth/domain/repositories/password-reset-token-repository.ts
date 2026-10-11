/**
 * The reset-token store: issue one credential, redeem it once (`PLT-105`).
 *
 * ## Why the plaintext is minted HERE and nowhere else
 *
 * `AGENTS.md` 2.4: no randomness in domain or use-cases. The session
 * repository carries the same arrangement (`newSessionToken()` inside
 * `PrismaSessionRepository`), and the reason is the same: an injected
 * generator would let a deterministic test mint a predictable token, and the
 * one property nobody wants a token to have is predictability.
 *
 * So `issue()` returns the plaintext exactly once — to the caller that emails
 * it — and stores only the hash. The interface says so in its shape rather
 * than in a comment: there is no `findByPlaintext`, only `consume`.
 */

/** DI token. A symbol because an `interface` has no runtime value to resolve against. */
export const I_PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('IPasswordResetTokenRepository');

/** What `issue` hands back, and the only time the plaintext exists outside an email. */
export interface IssuedResetToken {
  readonly tokenId: string;
  /** Mailed in the link; never stored, never logged (`AGENTS.md` 2.13). */
  readonly tokenPlaintext: string;
  /** Stored, for the audit trail and for `PC-404`'s retention design. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/** Why a redemption was refused. Distinct reasons so the log can say which. */
export type RedemptionRefusal =
  /** No row carries this hash — a forged or mistyped link. */
  | 'unknown'
  /** The row exists and `consumedAt` is set — the link was already used. */
  | 'already-consumed'
  /** The row exists, is unconsumed, and `expiresAt` has passed. */
  | 'expired';

export type Redemption =
  | { readonly outcome: 'consumed'; readonly userId: string }
  | { readonly outcome: 'refused'; readonly reason: RedemptionRefusal };

export interface IPasswordResetTokenRepository {
  /**
   * Mint one credential for `userId`, valid for `ttlMs` from `now`.
   *
   * `ttlMs` arrives from the caller (configuration via `PASSWORD_RESET_TTL_MS`)
   * rather than being read here, so the policy is a parameter of the
   * decision and not a fact of the table.
   */
  issue(params: {
    readonly userId: string;
    readonly ttlMs: number;
    readonly now: Date;
    readonly requestedIp?: string | null;
    readonly requestedDevice?: string | null;
  }): Promise<IssuedResetToken>;

  /**
   * Redeem a token, atomically.
   *
   * ONE guarded UPDATE: `consumedAt IS NULL AND expiresAt > now` matched on
   * the hash. The row count is the decision — not a read followed by a write,
   * which lets two concurrent redemptions both pass the check and both
   * succeed.
   */
  consume(params: { readonly tokenPlaintext: string; readonly now: Date }): Promise<Redemption>;
}
