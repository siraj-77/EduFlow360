import type { IClock } from '../ports/clock.js';
import type { PresentedSetupToken, SetupTokenDeploymentState } from '../services/setup-token.js';

/**
 * The one-time setup token, as the application layer sees it.
 *
 * `AGENTS.md` 2.2: a repository is a port, and the Prisma implementation of it
 * lives in `infrastructure/postgres/`. Nothing above this line knows a database
 * exists.
 *
 * ## Why this port has no `markConsumed(userId)`
 *
 * The story's whole security claim is that two concurrent claims cannot both
 * succeed, and that claim cannot be honoured by an interface that takes a
 * `userId`. Two callers holding the same user id are indistinguishable to such a
 * method, so the winner would have to be decided by whoever read first — which
 * is a read-then-write, and read-then-write lets both through. So consumption
 * takes the TOKEN and is expected to be one conditional UPDATE whose affected-row
 * count is the verdict. See `PrismaSetupTokenRepository.consume`.
 *
 * ## Why inspection and consumption are separate
 *
 * `PLT-101` will refuse a password that fails the policy, and the story requires
 * that rejection not burn the school's only way in. So `inspect` is inert and
 * `consume` is the only method that changes anything. A caller that validated
 * first and consumed second can therefore be written without holding the token
 * across a password check it might fail.
 */
export interface IssuedSetupToken {
  /**
   * The token itself, returned exactly once. Never stored, never logged
   * (`AGENTS.md` 2.13) — a setup token is an UNAUTHENTICATED route to the
   * administrator account, so this string is the whole ballgame.
   */
  readonly setupTokenPlaintext: string;
  readonly setupTokenExpiresAt: Date;
}

/** What a consumption attempt did. `true` means this caller won the token. */
export interface ConsumeResult {
  readonly consumed: boolean;
}

export interface ISetupTokenRepository {
  /**
   * Mint a token for `userId` and store only its SHA-256.
   *
   * Minting lives here rather than in the use-case on purpose. `AGENTS.md` 2.4
   * bans ambient randomness from `domain/` and `use-cases/`, and the sibling
   * `ISessionRepository.issue` already mints its two tokens behind this same
   * seam — so the hashing and the CSPRNG cannot drift apart between the two
   * credential-minting paths.
   *
   * Issuing REPLACES any token already on the row, so a school that is handed a
   * second token has exactly one live way in rather than two.
   */
  issue(params: {
    readonly userId: string;
    /** How long the token is valid. From school settings, never a constant. */
    readonly ttlMs: number;
    /** When the token is issued. Injected, never ambient (`AGENTS.md` 2.4). */
    readonly now: Date;
  }): Promise<IssuedSetupToken>;

  /**
   * Report what a presented token matched, and what state the deployment's one
   * bootstrap is in.
   *
   * Reads only. It exists so a caller can reject a request — a bad password, a
   * rate limit — without touching the stored token.
   */
  inspect(setupTokenPlaintext: string): Promise<PresentedSetupToken>;

  /**
   * Spend the token, atomically, if and only if it is still live.
   *
   * MUST be a single conditional update whose `WHERE` includes the presented
   * hash and the expiry, and MUST report the affected-row count. Anything less
   * is a read-then-write and the acceptance criterion "exactly one of two
   * concurrent claims succeeds" does not hold.
   *
   * `consumed: false` is the loser's answer, and it is indistinguishable by
   * design: the loser cannot tell whether the token was expired a microsecond
   * earlier or consumed by the request that beat it.
   */
  consume(params: {
    readonly setupTokenPlaintext: string;
    /** When the claim is made. Injected, never ambient (`AGENTS.md` 2.4). */
    readonly now: Date;
  }): Promise<ConsumeResult>;
}

/**
 * Which of the three bootstrap states this deployment is in.
 *
 * Re-exported so a repository implementation in `infrastructure/` can build one
 * without reaching into `domain/services/` for the type, and so callers reading a
 * verdict can name the state they are looking at.
 */
export type { SetupTokenDeploymentState };

/** Injected into anything that ages a token. Re-exported for convenience. */
export type { IClock };
