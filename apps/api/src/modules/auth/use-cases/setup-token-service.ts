import type { IClock } from '../domain/ports/clock.js';
import type {
  ISetupTokenRepository,
  IssuedSetupToken,
} from '../domain/repositories/setup-token-repository.js';
import { decideSetupToken, type SetupTokenVerdict } from '../domain/services/setup-token.js';

/**
 * Issuing, verifying and consuming the one-time setup token of `PLT-107`.
 *
 * ## Why this is a use-case and not a domain service
 *
 * `decideSetupToken` in `domain/services/` holds the security RULE, as a pure
 * function that cannot reach a database — the same split
 * `refresh-token-rotation.ts` established. This class is the application half:
 * it supplies the clock, calls the repository, and lets the rule decide. Two
 * concerns, two files, so either can be read on its own.
 *
 * ## Why consumption is verify-then-GUARD rather than guard-only
 *
 * A caller needs to know *why* a claim failed — unclaimed, consumed, or invalid
 * — and the guard alone cannot tell it, because a zero-row update is the same
 * answer for "expired a moment ago" and "someone beat me to it". So this
 * inspects first to get the reason, and then asks the guard for the last word.
 *
 * The guard is what makes it safe. The inspect is not: two callers can both read
 * a live token, and only the conditional update inside `consume` can collapse
 * that to one winner. Read `PrismaSetupTokenRepository.consume` before changing
 * the order of these two calls — putting the guard first would throw away the
 * reason, and putting anything before it that could accept would reintroduce the
 * double-claim the story forbids.
 *
 * ## What this class deliberately does NOT do
 *
 * It does not set a password, flip the user to `ACTIVE`, or write an audit row.
 * Those belong to `PLT-107`'s completion use-case, which needs an
 * `IPasswordHasher` — and there is none (`ADR-007`; see `password-hasher.ts`).
 * Splitting the claim from the credential is what keeps this half buildable and
 * testable while the argon2 dependency is still undecided.
 */
export class SetupTokenService {
  constructor(
    private readonly setupTokens: ISetupTokenRepository,
    private readonly clock: IClock,
  ) {}

  /**
   * Mint a token for a user and hand the plaintext back exactly once.
   *
   * `ttlMs` is passed in rather than defaulted: it is a school setting
   * (`AGENTS.md` 2.14), and a default here would be the hard-coded threshold
   * `AGENTS.md` 8 forbids.
   */
  async issue(params: {
    readonly userId: string;
    readonly ttlMs: number;
  }): Promise<IssuedSetupToken> {
    return this.setupTokens.issue({
      userId: params.userId,
      ttlMs: params.ttlMs,
      now: this.clock.now(),
    });
  }

  /**
   * Say what a presented token would get, without spending it.
   *
   * This is the call a controller makes BEFORE checking a password, so that a
   * password failing the policy leaves the school's only way in intact. It is
   * inert by contract: it must not mutate anything.
   */
  async verify(setupTokenPlaintext: string): Promise<SetupTokenVerdict> {
    return decideSetupToken(await this.setupTokens.inspect(setupTokenPlaintext), this.clock.now());
  }

  /**
   * Claim the token.
   *
   * Exactly one concurrent caller receives `accept`, and that much is guaranteed
   * by the conditional UPDATE inside `PrismaSetupTokenRepository.consume`. It is
   * the whole security claim, and it holds.
   *
   * WHICH refusal the losers get is a weaker promise than it looks, and the
   * weaker version is the true one:
   *
   *   - a caller that inspected while the token was live reaches the guard, and
   *     is told `reject-consumed`;
   *   - a caller whose inspection lands after the winner's UPDATE has committed
   *     is told `reject-unclaimed`, because `consume` spends the token by NULLING
   *     the two token columns and this class deliberately writes nothing to the
   *     account (see its own header). The row it now reads is therefore
   *     byte-identical to a deployment that was never enrolled, and
   *     `deploymentState()` cannot tell the two apart from the token columns.
   *
   * That is option (b)'s recorded limitation, not a defect in the guard. It is
   * not hypothetical either: measured against real PostgreSQL, it is
   * DETERMINISTIC for a sequential second claim — `consume` the token, then call
   * this method again with no credential written, and the second call is
   * `reject-unclaimed` every time.
   *
   * No production route calls this method. `CompleteFirstAdministratorSetup`
   * calls `verify` (a read) and then hands the claim to `IBootstrapClaimRepository`,
   * which spends the token and writes the credential in ONE transaction — so a
   * post-claim reader always sees `bootstrap-claimed` and every loser there is
   * told `reject-consumed`. Read `prisma-bootstrap-claim-repository.ts` before
   * treating this method as the claim path.
   */
  async consume(setupTokenPlaintext: string): Promise<SetupTokenVerdict> {
    const now = this.clock.now();
    const verdict = decideSetupToken(await this.setupTokens.inspect(setupTokenPlaintext), now);

    // A refusal never reaches the guard, so an expired, forged or already-spent
    // token cannot be used to burn the one live one.
    if (verdict.action !== 'accept') return verdict;

    const { consumed } = await this.setupTokens.consume({ setupTokenPlaintext, now });

    // The guard lost. Somebody consumed the token between the inspection above
    // and this update — which is the concurrent-claim case the story calls out,
    // and the one a naive implementation gets wrong by trusting the inspection.
    return consumed ? verdict : { action: 'reject-consumed' };
  }
}
