import { beforeEach, describe, expect, it } from 'vitest';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeSetupTokenRepository } from '../../../testing/fake-setup-token-repository.js';
import { instant, instantAfter, minutesAgo } from '../../../testing/instant.js';
import { RecordingPasswordHasher } from '../../../testing/recording-password-hasher.js';
import type { PasswordHashParameters } from '../domain/ports/password-hasher.js';
import { DEFAULT_PASSWORD_POLICY } from '../domain/services/password-policy.js';
import type {
  BootstrapClaimOutcome,
  BootstrapCredential,
  BootstrapIdentity,
  IBootstrapClaimRepository,
} from '../domain/repositories/bootstrap-claim-repository.js';
import { Argon2PasswordHasher } from '../infrastructure/adapters/argon2-password-hasher.js';
import type { SetupTokenDeploymentState } from '../domain/services/setup-token.js';
import { SetupTokenService } from './setup-token-service.js';
import {
  CompleteFirstAdministratorSetup,
  PasswordRefusedError,
  SetupAlreadyClaimedError,
  SetupTokenInvalidError,
  SetupUnenrolledError,
} from './complete-first-administrator-setup.js';

/**
 * Claiming the deployment: spending the one-time token and setting the first
 * administrator's credential.
 *
 * ## The ordering this file exists to hold in place
 *
 * Three checks, and the order is the security content:
 *
 *   1. **the password policy** — pure, no I/O, and the rejection that must NOT
 *      burn the school's only way in;
 *   2. **the token verdict** — a read, so a refusal spends nothing either;
 *   3. **the claim** — the only step that writes, and it is one transaction.
 *
 * Everything before step 3 is reversible. Step 3 is not: option (b) of the story
 * puts the token in two nullable columns on the one `INVITED` row, so once it is
 * spent there is no recovery path by design. A refusal that happens after step 3
 * has begun is not a refusal, it is a lockout.
 */

const AT = instant('2026-10-03T12:00:00.000Z');
const TOKEN = 'the-one-time-setup-token';
const STRONG = 'a-sufficiently-long-password';
const USER_ID = 'user-1';

/** The library's floor: 8 KiB, one pass, one lane. See `sign-in-with-password.spec.ts`. */
const CHEAP: PasswordHashParameters = Object.freeze({
  memoryCost: 8,
  timeCost: 1,
  parallelism: 1,
});

/**
 * An in-memory `IBootstrapClaimRepository`.
 *
 * It records what it was asked to write and whether the claim was granted. It does
 * NOT model atomicity, because it cannot: that is a database property and it is
 * proved against real PostgreSQL in
 * `prisma-bootstrap-claim-repository.integration.spec.ts`. What this double is for
 * is the use-case's own ordering and its refusal paths.
 */
class FakeBootstrapClaimRepository implements IBootstrapClaimRepository {
  readonly calls: Array<{
    setupTokenPlaintext: string;
    credential: BootstrapCredential;
    now: Date;
    identity: BootstrapIdentity | undefined;
  }> = [];
  /** Make the claim report the loss of a race. */
  private refuse = false;

  loseTheRace(): void {
    this.refuse = true;
  }

  async claim(params: {
    setupTokenPlaintext: string;
    credential: BootstrapCredential;
    now: Date;
    identity?: BootstrapIdentity;
  }): Promise<BootstrapClaimOutcome> {
    this.calls.push({
      setupTokenPlaintext: params.setupTokenPlaintext,
      credential: params.credential,
      now: params.now,
      identity: params.identity,
    });

    if (this.refuse) {
      this.refuse = false;
      return { claimed: false };
    }
    return { claimed: true, userId: USER_ID };
  }
}

interface Harness {
  readonly useCase: CompleteFirstAdministratorSetup;
  readonly claims: FakeBootstrapClaimRepository;
  readonly tokens: FakeSetupTokenRepository;
  readonly hasher: RecordingPasswordHasher;
}

function harness(options?: { deployment?: SetupTokenDeploymentState }): Harness {
  const clock = new FakeClock(AT);
  const hasher = new RecordingPasswordHasher(
    new Argon2PasswordHasher({ currentParameters: CHEAP }),
  );
  const claims = new FakeBootstrapClaimRepository();
  const tokens = new FakeSetupTokenRepository({
    userId: USER_ID,
    setupTokenPlaintext: TOKEN,
    // Explicit, because the double otherwise derives its expiry from the WALL clock
    // while this use-case reads `AT` from a `FakeClock`. `AT` is later today than
    // the moment this suite runs, so a wall-clock-derived expiry would be in the
    // past relative to the clock under test and every "valid token" row here would
    // be asserting an expiry.
    expiresAt: instantAfter(3_600_000, AT),
    ...(options?.deployment !== undefined ? { deployment: options.deployment } : {}),
  });

  return {
    claims,
    tokens,
    hasher,
    useCase: new CompleteFirstAdministratorSetup({
      claims,
      tokens: new SetupTokenService(tokens, clock),
      hasher,
      clock,
      policy: DEFAULT_PASSWORD_POLICY,
      hashParameters: CHEAP,
    }),
  };
}

