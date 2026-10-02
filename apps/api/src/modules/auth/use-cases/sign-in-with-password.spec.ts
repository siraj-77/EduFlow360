import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeSessionRepository } from '../../../testing/fake-session-repository.js';
import { FakeUserCredentialRepository } from '../../../testing/fake-user-credential-repository.js';
import { instant } from '../../../testing/instant.js';
import { RecordingPasswordHasher } from '../../../testing/recording-password-hasher.js';
import { Argon2PasswordHasher } from '../infrastructure/adapters/argon2-password-hasher.js';
import type { PasswordHashParameters } from '../domain/ports/password-hasher.js';
import { SignInWithPassword } from './sign-in-with-password.js';

/**
 * Password sign-in, and above all the user-enumeration argument.
 *
 * ## The trap this file is written around
 *
 * The obvious way to stop "no such user" from being faster than "wrong password"
 * is to skip the password check when no account matches. **That makes the missing
 * user faster, which is itself the oracle.** argon2id is deliberately expensive
 * — tens of milliseconds and tens of megabytes — so a route that verifies a real
 * user's hash and returns immediately for a fake one is a perfect account-existence
 * oracle, and it is faster than any lockout or rate limit can compensate.
 *
 * So the mitigation is the usual one: when no account matches, verify the
 * password against a FIXED dummy hash produced at the same cost parameters. Every
 * request then performs exactly one argon2id verification, whatever it is checking.
 *
 * ## What is asserted deterministically, and what is only corroborated
 *
 * **Deterministic** (this file): `hasher.verify` was called exactly once, on both
 * paths, and against the dummy hash when no account matched. That is the
 * mitigation, stated as a fact rather than as a distribution.
 *
 * **Corroboration** (`login-over-http.integration.spec.ts`): real wall-clock times
 * over a socket, with a coarse band. Timing bands are inherently probabilistic;
 * they are included because a real measurement catches something a counter cannot
 * — a code path somewhere that does expensive work on one branch and not the other
 * — but they are not the primary evidence and are not claimed to be.
 */

const AT = instant('2026-10-03T11:00:00.000Z');
const ONE_HOUR = 3_600_000;
const FOURTEEN_DAYS = 1_209_600_000;

/**
 * The library's own floor: 8 KiB, one pass, one lane.
 *
 * Deliberately the cheapest argon2 will accept. These tests are about how many
 * verifications happen and against what, not about how long one takes, and a dozen
 * verifications at 19 MiB would dominate the suite's runtime.
 */
const CHEAP: PasswordHashParameters = Object.freeze({
  memoryCost: 8,
  timeCost: 1,
  parallelism: 1,
});

const PRINCIPAL = 'principal@school.test';
const CORRECT = 'a-sufficiently-long-password';
const WRONG = 'a-different-long-password';

/** A real argon2id hasher over a recording wrapper, at the cheap parameters. */
function instrumentedHasher(
  currentParameters: PasswordHashParameters = CHEAP,
): RecordingPasswordHasher {
  return new RecordingPasswordHasher(new Argon2PasswordHasher({ currentParameters }));
}

/**
 * A dummy digest: a real argon2id hash of a value nobody knows, at the same cost
 * parameters the deployment uses. Verification against it therefore costs the same
 * as verification against a real credential and can never succeed.
 */
async function dummyHash(): Promise<string> {
  const hasher = new Argon2PasswordHasher({ currentParameters: CHEAP });
  const hashed = await hasher.hash('a-value-nobody-knows-and-nobody-can-guess', CHEAP);
  return hashed.hash;
}

interface Harness {
  readonly useCase: SignInWithPassword;
  readonly users: FakeUserCredentialRepository;
  readonly hasher: RecordingPasswordHasher;
  readonly sessions: FakeSessionRepository;
  readonly clock: FakeClock;
}

