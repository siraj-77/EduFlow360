/**
 * Whether a candidate password may become one.
 *
 * ## This is a placeholder, and the gap it fills is recorded above it
 *
 * The full argument — the corpus has no password policy, Phase 4 owns one, and
 * this is the smallest rule that makes `PLT-107`'s "a password that fails the
 * policy does not consume the token" testable — is in
 * `password-policy.spec.ts`. What belongs here is the shape.
 *
 * ## Why it is a pure function in `domain/services/`
 *
 * `decideSetupToken` is the precedent: the security RULE is a pure function that
 * cannot reach a database, a clock or a network, so it can be read, table-driven
 * and exhaustively tested on its own. A password policy that lived in a use-case
 * would be one whose branches are only reachable through a repository.
 *
 * ## Why it returns a refusal CODE and never the candidate
 *
 * `AGENTS.md` 2.13. Whoever logs a refusal must have nothing sensitive to log,
 * and a rule that returned "too short: 'abc'" would make that impossible to
 * guarantee. The verdict is a bare discriminated union; the string that caused it
 * stays where it came from and is not copied anywhere.
 *
 * ## Why it counts code points and not UTF-16 code units
 *
 * `String.length` counts code units, so `🔒` is 2 and a Devanagari conjunct can
 * be 3. This product ships Tamil, Sinhala and Arabic as first-class locales
 * (`AGENTS.md` 2.8), so a principal typing their own script must not be refused
 * for typing it. `[...candidate].length` counts code points.
 */

/** Why a candidate was refused. A code, never the candidate itself. */
export type PasswordPolicyRefusal = 'too-short' | 'too-long';

export interface PasswordPolicy {
  readonly minimumLength: number;
  readonly maximumLength: number;
  /**
   * `true` for the shipped default, `false` for a policy a school configured or
   * Phase 4 designed.
   *
   * Carried on the value rather than only in a comment so a caller — and a
   * reviewer reading a diff — can see that a number is unreviewed without
   * opening another file.
   */
  readonly provisional: boolean;
}

export type PasswordPolicyVerdict =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly refusal: PasswordPolicyRefusal };

/**
 * The policy a school that has configured nothing is held to.
 *
 * Length bounds only. **Provisional — see the file header.** The numbers are
 * `env.ts` defaults (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`) so that a
 * deployment can change them; this constant is what the process falls back to
 * when it has not.
 *
 * Twelve rather than NIST SP 800-63B's floor of eight, because this particular
 * credential is the whole installation: there is no second administrator to
 * call. That is a judgement, not a derivation.
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = Object.freeze({
  minimumLength: 12,
  maximumLength: 128,
  provisional: true,
});

/**
 * Decide whether `candidate` satisfies `policy`.
 *
 * Order is short-then-long, and it is a security ordering as much as a tidiness
 * one: a candidate that is both too short and too long is impossible (the schema
 * refuses such a policy), but if one were supplied, refusing it as `too-short`
 * never tells a caller anything about the other bound.
 */
export function decidePasswordAcceptance(
  candidate: string,
  policy: PasswordPolicy,
): PasswordPolicyVerdict {
  // Spread, not `.length`: code points. See the file header.
  const length = [...candidate].length;

  if (length < policy.minimumLength) return { accepted: false, refusal: 'too-short' };
  if (length > policy.maximumLength) return { accepted: false, refusal: 'too-long' };

  return { accepted: true };
}