let world: Harness;

beforeEach(() => {
  world = harness();
});

describe('a valid token and a compliant password', () => {
  it('claims the bootstrap and reports which account', async () => {
    const result = await world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG });

    expect(result).toEqual({ userId: USER_ID });
  });

  it('writes a real argon2id digest, never the plaintext', async () => {
    await world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG });

    const [call] = world.claims.calls;
    expect(call?.credential.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(call?.credential.passwordHash).not.toContain(STRONG);
    expect(call?.credential.passwordAlgorithm).toBe('argon2id');
  });

  it('stamps the credential with the injected clock, not the wall clock', async () => {
    await world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG });

    expect(world.claims.calls[0]?.credential.now.getTime()).toBe(AT.getTime());
    expect(world.claims.calls[0]?.now.getTime()).toBe(AT.getTime());
  });

  it('passes the identity through only when the caller supplied one', async () => {
    await world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG });
    expect(world.claims.calls[0]?.identity).toBeUndefined();

    const withIdentity = harness();
    await withIdentity.useCase.complete({
      setupTokenPlaintext: TOKEN,
      password: STRONG,
      identity: { email: 'principal@school.test' },
    });
    expect(withIdentity.claims.calls[0]?.identity).toEqual({ email: 'principal@school.test' });
  });

  it('verifies the token BEFORE spending it, so a refusal is cheap and free', async () => {
    await world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG });

    // The repository records every `inspect`; `consume` is on the OTHER port and
    // is deliberately never called by this use-case — the atomic claim does both.
    expect(world.tokens.consumeCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The acceptance criterion: "Given a password that fails the password policy,
// then the token is NOT consumed, so a rejected attempt does not burn the school's
// only way in."
// ═══════════════════════════════════════════════════════════════════════════
describe('a password the policy refuses', () => {
  it('does not spend the token', async () => {
    await expect(
      world.useCase.complete({ setupTokenPlaintext: TOKEN, password: 'short' }),
    ).rejects.toThrow(PasswordRefusedError);

    expect(world.claims.calls).toHaveLength(0);
  });

  it('never even hashes it, so a refusal costs no argon2 time', async () => {
    await expect(
      world.useCase.complete({ setupTokenPlaintext: TOKEN, password: 'short' }),
    ).rejects.toThrow(PasswordRefusedError);

    expect(world.hasher.hashCalls).toHaveLength(0);
  });

  it('carries the reason and nothing about the password', async () => {
    const failure = await world.useCase
      .complete({ setupTokenPlaintext: TOKEN, password: 'hunter2' })
      .catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(PasswordRefusedError);
    expect((failure as PasswordRefusedError).refusal).toBe('too-short');
    expect((failure as PasswordRefusedError).message).not.toContain('hunter2');
  });

  it('leaves a token that still works', async () => {
    await expect(
      world.useCase.complete({ setupTokenPlaintext: TOKEN, password: 'short' }),
    ).rejects.toThrow(PasswordRefusedError);

    // The end-to-end property: a rejected attempt does not burn the school's only
    // way in, so a principal who mistypes their new password can simply try again.
    expect(await world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG })).toEqual({
      userId: USER_ID,
    });
  });

  it('is decided BEFORE the token is looked at, so it cannot be used to probe one', async () => {
    // Ordering, asserted rather than described. The policy is not a secret; the
    // token's existence is. Checking the cheap, non-revealing thing first means a
    // short password gets the same refusal whatever token accompanied it.
    await expect(
      world.useCase.complete({ setupTokenPlaintext: 'forged', password: 'short' }),
    ).rejects.toThrow(PasswordRefusedError);

    expect(world.tokens.inspectCalls).toHaveLength(0);
  });
});

