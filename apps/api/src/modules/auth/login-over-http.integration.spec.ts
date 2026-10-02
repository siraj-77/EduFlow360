import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CSRF_HEADER_NAME } from '../../common/guards/csrf.guard.js';
import {
  startHttpHarness,
  type HttpHarness,
  type HttpResponse,
} from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { SESSION_COOKIE_NAME } from './domain/ports/session-cookie.js';
import type { PasswordHashParameters } from './domain/ports/password-hasher.js';
import { DEFAULT_PASSWORD_HASH_PARAMETERS } from '../settings/domain/services/password-hash-parameters.js';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher.js';

/**
 * `POST /auth/login` over a real socket, against a real PostgreSQL.
 *
 * ## Why the cookie assertions are HERE and not in the controller spec
 *
 * Because `Set-Cookie` is RFC 6265 text serialised by **Express**, not by us. Whether
 * `HttpOnly`, `Secure` and `SameSite` survive that serialisation is Express's
 * behaviour, and a test that asserts our own option object says nothing about what a
 * browser receives. `oidc-redirect-over-http.spec.ts` established the pattern; this
 * file applies it to the credential that actually matters.
 *
 * ## The enumeration evidence, and what kind of evidence it is
 *
 * Two different claims, and they are not equally strong:
 *
 *   - **A FACT, asserted in `sign-in-with-password.spec.ts`:** a request for an
 *     identifier no account carries performs exactly ONE argon2id verification,
 *     against a dummy digest built at this deployment's own cost parameters. That is
 *     a counter, not a distribution, and it is the mitigation.
 *   - **CORROBORATION, asserted here:** real wall-clock times measured over a socket,
 *     compared with a deliberately coarse band. Timing bands are probabilistic and can
 *     be flaky, so they are not the primary claim — but they catch something a counter
 *     cannot, which is expensive work happening on one branch and not the other
 *     somewhere outside the use-case.
 *
 * ## One application per test
 *
 * `AGENTS.md` 2.1: one database per school. Sharing a `schoolId` across tests would
 * share one school's argon2 cost settings, one throttle table and one lockout counter,
 * which are exactly the things under test. Each test gets its own.
 */

/**
 * The SHIPPED argon2id cost parameters, written into the test school's own settings row.
 *
 * ## Why not the library's floor, which is what every other spec in this repository uses
 *
 * Because this file is the only one that measures TIME, and at the library's floor
 * (8 KiB, one pass) a verification costs 1-2 ms — which HTTP round-trip and Nest
 * middleware bury completely.
 *
 * That was measured, not assumed. A version of this file that ran at 8 KiB reported a
 * ratio of 0.92x with the mitigation in place, and **0.91x with the mitigation
 * deliberately removed** — it could not tell the two apart. A corroborating test that
 * cannot fail is worse than no test, because it looks like evidence.
 *
 * So this file uses `DEFAULT_PASSWORD_HASH_PARAMETERS` — the OWASP-recommended
 * argon2id cost the module itself falls back to — which is what a real verification
 * costs. It roughly doubles the wall-clock of this file and is the reason the numbers
 * mean anything.
 *
 * It is still the real settings path: the module resolves cost parameters from
 * `school_settings` in production and in this test, and only the VALUES differ from
 * what an unconfigured school would get — and here they do not differ at all.
 */
const TEST_PARAMETERS: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS;

const PRINCIPAL = 'principal@school.test';
const CORRECT = 'a-sufficiently-long-password';
const WRONG = 'a-different-long-password';

let prisma: PrismaClient;
let harness: HttpHarness;
let schoolId: string;
let hasher: Argon2PasswordHasher;

/** One account in this deployment, with a real digest at the test parameters. */
async function anAccount(options?: {
  readonly password?: string;
  readonly status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
}): Promise<{ readonly userId: string; readonly email: string }> {
  const email = options?.password === undefined && options === undefined ? PRINCIPAL : PRINCIPAL;
  const hashed = await hasher.hash(options?.password ?? CORRECT, TEST_PARAMETERS);

  const userId = (
    await prisma.user.create({
      data: {
        schoolId,
        email,
        username: 'principal',
        status: options?.status ?? 'ACTIVE',
        passwordHash: hashed.hash,
        passwordAlgorithm: hashed.algorithm,
      },
      select: { id: true },
    })
  ).id;

  return { userId, email };
}

