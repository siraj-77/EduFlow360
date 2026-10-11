import type { IClock } from '../domain/ports/clock.js';
import type { IPasswordHasher } from '../domain/ports/password-hasher.js';
import type { ISessionRepository } from '../domain/ports/session-repository.js';
import type { IUserCredentialRepository } from '../domain/repositories/user-credential-repository.js';
import type { IPasswordResetTokenRepository } from '../domain/repositories/password-reset-token-repository.js';
import {
  decidePasswordAcceptance,
  type PasswordPolicy,
  type PasswordPolicyRefusal,
} from '../domain/services/password-policy.js';

/**
 * `ConfirmPasswordReset` — `PLT-105` T2.
 *
 * ## The order, and why it is the safe one
 *
 *   1. **The password policy.** Cheapest check, and it spends nothing — a
 *      weak password must not consume the link (the `PLT-107` precedent, and
 *      the same reasoning: the caller should be able to fix their mistake).
 *   2. **The token.** One atomic redemption. Refused → nothing was written,
 *      and the caller is told only "not valid or expired".
 *   3. **The credential.** The new hash, at the school's argon2 parameters.
 *   4. **Every session revoked.** AC-2.
 *
 * Step 3 before step 4, and the failure test pins it: a reset whose
 * revocation failed but whose password changed still answers `reset`,
 * because the alternative is a user locked out of the account they just
 * recovered. The revocation failure is logged.
 *
 * ## Why the refusal is one answer
 *
 * Unknown, already-used and expired all answer the same `refused`. A caller
 * probing links learns nothing from which one they got — the same posture as
 * the sign-in refusal, applied to a credential sitting in a mailbox.
 */

export interface ConfirmPasswordResetDeps {
  readonly users: IUserCredentialRepository;
  readonly tokens: IPasswordResetTokenRepository;
  readonly sessions: ISessionRepository;
  readonly hasher: IPasswordHasher;
  readonly clock: IClock;
  /** The provisional policy (`password-policy.ts`). */
  readonly policy: PasswordPolicy;
  /** This school's argon2id cost parameters. Never defaulted (`ADR-007`). */
  readonly hashParameters: Parameters<IPasswordHasher['hash']>[1];
}

/**
 * The outcome, with the two refusals kept APART at the boundary.
 *
 * A weak password and a dead link are both 400s, but they are not the same
 * 400: one is a caller mistake to fix and retry, the other is a spent or
 * expired credential. The controller answers each with its own frozen body,
 * and neither body echoes the candidate (`AGENTS.md` 2.13 — the code, never
 * the string).
 */
export type PasswordResetOutcome =
  | { readonly outcome: 'reset' }
  /** The link is unknown, used, or expired. Nothing was written. */
  | { readonly outcome: 'token-refused' }
  /** The candidate failed the policy. Nothing was spent. */
  | { readonly outcome: 'password-refused'; readonly refusal: PasswordPolicyRefusal };

export class ConfirmPasswordReset {
  constructor(private readonly deps: ConfirmPasswordResetDeps) {}

  async confirm(params: {
    readonly token: string;
    readonly newPassword: string;
  }): Promise<PasswordResetOutcome> {
    // ── 1. The policy, before the token, so a refusal spends nothing. ───────
    const acceptance = decidePasswordAcceptance(params.newPassword, this.deps.policy);
    if (!acceptance.accepted) {
      return { outcome: 'password-refused', refusal: acceptance.refusal };
    }

    // ── 2. The token. Refused → nothing was written. ────────────────────────
    const redeemed = await this.deps.tokens.consume({
      tokenPlaintext: params.token,
      now: this.deps.clock.now(),
    });

    if (redeemed.outcome !== 'consumed') return { outcome: 'token-refused' };

    // ── 3. The new credential. Expensive, and only after proof of control. ──
    const now = this.deps.clock.now();
    const hashed = await this.deps.hasher.hash(params.newPassword, this.deps.hashParameters);

    // `replaceCredential` is documented for "after a successful
    // verification" — and a consumed reset token IS that verification: proof
    // of control of the account's mailbox. The same guarded invariant.
    await this.deps.users.replaceCredential({
      userId: redeemed.userId,
      passwordHash: hashed.hash,
      passwordAlgorithm: hashed.algorithm,
      now,
    });

    // ── 4. Every prior session, revoked. Failure logged, not answered. ──────
    try {
      await this.deps.sessions.revokeAllForUser({
        userId: redeemed.userId,
        reason: 'password-reset',
        now,
      });
    } catch (cause) {
      console.error(
        `ConfirmPasswordReset could not revoke the prior sessions of user ${redeemed.userId}: ` +
          `${cause instanceof Error ? cause.message : String(cause)}. ` +
          'The new password IS in effect; those sessions should be revoked by hand.',
      );
    }

    return { outcome: 'reset' };
  }
}
