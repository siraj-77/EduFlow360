import { HttpException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeSessionRepository } from '../../../testing/fake-session-repository.js';
import { FakeUserCredentialRepository } from '../../../testing/fake-user-credential-repository.js';
import { instant } from '../../../testing/instant.js';
import { RecordingPasswordHasher } from '../../../testing/recording-password-hasher.js';
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
import type { CookieWritingResponse } from '../domain/ports/session-cookie.js';
import type { PasswordHashParameters } from '../domain/ports/password-hasher.js';
import { Argon2PasswordHasher } from '../infrastructure/adapters/argon2-password-hasher.js';
import { SessionCookieAdapter } from '../infrastructure/adapters/session-cookie.js';
import { SignInWithPassword } from '../use-cases/sign-in-with-password.js';
import { PasswordSignInController } from './password-sign-in.controller.js';

/**
 * `POST /auth/login` — the parts a socket test cannot isolate.
 *
 * ## What is NOT the evidence
 *
 * `login-over-http.integration.spec.ts` boots the real application and reads the real
 * `Set-Cookie`. That file is the evidence that the cookie is `HttpOnly`, `Secure` and
 * `SameSite=Lax` **after Express has serialised it** — which a recorder asserting our
 * own option object cannot show, and which is the whole security claim of the route.
 *
 * ## What this file is for
 *
 * Three things, each cheaper here than over a socket:
 *
 *   1. **the cookie is issued with the session's REMAINING lifetime**, not the
 *      configured window. Provoking a mismatch over HTTP needs a clock that disagrees
 *      with the repository's, and a disagreement is precisely the defect.
 *   2. **`Retry-After` is present and rounded up** on both 429 paths.
 *   3. **the refusal bodies are byte-identical** for every cause, which is asserted on
 *      the serialised body rather than on a status code.
 */

const AT = instant('2026-10-03T14:00:00.000Z');
const ONE_HOUR = 3_600_000;
const FOURTEEN_DAYS = 1_209_600_000;
const PRINCIPAL = 'principal@school.test';
const CORRECT = 'a-sufficiently-long-password';
const WRONG = 'a-different-long-password';

const CHEAP: PasswordHashParameters = Object.freeze({
  memoryCost: 8,
  timeCost: 1,
  parallelism: 1,
});

const THROTTLE_POLICY = { limit: 10, windowMs: 60_000 };
const REQUEST = Object.freeze({ ip: '203.0.113.7', headers: { 'user-agent': 'vitest' } });

/**
 * A response that records cookies and headers.
 *
 * Structural, and exactly the three methods the controller declares, so it satisfies
 * the interface without an `any` and without importing Express.
 */
class RecordingResponse {
  readonly cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  readonly headers = new Map<string, string>();

  cookie(name: string, value: string, options: Record<string, unknown>): this {
    this.cookies.push({ name, value, options });
    return this;
  }

  clearCookie(name: string, options: Record<string, unknown>): this {
    this.cookies.push({ name, value: '', options });
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }
}

interface Harness {
  readonly controller: PasswordSignInController;
  readonly users: FakeUserCredentialRepository;
  readonly sessions: FakeSessionRepository;
  readonly hasher: RecordingPasswordHasher;
  readonly clock: FakeClock;
}