describe('the three token refusals', () => {
  it('an unenrolled deployment throws the 404-shaped error', async () => {
    const unenrolled = harness({ deployment: 'no-token-issued' });

    await expect(
      unenrolled.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG }),
    ).rejects.toThrow(SetupUnenrolledError);
    expect(unenrolled.claims.calls).toHaveLength(0);
  });

  it('an expired token throws the 400-shaped error', async () => {
    const clock = new FakeClock(AT);
    const claims = new FakeBootstrapClaimRepository();
    const useCase = new CompleteFirstAdministratorSetup({
      claims,
      tokens: new SetupTokenService(
        // One millisecond in the past. The boundary itself is proved in
        // `setup-token.spec.ts` and against the database in
        // `prisma-setup-token-repository.integration.spec.ts`; this row only needs
        // an expired token to reach the use-case.
        new FakeSetupTokenRepository({
          userId: USER_ID,
          setupTokenPlaintext: TOKEN,
          expiresAt: minutesAgo(0.001, AT),
        }),
        clock,
      ),
      hasher: new RecordingPasswordHasher(new Argon2PasswordHasher({ currentParameters: CHEAP })),
      clock,
      policy: DEFAULT_PASSWORD_POLICY,
      hashParameters: CHEAP,
    });

    await expect(
      useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG }),
    ).rejects.toThrow(SetupTokenInvalidError);
    expect(claims.calls).toHaveLength(0);
  });

  it('a FORGED token throws the SAME error class as an expired one', async () => {
    // D58: non-revelation is scoped WITHIN an enrolled deployment, where forged
    // and expired must be indistinguishable. Same class, and the controller maps
    // one class to one status, so the statuses match too.
    await expect(
      world.useCase.complete({ setupTokenPlaintext: 'a-token-nobody-issued', password: STRONG }),
    ).rejects.toThrow(SetupTokenInvalidError);
  });

  it('a token already claimed throws the 409-shaped error', async () => {
    const claimed = harness({ deployment: 'bootstrap-claimed' });

    await expect(
      claimed.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG }),
    ).rejects.toThrow(SetupAlreadyClaimedError);
    expect(claimed.claims.calls).toHaveLength(0);
  });

  it('losing the race throws the same error as finding it already claimed', async () => {
    // Both are "too late", and the loser cannot tell which it was. Telling them
    // apart would tell a second concurrent claimant that a token existed.
    world.claims.loseTheRace();

    await expect(
      world.useCase.complete({ setupTokenPlaintext: TOKEN, password: STRONG }),
    ).rejects.toThrow(SetupAlreadyClaimedError);
  });

  it('every token refusal leaves the token columns exactly as they were', async () => {
    // Only the atomic claim writes. Nothing else in this use-case can spend it.
    await expect(
      world.useCase.complete({ setupTokenPlaintext: 'forged', password: STRONG }),
    ).rejects.toThrow(SetupTokenInvalidError);
    await expect(
      world.useCase.complete({ setupTokenPlaintext: TOKEN, password: 'short' }),
    ).rejects.toThrow(PasswordRefusedError);

    expect(world.tokens.storedHash()).not.toBeNull();
  });
});

describe('the error messages', () => {
  it.each([
    {
      label: 'a forged token',
      run: (w: Harness) => w.useCase.complete({ setupTokenPlaintext: 'forged', password: STRONG }),
      token: 'forged',
    },
    {
      label: 'a short password',
      run: (w: Harness) => w.useCase.complete({ setupTokenPlaintext: TOKEN, password: 'short' }),
      token: TOKEN,
    },
  ])('never echo the token, for $label', async ({ run, token }) => {
    const failure = await run(world).catch((cause: unknown) => cause);

    expect((failure as Error).message).not.toContain(token);
  });

  it('never echo the password, for any refusal', async () => {
    const secret = 'correct-horse-battery-staple';
    const failure = await world.useCase
      .complete({ setupTokenPlaintext: TOKEN, password: 'ab' })
      .catch((cause: unknown) => cause);

    expect((failure as Error).message).not.toContain('ab');
    expect((failure as Error).stack ?? '').not.toContain(secret);
  });

  it('carry no credential, so a log line about them is safe', async () => {
    const failure = (await world.useCase
      .complete({ setupTokenPlaintext: TOKEN, password: 'ab' })
      .catch((cause: unknown) => cause)) as Error;

    // The only own properties are the refusal code and `Error.name`. Both are
    // fixed strings, so serialising the error — which is what a logger does —
    // cannot carry the password out.
    expect(Object.keys(failure).sort()).toEqual(['name', 'refusal']);
    expect(JSON.stringify({ ...failure })).not.toContain('ab');
    expect(JSON.stringify({ ...failure })).not.toContain(TOKEN);
  });
});
