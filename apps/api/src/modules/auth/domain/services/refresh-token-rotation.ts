/**
 * What to do with a presented refresh token.
 *
 * ## Why this is a pure function and not a service
 *
 * `ADR-008` requires that presenting an already-rotated token revokes the
 * WHOLE family, turning silent theft into a detectable, recoverable event.
 * That is a decision, and a decision is worth having in a place that cannot
 * reach the database, the clock, or the network. Everything that follows from
 * "here is the token's state" is decided here and executed elsewhere.
 *
 * So this module has three inputs — is the token found, has it been used, is
 * the family still alive — and one output: a named verdict. The repository
 * does I/O; this says what the I/O means.
 *
 * ## The rule, stated once
 *
 * A refresh token is single-use. Presenting one that was already consumed is
 * not a client bug to be tolerated; it is the signature of a stolen token, and
 * the only safe response is to revoke every token descended from the same
 * login. The alternative — honour it — means the attacker and the legitimate
 * user alternate forever and neither can prove which is which.
 */

/** The three states a presented token can be in, after a lookup. */
export interface PresentedTokenState {
  /** No row matched the presented hash. */
  readonly found: false;
}

export interface FoundTokenState {
  readonly found: true;
  /** `usedAt` is set once the token has been rotated away. */
  readonly usedAt: Date | null;
  /** Set when the whole family was revoked, e.g. after a detected reuse. */
  readonly familyRevokedAt: Date | null;
  /** Whether the session the token belongs to is still live. */
  readonly sessionRevokedAt: Date | null;
  /** The family this token belongs to. Rotations stay in one family. */
  readonly familyId: string;
}

/** What the caller must do. Named, so no branch is a bare boolean read. */
export type RotationVerdict =
  /** Nothing matched. Either a forgery or a token already purged. */
  | { readonly action: 'reject-unknown' }
  /**
   * A live, unused token. Issue its successor in the same family.
   */
  | { readonly action: 'rotate'; readonly familyId: string }
  /**
   * A token that was already consumed. **Revoke the entire family**, then
   * reject. This is the theft signal.
   */
  | { readonly action: 'revoke-family-reuse'; readonly familyId: string }
  /** The session behind the token is gone. Nothing to rotate into. */
  | { readonly action: 'reject-session-revoked'; readonly familyId: string }
  /** The family was already revoked. Reject, and revoke nothing further. */
  | { readonly action: 'reject-family-revoked'; readonly familyId: string };

/**
 * Decide, from a lookup result, what must happen.
 *
 * Order matters and is the security content of this function:
 *
 * 1. **Unknown first.** No row means no decision to make.
 * 2. **Session revoked next.** A dead session must not be resurrected by a
 *    token that happens to be live.
 * 3. **Family revoked next**, for the same reason one level up.
 * 4. **Used last among the rejections**, because reuse is the only verdict
 *    that *acts* — it revokes. Everything above it merely refuses.
 */
export function decideRotation(state: PresentedTokenState | FoundTokenState): RotationVerdict {
  if (!state.found) return { action: 'reject-unknown' };
  if (state.sessionRevokedAt !== null) {
    return { action: 'reject-session-revoked', familyId: state.familyId };
  }
  if (state.familyRevokedAt !== null) {
    return { action: 'reject-family-revoked', familyId: state.familyId };
  }
  if (state.usedAt !== null) {
    return { action: 'revoke-family-reuse', familyId: state.familyId };
  }
  return { action: 'rotate', familyId: state.familyId };
}