async function harness(options?: { throttlePolicy?: typeof THROTTLE_POLICY }): Promise<Harness> {
  const clock = new FakeClock(AT);
  const hasher = new RecordingPasswordHasher(
    new Argon2PasswordHasher({ currentParameters: CHEAP }),
  );
  const users = new FakeUserCredentialRepository({ record: {} });
  const hashed = await hasher.hash(CORRECT, CHEAP);
  users.setRecord({
    userId: 'user-1',
    passwordHash: hashed.hash,
    passwordAlgorithm: hashed.algorithm,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
  const sessions = new FakeSessionRepository({ now: AT });

  const controller = new PasswordSignInController(
    new SignInWithPassword({
      users,
      hasher,
      sessions,
      clock,
      dummyHash: (await hasher.hash('a-value-nobody-knows-and-nobody-can-guess', CHEAP)).hash,
      hashParameters: CHEAP,
      sessionTtlMs: ONE_HOUR,
      refreshTtlMs: FOURTEEN_DAYS,
      lockout: { maxAttempts: 5, lockoutMs: 600_000 },
    }),
    new SessionCookieAdapter({ clock }),
    // THE SAME `FakeClock` the use-case holds, injected through the `CLOCK` port
    // token. This used to be `new SystemClock()` and the disagreement is not
    // theoretical: the two clocks were fifteen hours apart, so the cookie TTL came
    // out as a large positive number and the test below passed while asserting
    // nothing about a remaining lifetime. A clock seam that cannot be faked at the
    // last point of use is not a seam — see `domain/ports/clock.ts`.
    clock,
    new FixedWindowThrottle(clock),
    options?.throttlePolicy ?? THROTTLE_POLICY,
  );

  return { controller, users, sessions, hasher, clock };
}

let world: Harness;

beforeEach(async () => {
  world = await harness();
});

/** The serialised body Nest will send for a rejection. */
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

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (cause) {
    if (cause instanceof HttpException) return cause.getStatus();
    throw cause;
  }
  throw new Error('expected the call to be rejected, and it resolved');
}

describe('a correct password', () => {
  it('answers 200 and says only that it worked', async () => {
    const response = new RecordingResponse();

    await expect(
      world.controller.login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response),
    ).resolves.toEqual({ signedIn: true });
  });

  it('sets exactly one cookie, and it is the session cookie', async () => {
    const response = new RecordingResponse();

    await world.controller.login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response);

    expect(response.cookies).toHaveLength(1);
    expect(response.cookies[0]?.name).toBe('eduflow_session');
  });

  it("issues it with the session's OWN remaining lifetime, not the configured window", async () => {
    // The session was stamped by `ISessionRepository.issue` from its own reading of
    // the clock. If the cookie were given the full configured TTL it would outlive
    // the row it refers to, and a user who believed they had been signed out would
    // still hold a cookie that looks valid.
    //
    // A fake session repository is used here precisely so the two clocks CAN be made
    // to disagree — that is the defect, and it cannot be provoked over a real socket.
    const response = new RecordingResponse();
    const drifting = new FakeSessionRepository({ now: new Date(AT.getTime() - 3_600_000) });
    const controller = new PasswordSignInController(
      new SignInWithPassword({
        users: world.users,
        hasher: world.hasher,
        sessions: drifting,
        clock: world.clock,
        dummyHash: (await world.hasher.hash('a-value-nobody-knows', CHEAP)).hash,
        hashParameters: CHEAP,
        sessionTtlMs: ONE_HOUR,
        refreshTtlMs: FOURTEEN_DAYS,
        lockout: { maxAttempts: 5, lockoutMs: 600_000 },
      }),
      new SessionCookieAdapter({ clock: world.clock }),
      world.clock,
      new FixedWindowThrottle(world.clock),
      THROTTLE_POLICY,
    );

    // The drifted repository already expired the session an hour ago, so the cookie
    // must carry a TTL of at most zero — and `SessionCookieAdapter` refuses a
    // non-positive TTL rather than writing an unusable cookie.
    await expect(
      controller.login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response),
    ).rejects.toThrow(/ttlMs/);
  });

  it('records the source address and user agent against the session', async () => {
    await world.controller.login(
      { identifier: PRINCIPAL, password: CORRECT },
      REQUEST,
      new RecordingResponse(),
    );

    expect(world.sessions.issueCalls[0]?.actor).toMatchObject({
      ipAddress: '203.0.113.7',
      userAgent: 'vitest',
    });
  });

  it('omits the user agent entirely when the header was sent more than once', async () => {
    // An array means the header appeared twice, which no browser does. Picking one
    // would put a value on a session record that may not be what the client sent;
    // recording none is the honest answer.
    await world.controller.login(
      { identifier: PRINCIPAL, password: CORRECT },
      { ip: '203.0.113.7', headers: { 'user-agent': ['one', 'two'] } },
      new RecordingResponse(),
    );

    const actor = world.sessions.issueCalls[0]?.actor;
    expect(actor).toMatchObject({ ipAddress: '203.0.113.7' });
    expect(actor).not.toHaveProperty('userAgent');
  });
});