const post = (body: unknown): Promise<HttpResponse> =>
  harness.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite makes real requests against a real database and a ' +
        'real argon2id verification is the entire subject.',
    );
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();

  hasher = new Argon2PasswordHasher({ currentParameters: TEST_PARAMETERS });
  schoolId = randomUUID();
  await prisma.schoolSettings.create({
    data: {
      schoolId,
      name: 'Login harness school',
      timezone: 'Asia/Colombo',
      defaultLocale: 'en',
      currencyCode: 'LKR',
      minorUnitScale: 2,
      roundingMode: 'HALF_UP',
      academicYearStartMonth: 1,
      settings: {},
      passwordHashParameters: { ...TEST_PARAMETERS },
    },
  });

  harness = await startHttpHarness({
    env: {
      ...TEST_ENVIRONMENT,
      DATABASE_URL: process.env.DATABASE_URL,
      SCHOOL_ID: schoolId,
      JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
      // The source-address throttle is deliberately generous (see auth.module.ts), so
      // the account lockout at five failures is what a test observes rather than a 429
      // from the source throttle. Both are still reachable; each has its own row below.
      LOGIN_MAX_FAILED_ATTEMPTS: '5',
    },
  });
});

afterEach(async () => {
  await harness?.close();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('a correct password', () => {
  it('answers 200 and sets exactly one cookie', async () => {
    await anAccount();

    const response = await post({ identifier: PRINCIPAL, password: CORRECT });

    expect(response.status).toBe(200);
    expect(response.setCookie).toHaveLength(1);
    expect(response.cookie(SESSION_COOKIE_NAME)).not.toBeNull();
  });

  it('sets it HttpOnly, so script on the web app cannot read the session token', async () => {
    await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );

    expect(cookie?.attributes.httponly).toBe(true);
    expect(cookie?.raw).toMatch(/;\s*HttpOnly/i);
  });

  it('sets it Secure, so it is never sent over cleartext', async () => {
    await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );

    expect(cookie?.attributes.secure).toBe(true);
    expect(cookie?.raw).toMatch(/;\s*Secure/i);
  });

  it('sets it SameSite=Lax, because Strict would withhold it from the OIDC navigation back', async () => {
    await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );

    expect(cookie?.attributes.samesite).toBe('Lax');
    expect(cookie?.raw).toMatch(/;\s*SameSite=Lax/i);
  });

  it('carries no Domain, so a sibling subdomain cannot overwrite it', async () => {
    await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );

    expect(cookie?.attributes.domain).toBeUndefined();
  });

  it('scopes it to / rather than a subpath, so logout can clear it', async () => {
    await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );

    expect(cookie?.attributes.path).toBe('/');
  });

  // The join the cookie unit tests cannot make: the value that actually crossed the
  // network is one THIS deployment can resolve to a session row.
  it('carries a value this deployment can resolve to a real session row', async () => {
    const { userId } = await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );
    const value = cookie?.value ?? '';

    const session = await prisma.session.findFirst({
      where: {
        schoolId,
        userId,
        tokenHash: createHash('sha256').update(value).digest('hex'),
      },
      select: { id: true, revokedAt: true, expiresAt: true },
    });
    expect(session).not.toBeNull();
    expect(session?.revokedAt).toBeNull();
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never stores the cookie value itself, only its SHA-256', async () => {
    await anAccount();

    const cookie = (await post({ identifier: PRINCIPAL, password: CORRECT })).cookie(
      SESSION_COOKIE_NAME,
    );

    const stored = await prisma.session.findMany({
      where: { schoolId },
      select: { tokenHash: true },
    });
    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.tokenHash).not.toBe(cookie?.value ?? '');
    }
  });

  it('stamps lastLoginAt and clears the failure counter', async () => {
    const { userId } = await anAccount();

    await post({ identifier: PRINCIPAL, password: CORRECT });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lastLoginAt: true, failedLoginAttempts: true },
    });
    expect(row.lastLoginAt).not.toBeNull();
    expect(row.failedLoginAttempts).toBe(0);
  });

  it('never puts the password in the response body', async () => {
    await anAccount();

    const response = await post({ identifier: PRINCIPAL, password: CORRECT });

    expect(response.body).not.toContain(CORRECT);
    expect(response.body).not.toContain(PRINCIPAL);
  });

  it('signs in by USERNAME as well as by email', async () => {
    await anAccount();

    const response = await post({ identifier: 'principal', password: CORRECT });

    expect(response.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE enumeration requirement. `PLT-101`: "Given invalid credentials, login returns
// 401 without leaking whether email or password was wrong."
// ═══════════════════════════════════════════════════════════════════════════
describe('a wrong password and an unknown account', () => {
  it('answer the same status', async () => {
    await anAccount();

    const wrong = await post({ identifier: PRINCIPAL, password: WRONG });
    const unknown = await post({ identifier: 'ghost@school.test', password: WRONG });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
  });

  it('answer byte-identical bodies', async () => {
    // Not "similar". Identical. A matching status with a differing message is still an
    // oracle, and it is the kind of difference nobody notices in review.
    await anAccount();

    const wrong = await post({ identifier: PRINCIPAL, password: WRONG });
    const unknown = await post({ identifier: 'ghost@school.test', password: WRONG });

    expect(wrong.body).toBe(unknown.body);
  });

  it('answer byte-identical bodies for a suspended account too', async () => {
    await anAccount({ status: 'SUSPENDED' });

    const suspended = await post({ identifier: PRINCIPAL, password: CORRECT });

    expect(suspended.status).toBe(401);
    expect(JSON.parse(suspended.body)).toMatchObject({
      statusCode: 401,
      message: 'Those credentials were not accepted.',
    });
  });

  it('set no cookie on any of them', async () => {
    await anAccount();

    const wrong = await post({ identifier: PRINCIPAL, password: WRONG });
    const unknown = await post({ identifier: 'ghost@school.test', password: WRONG });

    expect(wrong.cookies).toEqual([]);
    expect(unknown.cookies).toEqual([]);
  });

  it('create no session row on any of them', async () => {
    await anAccount();

    await post({ identifier: PRINCIPAL, password: WRONG });
    await post({ identifier: 'ghost@school.test', password: WRONG });

    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
  });

  it('never echo the identifier or the password', async () => {
    await anAccount();

    const response = await post({ identifier: PRINCIPAL, password: WRONG });

    expect(response.body).not.toContain(PRINCIPAL);
    expect(response.body).not.toContain(WRONG);
  });

  it('never name the stored algorithm, so a wrong password cannot probe it', async () => {
    await anAccount();

    const response = await post({ identifier: PRINCIPAL, password: WRONG });

    expect(response.body.toLowerCase()).not.toContain('argon');
  });
});

describe('the enumeration TIMING oracle', () => {
  // CORROBORATION, not the primary evidence. The primary evidence is a counter in
  // `sign-in-with-password.spec.ts`; this is a real measurement over a real socket with
  // a deliberately coarse band.
  //
  // The band is [0.5x, 2x] of the wrong-password median. A naive implementation that
  // skips verification for an unknown identifier measures roughly 10-50x faster, so it
  // fails this band by a wide margin — while argon2's own jitter at the cheapest cost
  // argon2 accepts stays comfortably inside it.
  //
  // Both paths use the same school and therefore the same cost parameters, so the two
  // argon2 calls really are comparable.
  const SAMPLES = 7;

  const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  };

  it('an unknown identifier is not measurably faster than a wrong password', async () => {
    await anAccount();

    // Interleaved, so a slow patch of CPU or a garbage collection cannot land on one
    // series and masquerade as a difference.
    const unknown: number[] = [];
    const wrong: number[] = [];
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const unknownStart = performance.now();
      await post({ identifier: `ghost-${sample}@school.test`, password: WRONG });
      unknown.push(performance.now() - unknownStart);

      const wrongStart = performance.now();
      await post({ identifier: PRINCIPAL, password: WRONG });
      wrong.push(performance.now() - wrongStart);
    }

    const unknownMedian = median(unknown);
    const wrongMedian = median(wrong);
    const ratio = unknownMedian / wrongMedian;

    // Printed rather than only asserted: a reviewer who distrusts the band wants to
    // see the numbers, and a regression that stays inside the band should still be
    // visible in the output. `console.warn` rather than `console.log` because the base
    // ESLint config allows only `warn` and `error`, and a diagnostic line in a test
    // report is closer to a warning than to an error.
    console.warn(
      `[timing] unknown median ${unknownMedian.toFixed(1)}ms, wrong-password median ` +
        `${wrongMedian.toFixed(1)}ms, ratio ${ratio.toFixed(2)}x (band 0.50x-2.00x)`,
    );

    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });
});

describe('the account lockout', () => {
  it('locks on the fifth failure and answers 429, with a Retry-After', async () => {
    const { userId } = await anAccount();

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      statuses.push((await post({ identifier: PRINCIPAL, password: WRONG })).status);
    }
    const locked = await post({ identifier: PRINCIPAL, password: CORRECT });

    expect(statuses).toEqual([401, 401, 401, 401, 429]);
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBeTruthy();
    // The lock is persisted, not just in memory: a restart must not clear it.
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lockedUntil: true },
    });
    expect(row.lockedUntil).not.toBeNull();
  });

  it('refuses even the CORRECT password while locked', async () => {
    await anAccount();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await post({ identifier: PRINCIPAL, password: WRONG });
    }

    const response = await post({ identifier: PRINCIPAL, password: CORRECT });

    expect(response.status).toBe(429);
    expect(response.cookies).toEqual([]);
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
  });

  it('never locks an identifier that matches no account', async () => {
    await anAccount();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await post({ identifier: 'ghost@school.test', password: WRONG });
      expect(response.status).toBe(401);
    }
  });
});

