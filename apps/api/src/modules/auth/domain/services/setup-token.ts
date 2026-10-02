/**
 * What a presented setup token gets.
 *
 * ## Why this is a pure function and not a branch inside the use-case
 *
 * `PLT-107` is the only unauthenticated write in the system: a school that
 * knows the one-time token can become its own administrator. Everything this
 * function decides is therefore a security decision — when a token dies, and
 * which rejections may be told apart — and `refresh-token-rotation.ts` sets the
 * precedent for keeping those decisions somewhere that cannot reach the
 * database, the clock, or the network.
 *
 * Three inputs (does the presented token match a row, has it expired, what state
 * is the deployment's bootstrap in) and one output: a named verdict. The
 * repository does the I/O; this says what the I/O means.
 *
 * ## Why the deployment state is a three-way enum
 *
 * Option (b) of the story put the token in two nullable columns on the single
 * `INVITED` row, so consumption is expressed by NULLING those columns. That is
 * what makes a token single-use, and it is also why the columns alone cannot say
 * whether a token was ever issued: before issue and after consumption the row
 * looks identical.
 *
 * The two questions therefore need two answers, and they are not the same
 * question. "Has a token been issued?" decides whether a wrong token is
 * `reject-invalid` or `reject-unclaimed`. "Has the one claim been made?" decides
 * `reject-unclaimed` or `reject-consumed`. Collapsing either into the other was
 * tried and it breaks an acceptance criterion — a boolean `bootstrapOutstanding`
 * made an expired token and a forged one produce different verdicts, which is
 * exactly the oracle the story forbids.
 *
 * ## The three rejections, and the one pair that must stay identical
 *
 * `reject-invalid` is deliberately the verdict for BOTH an expired token and a
 * token that was never recognised while one is issued. That collapse is an
 * acceptance criterion, not tidiness: if those two were distinguishable, the
 * setup route would tell an attacker whether a token it guessed had ever
 * existed, and the whole point of an unauthenticated route is that it does not.
 *
 * `reject-unclaimed` and `reject-consumed` are separate because the story asks
 * for them to be. An unenrolled deployment answers 404 rather than advertising
 * the endpoint, and a token presented after the one legitimate claim answers
 * 409. Both are deployment-level facts rather than facts about the presented
 * token.
 *
 * The residual leak — 404 versus 400 says whether a bootstrap token has been
 * issued on this deployment — is a consequence of the story requiring both, and
 * is recorded here rather than papered over. Rate limiting is the mitigation the
 * story names for it.
 */

/** The row a presented token matched, if any. */
export interface SetupTokenMatch {
  /** Whose credential this token may claim. Carried ONLY on an accept. */
  readonly userId: string;
  /**
   * When the token stops being valid, or `null` if the row carries no window.
   *
   * Nullable because the two schema columns are independently nullable, so a
   * hash without an expiry is representable and has to be decided on. It is
   * decided as EXPIRED.
   */
  readonly expiresAt: Date | null;
}

/**
 * What is true of this deployment's one bootstrap, independent of the token that
 * was presented.
 *
 * Exactly one of these is true at a time, and each maps to exactly one refusal.
 */
export type SetupTokenDeploymentState =
  /** A setup token is outstanding. A wrong token is wrong, not absent. */
  | 'token-issued'
  /** Nothing has ever been issued and the bootstrap is unclaimed. */
  | 'no-token-issued'
  /** The one claim has been made. Every token is now too late. */
  | 'bootstrap-claimed';

/** Everything a repository learned about a presented token. */
export interface PresentedSetupToken {
  /** The row whose stored hash equals the presented token's hash, or `null`. */
  readonly match: SetupTokenMatch | null;
  /**
   * Which of the three deployment states holds.
   *
   * Read off the account rather than off the token, because option (b) leaves
   * the token columns null both before issue and after consumption. See the
   * header for why a boolean could not carry this.
   */
  readonly deployment: SetupTokenDeploymentState;
}

/**
 * What the caller must do. Named, so no branch is a bare boolean read, and so a
 * new rejection cannot be added by quietly widening an existing one.
 */
export type SetupTokenVerdict =
  /** The token is live. Claim the credential on `userId`. */
  | { readonly action: 'accept'; readonly userId: string }
  /** Nothing was ever issued here: 404, and do not advertise the endpoint. */
  | { readonly action: 'reject-unclaimed' }
  /** The one claim is done: 409, too late rather than wrong. */
  | { readonly action: 'reject-consumed' }
  /**
   * Expired, or never recognised. **One verdict, deliberately**, so the two
   * cannot be told apart by anything downstream.
   */
  | { readonly action: 'reject-invalid' };

/**
 * Decide, from what the repository found, what must happen.
 *
 * Order matters, and it is the security content of this function:
 *
 * 1. **A match is decided first**, because it is the only branch that can
 *    accept. Every other branch is a refusal.
 * 2. **Expiry is the boundary**, and it is exclusive: a token is valid while
 *    `expiresAt > now`. Exactly at `expiresAt` it is already gone. See the
 *    boundary rows in the spec — an inclusive comparison is the bug this
 *    ordering exists to prevent.
 * 3. **Only a non-match consults the deployment state**, which is the only
 *    thing that can tell "never enrolled" and "too late" from "wrong".
 */
export function decideSetupToken(presented: PresentedSetupToken, now: Date): SetupTokenVerdict {
  const { match } = presented;

  if (match !== null) {
    // `expiresAt === null` folds into the same refusal as an expired token: a
    // credential with no validity window is malformed, and fail-closed is the
    // only safe reading of a malformed credential.
    if (match.expiresAt === null || match.expiresAt.getTime() <= now.getTime()) {
      return { action: 'reject-invalid' };
    }
    return { action: 'accept', userId: match.userId };
  }

  switch (presented.deployment) {
    case 'token-issued':
      // A token exists here; the presented one simply is not it. Indistinguishable
      // from expiry on purpose.
      return { action: 'reject-invalid' };
    case 'no-token-issued':
      return { action: 'reject-unclaimed' };
    case 'bootstrap-claimed':
      return { action: 'reject-consumed' };
  }
}