async function harness(options?: {
  withAccount?: boolean;
  /** The adapter's notion of "current", which is what `needsRehash` compares to. */
  currentParameters?: PasswordHashParameters;
  /** The cost the seeded stored digest was actually written at. */
  storedParameters?: PasswordHashParameters;
}): Promise<Harness> {
  const clock = new FakeClock(AT);
  // A rehash is asked for when the STORED digest is weaker than `current`, so the
  // fixture needs both, not one number used twice. `CHEAP` is both by default,
  // which is why the rehash rows override one of them.
  const current = options?.currentParameters ?? CHEAP;
  const stored = options?.storedParameters ?? current;

  const hasher = instrumentedHasher(current);
  const users = new FakeUserCredentialRepository(
    options?.withAccount === false ? { record: null } : { record: {} },
  );
  const sessions = new FakeSessionRepository({ now: AT });

  if (options?.withAccount !== false) {
    // A real hash, so `CORRECT` actually verifies. Written through the real
    // hasher rather than pasted in, so the fixture cannot drift from the format.
    const hashed = await hasher.hash(CORRECT, stored);
    users.setRecord({
      userId: 'user-1',
      passwordHash: hashed.hash,
      passwordAlgorithm: hashed.algorithm,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  const useCase = new SignInWithPassword({
    users,
    hasher,
    sessions,
    clock,
    dummyHash: await dummyHash(),
    hashParameters: current,
    sessionTtlMs: ONE_HOUR,
    refreshTtlMs: FOURTEEN_DAYS,
    lockout: { maxAttempts: 5, lockoutMs: 600_000 },
  });

  return { useCase, users, hasher, sessions, clock };
}

let world: Harness;

beforeEach(async () => {
  world = await harness();
});

describe('a correct password', () => {
  it('signs the user in and issues a session', async () => {
    const outcome = await world.useCase.signIn({
      identifier: PRINCIPAL,
      password: CORRECT,
    });

    expect(outcome.outcome).toBe('signed-in');
    expect(outcome.outcome === 'signed-in' && outcome.session.sessionTokenPlaintext).toBeTruthy();
    expect(world.sessions.issueCalls).toHaveLength(1);
  });

  it('issues the session with the account id, not the identifier that was typed', async () => {
    const outcome = await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(outcome.outcome === 'signed-in' && outcome.session.userId).toBe('user-1');
    expect(world.sessions.issueCalls[0]?.actor.userId).toBe('user-1');
  });

  it("passes the caller's lifetimes through to the repository unchanged", async () => {
    await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(world.sessions.issueCalls[0]).toMatchObject({
      sessionTtlMs: ONE_HOUR,
      refreshTtlMs: FOURTEEN_DAYS,
    });
  });

  it('records the sign-in, clearing the failure counter', async () => {
    await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(world.users.successfulSignIns).toEqual([{ userId: 'user-1', now: AT }]);
    expect(world.users.current()?.failedLoginAttempts).toBe(0);
  });

  it('records the device when one is offered, so a session can be named later', async () => {
    await world.useCase.signIn({
      identifier: PRINCIPAL,
      password: CORRECT,
      device: { deviceLabel: 'staff laptop', ipAddress: '203.0.113.9' },
    });

    expect(world.sessions.issueCalls[0]?.actor).toMatchObject({
      deviceLabel: 'staff laptop',
      ipAddress: '203.0.113.9',
    });
  });

  it('omits device fields entirely when none are offered', async () => {
    // `exactOptionalPropertyTypes` is on: `undefined` is not the same as absent,
    // and `PrismaSessionRepository` would reject the former.
    await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    const actor = world.sessions.issueCalls[0]?.actor;
    expect(actor).not.toHaveProperty('deviceLabel');
    expect(actor).not.toHaveProperty('ipAddress');
    expect(actor).not.toHaveProperty('userAgent');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE enumeration requirement. `PLT-101`'s acceptance criterion: "Given invalid
// credentials, login returns 401 without leaking whether email or password was
// wrong", and the prompt pack adds "user-enumeration test".
// ═══════════════════════════════════════════════════════════════════════════
describe('a missing account and a wrong password', () => {
  let withAccount: Harness;
  let withoutAccount: Harness;

  beforeEach(async () => {
    withAccount = await harness();
    withoutAccount = await harness({ withAccount: false });
  });

  it('are refused the same way', async () => {
    const wrong = await withAccount.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    const missing = await withoutAccount.useCase.signIn({
      identifier: 'nobody@school.test',
      password: WRONG,
    });

    expect(wrong).toEqual({ outcome: 'rejected' });
    expect(missing).toEqual({ outcome: 'rejected' });
    // And the same SHAPE, so a controller cannot branch on one and not the other.
    expect(Object.keys(missing)).toEqual(Object.keys(wrong));
  });

  it.each([
    { label: 'a wrong password', identifier: PRINCIPAL },
    { label: 'an identifier no account carries', identifier: 'nobody@school.test' },
  ])('perform exactly ONE argon2 verification for $label', async ({ identifier }) => {
    // THE mitigation, asserted as a fact rather than as a timing distribution.
    // Without it the missing-account path is tens of milliseconds faster, which is
    // a better enumeration oracle than any error message.
    const world = identifier === PRINCIPAL ? withAccount : withoutAccount;

    await world.useCase.signIn({ identifier, password: WRONG });

    expect(world.hasher.verifyCount).toBe(1);
  });

  it('verifies a missing account against the DUMMY hash, never against a real one', async () => {
    await withoutAccount.useCase.signIn({
      identifier: 'nobody@school.test',
      password: WRONG,
    });

    const [verified] = withoutAccount.hasher.verifiedHashes();
    expect(verified).toBeTruthy();
    expect(verified).not.toBe(withoutAccount.users.current()?.passwordHash ?? 'unreachable');
    expect(verified?.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a real account against its OWN stored hash', async () => {
    // The counterpart, so the previous row is not satisfied by verifying the dummy
    // in both cases — which would be a different defect.
    await withAccount.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(withAccount.hasher.verifiedHashes()).toEqual([
      withAccount.users.current()?.passwordHash ?? 'unreachable',
    ]);
  });

  it('both count a failure, so the database cost is the same too', async () => {
    await withAccount.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    await withoutAccount.useCase.signIn({ identifier: 'nobody@school.test', password: WRONG });

    expect(withAccount.users.failureCountingCalls).toHaveLength(1);
    // The double records the call even when it matches nothing. The real
    // repository's equivalent guarantee — same UPDATE, same SELECT either way — is
    // asserted in `prisma-user-credential-repository.integration.spec.ts`.
    expect(withoutAccount.users.failureCountingCalls).toHaveLength(1);
  });

  it('the wrong-password attempt raises the counter; the missing one has nothing to raise', async () => {
    // A stated asymmetry, not a leak: a counter needs a row to live on. What must
    // not differ is the RESPONSE, and it does not — see the first row.
    await withAccount.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });

    expect(withAccount.users.current()?.failedLoginAttempts).toBe(1);
  });

  it('never leaks the stored algorithm on a failure', async () => {
    // `IPasswordHasher`'s own contract: a failed verification returns nothing that
    // names the algorithm, so a wrong password cannot probe which one a hash used.
    const wrong = await withAccount.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    const missing = await withoutAccount.useCase.signIn({
      identifier: 'nobody@school.test',
      password: WRONG,
    });

    expect(JSON.stringify(wrong)).not.toContain('argon2');
    expect(JSON.stringify(missing)).not.toContain('argon2');
  });
});

describe('an account that cannot sign in', () => {
  it('refuses a SUSPENDED account without counting a failure against it', async () => {
    // A suspension must not be turned into a denial of service: an outsider who
    // knows the username must not be able to lock a suspended employee out of
    // their own record by guessing at their password.
    const suspended = await harness();
    const record = suspended.users.current();
    suspended.users.setRecord(record === null ? null : { ...record, status: 'SUSPENDED' });

    const outcome = await suspended.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(outcome).toEqual({ outcome: 'rejected' });
    expect(suspended.sessions.issueCalls).toHaveLength(0);
    expect(suspended.users.failureCountingCalls).toHaveLength(0);
  });

  it('still verifies the password exactly once, so suspension is not a timing oracle', async () => {
    const suspended = await harness();
    const record = suspended.users.current();
    suspended.users.setRecord(record === null ? null : { ...record, status: 'SUSPENDED' });

    await suspended.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(suspended.hasher.verifyCount).toBe(1);
  });

  it('refuses an INVITED account, whose password is the one being set up', async () => {
    // The bootstrap administrator is `INVITED` until `PLT-107` runs. If `INVITED`
    // could sign in, the setup route would be bypassable by guessing a password
    // nobody has chosen yet.
    const invited = await harness();
    const record = invited.users.current();
    invited.users.setRecord(record === null ? null : { ...record, status: 'INVITED' });

    expect(await invited.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT })).toEqual({
      outcome: 'rejected',
    });
  });
});

describe('the account lockout', () => {
  it('locks on the FIFTH failure, not before and not after', async () => {
    // Five and ten minutes are the numbers the corpus states — see `env.ts`.
    // The whole sequence is asserted in one row because the boundary is the
    // behaviour: a threshold of six would be equally secure-looking and equally
    // wrong against the specification.
    const outcomes: string[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const outcome = await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
      outcomes.push(outcome.outcome);
    }

    expect(outcomes).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'locked']);
  });

  it('reports the lock with the instant it expires', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    }
    const firstLock = await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });
    expect(firstLock.outcome === 'locked' && firstLock.lockedUntil.getTime()).toBe(
      AT.getTime() + 600_000,
    );

    // Past the expiry. The counter was reset to zero when the lock was applied, so
    // it takes another five failures to lock again — and the new lock is measured
    // from the attempt that crossed the line, not from the first of the five.
    world.clock.advance(600_001);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG })).toEqual({
        outcome: 'rejected',
      });
    }
    const relocked = await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });

    expect(relocked.outcome).toBe('locked');
    expect(relocked.outcome === 'locked' && relocked.lockedUntil.getTime()).toBe(
      world.clock.now().getTime() + 600_000,
    );
  });

  it('refuses a locked account EVEN WITH THE CORRECT PASSWORD', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    }

    const outcome = await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(outcome.outcome).toBe('locked');
    expect(world.sessions.issueCalls).toHaveLength(0);
  });

  it('verifies the password before reporting the lock, so the two cost the same', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    }
    const verificationsBefore = world.hasher.verifyCount;

    await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(world.hasher.verifyCount).toBe(verificationsBefore + 1);
  });

  it('accepts the correct password again once the lock has expired', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });
    }
    world.clock.advance(600_001);

    expect(await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT })).toMatchObject({
      outcome: 'signed-in',
    });
  });

  it('never locks an identifier that matches no account', async () => {
    // Otherwise the lockout becomes the enumeration oracle it was meant to
    // accompany: hammer a fake address five times and get 429; hammer a real one
    // and get 429 too — but only the real one was ever counted.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(
        await world.useCase.signIn({ identifier: 'ghost@school.test', password: WRONG }),
      ).toEqual({ outcome: 'rejected' });
    }
  });
});

