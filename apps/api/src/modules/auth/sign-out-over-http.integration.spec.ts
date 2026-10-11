import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { CSRF_HEADER_NAME } from '../../common/guards/csrf.guard.js';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher.js';
import { DEFAULT_PASSWORD_HASH_PARAMETERS } from '../settings/domain/services/password-hash-parameters.js';
import type { PasswordHashParameters } from './domain/ports/password-hasher.js';

/**
 * `POST /auth/sign-out` over a real socket.
 *
 * ## Why this route exists at all
 *
 * A sign-in with no sign-out is a trap: the interim authenticated landing the
 * auth-screens work needs (a place to land after login while the app shell is
 * unbuilt) must be able to END a session, or the only way out is closing the
 * browser. `ADR-008` already built the machinery (`revokeSession`), so this is
 * the route that connects it to the cookie.
 *
 * ## The shape, and the two decisions in it
 *
 * **`@Public`,** because the route must work for a session that is already
 * expired or corrupt — signing out of a broken session is the ordinary case.
 * **Idempotent 200,** because a caller with no cookie (or a dead one) has
 * already achieved what they asked for; a 401 on sign-out teaches users that
 * the button is broken.
 *
 * The revoke is bounded by what the cookie can name: no cookie, or a token no
 * session matches, revokes nothing and still answers 200.
 */

const CORRECT = 'a-sufficiently-long-password';
const PRINCIPAL = 'teacher@school.lk';
const TEST_PARAMETERS: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS;

let prisma: PrismaClient;
let hasher: Argon2PasswordHasher;
let schoolId: string;
let harness: HttpHarness;

const post = (path: string, body: unknown = {}) =>
  harness.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
    body: JSON.stringify(body),
  });

/** Sign in and return the `name=value` pair of the session cookie that was set. */
async function signInForCookie(): Promise<string> {
  await anAccount();
  const response = await post('/auth/login', { identifier: PRINCIPAL, password: CORRECT });
  expect(response.status).toBe(200);

  const session = response.cookie('eduflow_session');
  expect(session).not.toBeNull();
  return session === null ? '' : `${session.name}=${session.value}`;
}

async function anAccount(): Promise<string> {
  const hashed = await hasher.hash(CORRECT, TEST_PARAMETERS);
  return (
    await prisma.user.create({
      data: {
        schoolId,
        email: PRINCIPAL,
        username: `signout-${randomUUID()}`,
        status: 'ACTIVE',
        passwordHash: hashed.hash,
        passwordAlgorithm: hashed.algorithm,
      },
      select: { id: true },
    })
  ).id;
}

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. This suite writes real rows.');
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
      name: 'Sign-out school',
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
      LOGIN_MAX_FAILED_ATTEMPTS: '5',
      LOGIN_LOCKOUT_MS: '600000',
      PASSWORD_RESET_MAX_ATTEMPTS: '5',
      PASSWORD_RESET_WINDOW_MS: '900000',
    },
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('POST /auth/sign-out — with a live session', () => {
  it('revokes the session server-side and clears the cookie', async () => {
    const cookie = await signOutSetup();

    const response = await harness.request('/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test', cookie },
      body: '{}',
    });

    expect(response.status).toBe(200);

    // Server-side first: a cleared cookie with a live session is a credential
    // that still works from a copied cookie jar.
    const live = await prisma.session.count({ where: { schoolId, revokedAt: null } });
    expect(live).toBe(0);

    // Then the cookie: the cleared form must EXPIR it, not merely blank it.
    const cleared = response.cookie('eduflow_session');
    expect(cleared?.raw).toMatch(/eduflow_session=;/);
    expect(cleared?.attributes.expires).toBeDefined();
  });

  it('leaves the OLD cookie unable to authenticate anything', async () => {
    const cookie = await signOutSetup();
    await harness.request('/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test', cookie },
      body: '{}',
    });

    const after = await harness.request('/auth/oidc/link', {
      headers: { cookie, [CSRF_HEADER_NAME]: 'test' },
    });

    expect(after.status).toBe(401);
  });

  it('records the sign-out in the audit trail', async () => {
    const cookie = await signOutSetup();

    await harness.request('/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test', cookie },
      body: '{}',
    });

    const rows = await prisma.auditRecord.findMany({ where: { schoolId, action: 'SIGN_OUT' } });
    expect(rows).toHaveLength(1);
  });
});

describe('POST /auth/sign-out — with nothing to revoke', () => {
  it('answers the same 200 with no cookie at all', async () => {
    // A user who was never signed in has already achieved what they asked
    // for. A 401 here teaches them the button is broken.
    const response = await post('/auth/sign-out');

    expect(response.status).toBe(200);
  });

  it('answers the same 200 with a cookie no session matches', async () => {
    const response = await harness.request('/auth/sign-out', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CSRF_HEADER_NAME]: 'test',
        cookie: 'eduflow_session=a-token-nobody-issued',
      },
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
  });
});

/** Sign in and return the cookie, for the suites that need one. */
async function signOutSetup(): Promise<string> {
  return signInForCookie();
}