describe('every refusal', () => {
  it('a wrong password and an unknown account produce the SAME body', async () => {
    // The enumeration requirement, asserted on the serialised bytes rather than on
    // a status, because a matching status with a differing message is still an
    // oracle.
    const wrong = await bodyOf(() =>
      world.controller.login(
        { identifier: PRINCIPAL, password: WRONG },
        REQUEST,
        new RecordingResponse(),
      ),
    );
    const missing = await bodyOf(() =>
      world.controller.login(
        { identifier: 'ghost@school.test', password: WRONG },
        REQUEST,
        new RecordingResponse(),
      ),
    );

    expect(wrong).toBe(missing);
    expect(JSON.parse(wrong)).toMatchObject({ statusCode: HttpStatus.UNAUTHORIZED });
  });

  it('a suspended account produces that same body too', async () => {
    const record = world.users.current();
    world.users.setRecord(record === null ? null : { ...record, status: 'SUSPENDED' });

    const suspended = await bodyOf(() =>
      world.controller.login(
        { identifier: PRINCIPAL, password: CORRECT },
        REQUEST,
        new RecordingResponse(),
      ),
    );

    expect(JSON.parse(suspended)).toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Those credentials were not accepted.',
    });
  });

  it('never echoes the identifier or the password', async () => {
    const body = await bodyOf(() =>
      world.controller.login(
        { identifier: PRINCIPAL, password: WRONG },
        REQUEST,
        new RecordingResponse(),
      ),
    );

    expect(body).not.toContain(PRINCIPAL);
    expect(body).not.toContain(WRONG);
  });

  it('sets no cookie at all', async () => {
    const response = new RecordingResponse();

    await world.controller
      .login({ identifier: PRINCIPAL, password: WRONG }, REQUEST, response)
      .catch(() => undefined);

    expect(response.cookies).toEqual([]);
  });

  it('a malformed body is a 400, and a different one from the 401', async () => {
    // A 400 says something about the REQUEST, never about an account, so the
    // difference from a 401 leaks nothing.
    expect(
      await statusOf(() =>
        world.controller.login({ identifier: PRINCIPAL }, REQUEST, new RecordingResponse()),
      ),
    ).toBe(HttpStatus.BAD_REQUEST);
  });

  it('a malformed body never echoes the password either', async () => {
    const body = await bodyOf(() =>
      world.controller.login(
        { identifier: PRINCIPAL, password: { nested: WRONG } },
        REQUEST,
        new RecordingResponse(),
      ),
    );

    expect(body).not.toContain(WRONG);
  });
});

describe('429 and Retry-After', () => {
  it('is returned once the source is throttled, with a header the client can act on', async () => {
    const response = new RecordingResponse();
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller
        .login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, new RecordingResponse())
        .catch(() => undefined);
    }

    const status = await statusOf(() =>
      world.controller.login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response),
    );

    expect(status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(response.headers.get('retry-after')).toBeDefined();
  });

  it('rounds Retry-After UP to whole seconds, never to zero', async () => {
    // `Retry-After: 0` tells a client to retry immediately, guarantees another
    // refusal, and burns one of its own remaining attempts.
    const tiny = await harness({ throttlePolicy: { limit: 1, windowMs: 1_500 } });
    const response = new RecordingResponse();

    await tiny.controller
      .login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, new RecordingResponse())
      .catch(() => undefined);
    await tiny.controller
      .login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response)
      .catch(() => undefined);

    expect(Number(response.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });

  it('is returned for a LOCKED account too, so the lock is visible to its own victim', async () => {
    // A lockout answered 401 would be indistinguishable from a wrong password, and
    // the user it exists to protect would keep typing a correct password at a server
    // silently refusing them. See `sign-in-with-password.ts`.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await world.controller
        .login({ identifier: PRINCIPAL, password: WRONG }, REQUEST, new RecordingResponse())
        .catch(() => undefined);
    }
    const response = new RecordingResponse();

    const status = await statusOf(() =>
      world.controller.login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response),
    );

    expect(status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(response.headers.get('retry-after')).toBeDefined();
  });

  it('carries the remaining lockout, not the whole window', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await world.controller
        .login({ identifier: PRINCIPAL, password: WRONG }, REQUEST, new RecordingResponse())
        .catch(() => undefined);
    }
    world.clock.advance(120_000);
    const response = new RecordingResponse();

    await world.controller
      .login({ identifier: PRINCIPAL, password: CORRECT }, REQUEST, response)
      .catch(() => undefined);

    // 600 000 lockout, 120 000 already elapsed.
    expect(response.headers.get('retry-after')).toBe('480');
  });
});

describe('the throttle is consulted before the body is parsed', () => {
  it('so a body that is not even valid still consumes an attempt', async () => {
    for (let attempt = 0; attempt < THROTTLE_POLICY.limit; attempt += 1) {
      await world.controller
        .login({ nonsense: true }, REQUEST, new RecordingResponse())
        .catch(() => undefined);
    }

    expect(
      await statusOf(() =>
        world.controller.login({ nonsense: true }, REQUEST, new RecordingResponse()),
      ),
    ).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});

/** A structural check that the recorder really does satisfy the port. */
const _satisfiesThePort: CookieWritingResponse = new RecordingResponse();
void _satisfiesThePort;
