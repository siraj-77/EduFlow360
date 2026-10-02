import { createHash } from 'node:crypto';
import type {
  ConsumeResult,
  ISetupTokenRepository,
  IssuedSetupToken,
} from '../modules/auth/domain/repositories/setup-token-repository.js';
import type {
  PresentedSetupToken,
  SetupTokenDeploymentState,
} from '../modules/auth/domain/services/setup-token.js';

/**
 * An in-memory `ISetupTokenRepository` for tests that are not about the database.
 *
 * It lives here, outside `domain/`, for the same reason `fake-clock.ts` does:
 * `AGENTS.md` 2.4 bans ambient time and randomness under `domain/`, and this
 * double needs both to be a faithful in-memory stand-in.
 *
 * ## What this double is honest about
 *
 * It implements the port's CONTRACT, not the database's behaviour:
 *
 *   - it hashes with SHA-256, because the port says the plaintext is never
 *     stored and a double that kept it in the clear would let a test pass while
 *     the real repository leaked;
 *   - `consume` reproduces the conditional-update semantics — hash must match AND
 *     expiry must be in the future — because that predicate IS the port;
 *   - `refuseNextConsume()` makes the guard report zero rows on demand.
 *
 * That last one is the only knob, and it exists because the use-case spec has to
 * observe the loser of a race. A real database will not lose a race on command,
 * and forcing one would mean interleaving two connections and hoping. So the
 * zero-row outcome is asserted here, and the claim that a real conditional
 * update actually produces zero rows for the loser is asserted against real
 * PostgreSQL in `prisma-setup-token-repository.integration.spec.ts`. Neither file
 * proves the other's half, and together they do.
 */
export interface FakeSetupTokenOptions {
  /**
   * Which deployment state this fake starts in.
   *
   * It is a STARTING state, not a constant: consuming the token moves it to
   * `bootstrap-claimed`, because that is what happens to the account. A double
   * that reported `token-issued` forever would make a second claim look like a
   * forgery rather than a replay.
   */
  readonly deployment?: SetupTokenDeploymentState;
  /**
   * When the token on the fake expires. Defaults to an hour after construction,
   * so a test only sets it when expiry is the thing under test.
   */
  readonly expiresAt?: Date | null;
  /** The user a live token belongs to. */
  readonly userId?: string;
  /** Pre-seeded plaintext. Defaults to `fake-setup-token-1`. */
  readonly setupTokenPlaintext?: string;
}

export class FakeSetupTokenRepository implements ISetupTokenRepository {
  readonly issueCalls: Array<{ userId: string; ttlMs: number; now: Date }> = [];
  readonly inspectCalls: string[] = [];
  readonly consumeCalls: Array<{ setupTokenPlaintext: string; now: Date }> = [];

  private deployment: SetupTokenDeploymentState;
  private readonly userId: string;
  private readonly setupTokenPlaintext: string;
  private hash: string | null;
  private expiresAt: Date | null;
  private refuseNext = false;

  constructor(options: FakeSetupTokenOptions = {}) {
    this.deployment = options.deployment ?? 'token-issued';
    this.userId = options.userId ?? 'user-under-test';
    this.setupTokenPlaintext = options.setupTokenPlaintext ?? 'fake-setup-token-1';

    // Seeded with a live token by default: most use-case tests are about
    // orchestration, and making each of them issue first would bury the one test
    // that is about issuing.
    //
    // A deployment in any state other than `token-issued` cannot be holding one,
    // because consumption is what moves it out of that state and nothing else
    // clears the hash. Seeding a token anyway would make the double report a
    // state the real repository could never reach.
    const tokenPresent = this.deployment === 'token-issued';
    this.hash = tokenPresent ? this.hashOf(this.setupTokenPlaintext) : null;
    this.expiresAt =
      options.expiresAt === undefined
        ? tokenPresent
          ? new Date(Date.now() + 3_600_000)
          : null
        : options.expiresAt;
  }

  /** The hash currently on the row, or `null` once consumed. */
  storedHash(): string | null {
    return this.hash;
  }

  /** Make the next `consume` report zero rows, as a lost race would. */
  refuseNextConsume(): void {
    this.refuseNext = true;
  }

  async issue(params: { userId: string; ttlMs: number; now: Date }): Promise<IssuedSetupToken> {
    this.issueCalls.push({ userId: params.userId, ttlMs: params.ttlMs, now: params.now });

    const setupTokenExpiresAt = new Date(params.now.getTime() + params.ttlMs);
    // Issuing restores the `token-issued` state: a school handed a second token
    // has exactly one live way in, not two.
    this.deployment = 'token-issued';
    this.hash = this.hashOf(this.setupTokenPlaintext);
    this.expiresAt = setupTokenExpiresAt;

    return { setupTokenPlaintext: this.setupTokenPlaintext, setupTokenExpiresAt };
  }

  async inspect(setupTokenPlaintext: string): Promise<PresentedSetupToken> {
    this.inspectCalls.push(setupTokenPlaintext);

    if (this.hash !== null && this.hash === this.hashOf(setupTokenPlaintext)) {
      return {
        match: { userId: this.userId, expiresAt: this.expiresAt },
        deployment: this.deployment,
      };
    }

    return { match: null, deployment: this.deployment };
  }

  async consume(params: { setupTokenPlaintext: string; now: Date }): Promise<ConsumeResult> {
    this.consumeCalls.push({
      setupTokenPlaintext: params.setupTokenPlaintext,
      now: params.now,
    });

    if (this.refuseNext) {
      this.refuseNext = false;
      return { consumed: false };
    }

    // The port's predicate, reproduced: the hash must match AND the token must
    // still be inside its window. Either alone is not enough, which is exactly
    // what the real conditional UPDATE enforces.
    const matches = this.hash !== null && this.hash === this.hashOf(params.setupTokenPlaintext);
    const live = this.expiresAt !== null && this.expiresAt.getTime() > params.now.getTime();

    if (!matches || !live) return { consumed: false };

    // Consuming both spends the token and completes the bootstrap, which is why
    // a second claim reads as `bootstrap-claimed` rather than as a forgery.
    this.hash = null;
    this.expiresAt = null;
    this.deployment = 'bootstrap-claimed';
    return { consumed: true };
  }

  private hashOf(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