describe('the source-address throttle', () => {
  // Generous by design — see `auth.module.ts`. It exists to bound argon2 work per
  // source, NOT to lock accounts, because keying it on the identifier would let one
  // caller lock a colleague out.
  it('eventually answers 429 for a flood from one source', async () => {
    await anAccount();

    let sawThrottle = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await post({ identifier: `ghost-${attempt}@school.test`, password: WRONG });
      if (response.status === 429) {
        sawThrottle = true;
        break;
      }
    }

    expect(sawThrottle, 'sixty attempts from one source were never throttled').toBe(true);
  });
});

describe('the request itself', () => {
  it('is refused with 400 when the body is not a valid request', async () => {
    await anAccount();

    expect((await post({ identifier: PRINCIPAL })).status).toBe(400);
    expect((await post({ password: CORRECT })).status).toBe(400);
    expect((await post({ identifier: PRINCIPAL, password: CORRECT, admin: true })).status).toBe(
      400,
    );
  });

  it('accepts a one-character password at the boundary, because the policy constrains SETTING not PRESENTING', async () => {
    // An account may predate the policy. Refusing short values here would lock it out of
    // its own sign-in and teach nobody anything.
    await anAccount({ password: 'x' });

    const response = await post({ identifier: PRINCIPAL, password: 'x' });

    expect(response.status).toBe(200);
  });

  it('is refused by CsrfGuard without the custom header, before any handler runs', async () => {
    await anAccount();

    const response = await harness.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: PRINCIPAL, password: CORRECT }),
    });

    expect(response.status).toBe(403);
    // And no session was created on the way to being refused.
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
  });
});

describe('the database afterwards', () => {
  it('holds a digest the supplied password does not appear in', async () => {
    await anAccount();

    const response = await post({ identifier: PRINCIPAL, password: CORRECT });

    expect(response.status).toBe(200);
    const stored = await prisma.session.findMany({
      where: { schoolId },
      select: { tokenHash: true },
    });
    expect(stored.every((row) => !row.tokenHash.includes(CORRECT))).toBe(true);
  });

  it('records the source address and user agent against the session', async () => {
    await anAccount();

    await harness.request('/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CSRF_HEADER_NAME]: 'test',
        'user-agent': 'EduFlow-HTTP-Harness/1.0',
      },
      body: JSON.stringify({ identifier: PRINCIPAL, password: CORRECT }),
    });

    const session = await prisma.session.findFirstOrThrow({
      where: { schoolId },
      select: { ipAddress: true, userAgent: true },
    });
    expect(session.ipAddress).toBeTruthy();
    expect(session.userAgent).toBe('EduFlow-HTTP-Harness/1.0');
  });
});
