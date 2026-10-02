import { HttpException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeSetupTokenRepository } from '../../../testing/fake-setup-token-repository.js';
import { instant } from '../../../testing/instant.js';
import { RecordingPasswordHasher } from '../../../testing/recording-password-hasher.js';
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
import type { PasswordHashParameters } from '../domain/ports/password-hasher.js';
import { DEFAULT_PASSWORD_POLICY } from '../domain/services/password-policy.js';
import { Argon2PasswordHasher } from '../infrastructure/adapters/argon2-password-hasher.js';
import { SetupTokenService } from '../use-cases/setup-token-service.js';
import { CompleteFirstAdministratorSetup } from '../use-cases/complete-first-administrator-setup.js';
import { SetupCompletionController } from './setup-completion.controller.js';

/**
 * `POST /auth/setup/complete` — the parts a socket test cannot isolate.
 *
 * ## What this file is NOT, and why it still exists
 *
 * It is not the evidence that the route works. `setup-complete-over-http.integration.spec.ts`
 * boots the real application, makes real requests and reads the real status and body,
 * and that file is the one to read for "does this work".
 *
 * This file covers three things that are cheaper to assert here than to provoke over
 * HTTP:
 *
 *   1. **the ORDER of the throttle relative to body parsing.** Provoking it over a
 *      socket means sending ten thousand valid requests; asserting it here means
 *      reading which call happened first.
 *   2. **the status map.** One typed error, one status, one message — and the pairing
 *      that matters is that an expired token and a forged one produce the same class,
 *      so they produce the same status by construction rather than by two branches
 *      happening to agree.
 *   3. **that a validation failure can only ever name this route's own fields.**
 *      A Zod issue path is derived from the INPUT, so a schema that reported raw
 *      paths would let a caller put arbitrary text into an error response.
 */

const AT = instant('2026-10-03T13:00:00.000Z');
const TOKEN = 'the-one-time-setup-token';
const STRONG = 'a-sufficiently-long-password';

const CHEAP: PasswordHashParameters = Object.freeze({
  memoryCost: 8,
  timeCost: 1,
  parallelism: 1,
});

const THROTTLE_POLICY = { limit: 10, windowMs: 900_000 };
const REQUEST = Object.freeze({ ip: '203.0.113.7' });

function build(options?: {
  deployment?: 'token-issued' | 'no-token-issued' | 'bootstrap-claimed';
}): {
  readonly controller: SetupCompletionController;
  readonly throttle: FixedWindowThrottle;
  readonly clock: FakeClock;
} {
  const clock = new FakeClock(AT);
  const throttle = new FixedWindowThrottle(clock);
  const tokens = new FakeSetupTokenRepository({
    userId: 'user-1',
    setupTokenPlaintext: TOKEN,
    expiresAt: new Date(AT.getTime() + 3_600_000),
    ...(options?.deployment !== undefined ? { deployment: options.deployment } : {}),
  });

  const controller = new SetupCompletionController(
    new CompleteFirstAdministratorSetup({
      // The atomic pair is proved against real PostgreSQL elsewhere; here only its
      // refusal matters, and `FakeSetupTokenRepository` already reports the three
      // deployment states.
      claims: {
        claim: () => Promise.resolve({ claimed: true as const, userId: 'user-1' }),
      },
      tokens: new SetupTokenService(tokens, clock),
      hasher: new RecordingPasswordHasher(new Argon2PasswordHasher({ currentParameters: CHEAP })),
      clock,
      policy: DEFAULT_PASSWORD_POLICY,
      hashParameters: CHEAP,
    }),
    throttle,
    THROTTLE_POLICY,
  );

  return { controller, throttle, clock };
}

let world: ReturnType<typeof build>;

beforeEach(() => {
  world = build();
});

/** The status a rejection carries, extracted without asserting on message text. */
async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (cause) {
    if (cause instanceof HttpException) return cause.getStatus();
    throw cause;
  }
  throw new Error('expected the call to be rejected, and it resolved');
}

/** The body Nest will serialise for a rejection. */
async function bodyOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (cause) {
    if (cause instanceof HttpException) {
      const response = cause.getResponse();
      return typeof response === 'string' ? response : JSON.stringify(response);
    }
    throw cause;
  }
  throw new Error('expected the call to be rejected, and it resolved');
}

const valid = { token: TOKEN, password: STRONG };

describe('the happy path', () => {
  it('answers 200 with the account it claimed', async () => {
    await expect(world.controller.complete(valid, REQUEST)).resolves.toEqual({ userId: 'user-1' });
  });

  it('does not set any cookie, because no session exists yet', async () => {
    // This route creates a CREDENTIAL, not a session. The principal then signs in,
    // and the cookie is set there — so a cookie here would be a second transport
    // invented for one moment.
    const response = await world.controller.complete(valid, REQUEST);

    expect(Object.keys(response)).toEqual(['userId']);
  });
});