describe('verify-and-rehash (ADR-007)', () => {
  it('does not rewrite a hash that is already at current parameters', async () => {
    await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(world.users.replacements).toHaveLength(0);
  });

  it('upgrades a hash written at weaker parameters, on a SUCCESSFUL sign-in only', async () => {
    // The stored digest is at the library's floor (8 KiB, one pass); the adapter's
    // notion of "current" is twice the memory and twice the passes. `ADR-007`'s
    // one-directional comparison therefore reports `needsRehash`.
    const stronger: PasswordHashParameters = { memoryCost: 16, timeCost: 2, parallelism: 1 };
    const world2 = await harness({ currentParameters: stronger, storedParameters: CHEAP });

    const outcome = await world2.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(outcome.outcome).toBe('signed-in');
    expect(world2.users.replacements).toHaveLength(1);
    expect(world2.users.replacements[0]?.userId).toBe('user-1');
  });

  it('writes the upgraded digest at the CURRENT parameters, not the old ones', async () => {
    const stronger: PasswordHashParameters = { memoryCost: 16, timeCost: 2, parallelism: 1 };
    const world2 = await harness({ currentParameters: stronger, storedParameters: CHEAP });

    await world2.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    // Read back through the port. Asserting the parameters the new digest was
    // hashed AT is stronger than asserting the call happened: a rehash at the old
    // parameters would leave the deployment exactly as weak while looking like a
    // migration. Each key is matched on its own because the PHC encoder orders the
    // parameter segment as `m`, `p`, `t` — not the order the options were given in,
    // and not an order this test should be asserting.
    const upgraded = world2.users.current()?.passwordHash ?? '';
    expect(upgraded).toContain('m=16');
    expect(upgraded).toContain('t=2');
    expect(upgraded).toContain('p=1');
    // And not the parameters the weaker digest was written at.
    expect(upgraded).not.toContain('m=8');
  });

  it('never rewrites on a FAILED sign-in, which would lock the owner out', async () => {
    const stronger: PasswordHashParameters = { memoryCost: 16, timeCost: 2, parallelism: 1 };
    const world2 = await harness({ currentParameters: stronger, storedParameters: CHEAP });

    await world2.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });

    expect(world2.users.replacements).toHaveLength(0);
  });

  it('still signs the user in when the rehash write fails, and says so loudly', async () => {
    // The one deliberate `catch` in the use-case. The password was proved, so a
    // failed opportunistic upgrade must not deny a legitimate sign-in — and the
    // failure must be loud rather than swallowed.
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const stronger: PasswordHashParameters = { memoryCost: 16, timeCost: 2, parallelism: 1 };
      const world2 = await harness({ currentParameters: stronger, storedParameters: CHEAP });
      world2.users.replaceCredential = () => Promise.reject(new Error('the write failed'));

      const outcome = await world2.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

      expect(outcome.outcome).toBe('signed-in');
      expect(warned).toHaveBeenCalledWith(expect.stringContaining('could not rewrite'));
    } finally {
      warned.mockRestore();
    }
  });
});

describe('what a refusal carries', () => {
  it('never echoes the identifier or the password', async () => {
    // `AGENTS.md` 2.13. Whoever logs a refusal must have nothing to log.
    const refused = await world.useCase.signIn({ identifier: PRINCIPAL, password: WRONG });

    expect(JSON.stringify(refused)).not.toContain(PRINCIPAL);
    expect(JSON.stringify(refused)).not.toContain(WRONG);
  });

  it('and a sign-in carries no password either', async () => {
    const outcome = await world.useCase.signIn({ identifier: PRINCIPAL, password: CORRECT });

    expect(JSON.stringify(outcome)).not.toContain(CORRECT);
  });
});