describe('the status map', () => {
  it('400 for a password the policy refuses', async () => {
    expect(
      await statusOf(() => world.controller.complete({ token: TOKEN, password: 'short' }, REQUEST)),
    ).toBe(HttpStatus.BAD_REQUEST);
  });

  it('400 for a FORGED token', async () => {
    expect(
      await statusOf(() =>
        world.controller.complete({ token: 'never-issued', password: STRONG }, REQUEST),
      ),
    ).toBe(HttpStatus.BAD_REQUEST);
  });

  it('400 for a body that is not a valid request', async () => {
    expect(await statusOf(() => world.controller.complete({ token: TOKEN }, REQUEST))).toBe(
      HttpStatus.BAD_REQUEST,
    );
  });

  it('404 for an unenrolled deployment', async () => {
    const unenrolled = build({ deployment: 'no-token-issued' });

    expect(await statusOf(() => unenrolled.controller.complete(valid, REQUEST))).toBe(
      HttpStatus.NOT_FOUND,
    );
  });

  it('409 when the one claim is already made', async () => {
    const claimed = build({ deployment: 'bootstrap-claimed' });

    expect(await statusOf(() => claimed.controller.complete(valid, REQUEST))).toBe(
      HttpStatus.CONFLICT,
    );
  });

  it('429 once the source is throttled', async () => {
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller.complete(valid, REQUEST);
    }

    expect(await statusOf(() => world.controller.complete(valid, REQUEST))).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('gives an expired and a forged token the SAME status AND the SAME body', async () => {
    // D58, scoped within an enrolled deployment. Asserted on both halves because a
    // matching status with a differing message is still an oracle.
    const expired = new FakeSetupTokenRepository({
      userId: 'user-1',
      setupTokenPlaintext: TOKEN,
      expiresAt: new Date(AT.getTime() - 1),
    });
    const withExpiredToken = new SetupCompletionController(
      new CompleteFirstAdministratorSetup({
        claims: { claim: () => Promise.resolve({ claimed: true as const, userId: 'user-1' }) },
        tokens: new SetupTokenService(expired, new FakeClock(AT)),
        hasher: new RecordingPasswordHasher(new Argon2PasswordHasher({ currentParameters: CHEAP })),
        clock: new FakeClock(AT),
        policy: DEFAULT_PASSWORD_POLICY,
        hashParameters: CHEAP,
      }),
      new FixedWindowThrottle(new FakeClock(AT)),
      THROTTLE_POLICY,
    );

    const expiredBody = await bodyOf(() => withExpiredToken.complete(valid, REQUEST));
    const forgedBody = await bodyOf(() =>
      world.controller.complete({ token: 'never-issued', password: STRONG }, REQUEST),
    );

    expect(expiredBody).toBe(forgedBody);
  });
});

describe('the throttle', () => {
  it('is consulted BEFORE the body is parsed', async () => {
    // Provoking this over a socket would mean sending ten thousand valid requests.
    // Here it is a matter of which call happened first: a body that is not even a
    // valid request still consumes an attempt.
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller.complete({ nonsense: true }, REQUEST).catch(() => undefined);
    }

    expect(await statusOf(() => world.controller.complete({ nonsense: true }, REQUEST))).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('counts each source separately', async () => {
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller.complete({ nonsense: true }, REQUEST).catch(() => undefined);
    }

    // A different source is unaffected, or one school behind a shared NAT could lock
    // out every other school on the same address.
    await expect(world.controller.complete(valid, { ip: '198.51.100.4' })).resolves.toEqual({
      userId: 'user-1',
    });
  });

  it('falls back to the socket address when Express resolved no `ip`', async () => {
    // A missing address must not collapse every such caller into one shared bucket,
    // which would let one of them lock out all the others.
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller
        .complete({ nonsense: true }, { socket: { remoteAddress: '192.0.2.9' } })
        .catch(() => undefined);
    }

    await expect(world.controller.complete(valid, { ip: '198.51.100.5' })).resolves.toEqual({
      userId: 'user-1',
    });
  });

  it('says the token was NOT spent when it refuses', async () => {
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller.complete(valid, REQUEST);
    }

    const body = await bodyOf(() => world.controller.complete(valid, REQUEST));

    // The throttle is the one refusal a principal can hit by accident — by typing a
    // token slowly — so it must not read as "your token is gone".
    expect(body).toContain('NOT been spent');
  });
});

describe('what a refusal may contain', () => {
  it.each([
    { label: 'a forged token', body: { token: 'never-issued-by-anyone', password: STRONG } },
    { label: 'a weak password', body: { token: TOKEN, password: 'hunter2' } },
    { label: 'a malformed body', body: { nonsense: true } },
    { label: 'a wrong-typed field', body: { token: TOKEN, password: { nested: TOKEN } } },
  ])('never echoes the token or the password, for $label', async ({ body }) => {
    const response = await bodyOf(() => world.controller.complete(body, REQUEST));

    expect(response).not.toContain(TOKEN);
    expect(response).not.toContain(STRONG);
    // The refusal CODE (`too-short`) is a fixed string this route owns and is meant
    // to be readable by the client; the candidate is not. So the assertion is on the
    // candidate, not on the word "short" — which the code legitimately contains.
    expect(response).not.toContain('hunter2');
  });

  it('never echoes an arbitrary key the caller chose', async () => {
    // A Zod issue path is derived from the input, so a schema that reported raw paths
    // would let a caller put any text at all into this response.
    const response = await bodyOf(() =>
      world.controller.complete(
        { token: TOKEN, password: STRONG, 'attacker-chosen-key': 'x' },
        REQUEST,
      ),
    );

    expect(response).not.toContain('attacker-chosen-key');
  });

  it('names the offending field, which is a fixed string this route owns', async () => {
    const response = await bodyOf(() => world.controller.complete({ token: TOKEN }, REQUEST));

    expect(response).toContain('password');
  });
});
