import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { CSRF_HEADER_NAME } from '../../common/guards/csrf.guard.js';
import { Argon2PasswordHasher } from '../auth/infrastructure/adapters/argon2-password-hasher.js';
import { DEFAULT_PASSWORD_HASH_PARAMETERS } from '../settings/domain/services/password-hash-parameters.js';
import type { PasswordHashParameters } from '../auth/domain/ports/password-hasher.js';
import { I_EMAIL_DELIVERY } from '../auth/domain/ports/email-delivery.js';
import { RecordingEmailAdapter } from '../auth/infrastructure/adapters/recording-email-adapter.js';

/**
 * `PLT-105` end to end, over a real socket against a real PostgreSQL.
 *
 * ## Why this spec exists when the use-cases and the store are both green
 *
 * Because the three ways this feature can be broken are all WIRING: a
 * controller registered in no module (the route 404s), the audit interceptor
 * never firing on a `@Public` route, or a use-case whose token repository was
 * never provided. Unit specs prove the parts; this proves the deployment —
 * the real `AppModule`, the real guards, the real repositories, a real argon2
 * verification, and a real `audit_records` row read back through a real
 * client.
 *
 * ## The one substitution, and why it is legitimate
 *
 * `I_EMAIL_DELIVERY` is replaced with a `RecordingEmailAdapter` through the
 * harness's vendor-override seam. It is the SAME class the production module
 * selects when no SMTP is configured, and it is what makes the plaintext
 * token readable at all — the store keeps only the SHA-256, exactly as it
 * should. Nothing else is substituted: the database, the route, the guards,
 * the interceptor and the use-case are the shipped ones.
 */

const CORRECT = 'a-sufficiently-long-password';
const NEW_PASSWORD = 'a-new-sufficiently-long-password';
const WEAK = 'tiny';
const PRINCIPAL = 'teacher@school.lk';
const RESET_PATH = '/auth/password-reset';
const TEST_PARAMETERS: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS;

let prisma: PrismaClient;
let hasher: Argon2PasswordHasher;
let schoolId: string;
let harness: HttpHarness;
let mail: RecordingEmailAdapter;

const post = (path: string, body: unknown) =>
  harness.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
    body: JSON.stringify(body),
  });

/** One account with a real argon2id hash, in the test school. */
async function anAccount(): Promise<string> {
  const hashed = await hasher.hash(CORRECT, TEST_PARAMETERS);
  return (
    await prisma.user.create({
      data: {
        schoolId,
        email: PRINCIPAL,
        username: `reset-${randomUUID()}`,
        status: 'ACTIVE',
        passwordHash: hashed.hash,
        passwordAlgorithm: hashed.algorithm,
      },
      select: { id: true },
    })
  ).id;
}

const trail = () =>
  prisma.auditRecord.findMany({ where: { schoolId }, orderBy: { occurredAt: 'asc' } });

const tokens = () => prisma.passwordResetToken.findMany({ where: { schoolId } });

/**
 * The harness environment, shared by `beforeEach` and the `PLT-1001` AC-2
 * test so a second harness can differ in exactly ONE variable.
 */
const harnessEnv = (extra: Record<string, string> = {}) => ({
  ...TEST_ENVIRONMENT,
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  SCHOOL_ID: schoolId,
  JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
  PASSWORD_RESET_TTL_MS: '3600000',
  PASSWORD_RESET_MAX_ATTEMPTS: '5',
  PASSWORD_RESET_WINDOW_MS: '900000',
  LOGIN_MAX_FAILED_ATTEMPTS: '5',
  LOGIN_LOCKOUT_MS: '600000',
  ...extra,
});

/** Request a reset and recover the plaintext token from the recorded mail. */
async function requestReset(): Promise<string> {
  const response = await post(`${RESET_PATH}/request`, { email: PRINCIPAL });
  expect(response.status).toBe(200);

  expect(mail.sent).toHaveLength(1);
  const link = mail.sent[0]?.textBody.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  expect(link).toBeDefined();
  return link ?? '';
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
  mail = new RecordingEmailAdapter();

  await prisma.schoolSettings.create({
    data: {
      schoolId,
      name: 'Password reset school',
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
    env: harnessEnv(),
    overrides: [{ token: I_EMAIL_DELIVERY, useValue: mail }],
  });
});

afterEach(async () => {
  await harness?.close();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('POST /auth/password-reset/request', () => {
  it('answers the CONSTANT 200, mints a credential, and mails the link', async () => {
    await anAccount();

    const response = await post(`${RESET_PATH}/request`, { email: PRINCIPAL });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ accepted: true });
    expect(await tokens()).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe(PRINCIPAL);
  });

  it('answers the SAME 200 for an address with no account, and mints nothing', async () => {
    // The enumeration control, asserted against the table rather than the
    // body: what differs between the two paths is invisible to a caller.
    const response = await post(`${RESET_PATH}/request`, { email: 'nobody@school.lk' });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ accepted: true });
    expect(await tokens()).toEqual([]);
    expect(mail.sent).toEqual([]);
  });

  it('records the request in the audit trail, with no email in the record', async () => {
    await anAccount();

    await post(`${RESET_PATH}/request`, { email: PRINCIPAL });

    const rows = await trail();
    expect(rows.map((row) => row.action)).toEqual(['PASSWORD_RESET_REQUEST']);
    // The whitelist in `reasonOf` is one key; the email never reaches the
    // store. Asserted over the serialised row, not by trust.
    expect(JSON.stringify(rows[0])).not.toContain(PRINCIPAL);
  });

  it('throttles the source, because an unauthenticated route that sends mail can be made to send unbounded mail', async () => {
    // The school's mail relay is a shared credential: one caller grinding
    // this route gets the domain blacklisted for everyone.
    await anAccount();

    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await post(`${RESET_PATH}/request`, { email: PRINCIPAL }));
    }

    // Five are allowed (PASSWORD_RESET_MAX_ATTEMPTS=5); the sixth is refused.
    expect(responses.slice(0, 5).map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(responses[5]?.status).toBe(429);
  });
});

describe('POST /auth/password-reset/confirm', () => {
  it('refuses a token nobody issued, with the frozen body, and writes nothing', async () => {
    const response = await post(`${RESET_PATH}/confirm`, {
      token: 'a-token-nobody-issued',
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(/reset link is not valid/i);
    expect(await tokens()).toEqual([]);
  });

  it('records the refused attempt too — the fact, the source, the timestamp', async () => {
    await post(`${RESET_PATH}/confirm`, {
      token: 'a-token-nobody-issued',
      password: NEW_PASSWORD,
    });

    const rows = await trail();
    expect(rows.map((row) => row.action)).toEqual(['PASSWORD_RESET_CONFIRM']);
    expect(rows[0]?.actorId).toBeNull();
    expect(JSON.stringify(rows[0])).not.toContain('a-token-nobody-issued');
  });

  it('refuses a weak password WITHOUT consuming the token', async () => {
    // A caller who mistypes their new password must be able to retry with the
    // same link — the policy fires before the token is read.
    await anAccount();
    const token = await requestReset();

    const response = await post(`${RESET_PATH}/confirm`, { token, password: WEAK });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(/password does not meet/i);

    const rows = await tokens();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.consumedAt).toBeNull();
  });

  it('refuses the SAME link a second time — single-use, at the row level', async () => {
    await anAccount();
    const token = await requestReset();

    const first = await post(`${RESET_PATH}/confirm`, { token, password: NEW_PASSWORD });
    const second = await post(`${RESET_PATH}/confirm`, { token, password: NEW_PASSWORD });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(JSON.parse(second.body).message).toMatch(/reset link is not valid/i);
  });
});

describe('the recovery, end to end', () => {
  it('resets the password, signs the user in with the new one, and revokes every prior session', async () => {
    // Sign in first: the reset must invalidate THIS session, not only the
    // request's own.
    const userId = await anAccount();
    const signIn = await harness.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
      body: JSON.stringify({ identifier: PRINCIPAL, password: CORRECT }),
    });
    expect(signIn.status).toBe(200);
    // The sessions that exist at THIS point are the ones the reset must kill.
    const sessionsBeforeReset = (
      await prisma.session.findMany({ where: { userId }, select: { id: true } })
    ).map((session) => session.id);
    expect(sessionsBeforeReset.length).toBeGreaterThan(0);

    const token = await requestReset();
    const reset = await post(`${RESET_PATH}/confirm`, { token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);
    expect(JSON.parse(reset.body)).toEqual({ reset: true });

    // The NEW password works, over a real route, with real argon2.
    const withNew = await harness.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
      body: JSON.stringify({ identifier: PRINCIPAL, password: NEW_PASSWORD }),
    });
    expect(withNew.status).toBe(200);

    // The OLD password does not.
    const withOld = await harness.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
      body: JSON.stringify({ identifier: PRINCIPAL, password: CORRECT }),
    });
    expect(withOld.status).toBe(401);

    // And every session that existed BEFORE the reset is revoked by name.
    // The post-reset sign-ins above created new live sessions, so the query
    // is scoped to the sessions the reset was supposed to kill.
    const stillAlive = await prisma.session.findMany({
      where: { userId, id: { in: sessionsBeforeReset }, revokedAt: null },
    });
    const revokedOnes = await prisma.session.findMany({
      where: { userId, id: { in: sessionsBeforeReset }, revokedReason: 'password-reset' },
    });

    expect(stillAlive).toEqual([]);
    expect(revokedOnes.length).toBeGreaterThan(0);
  });

  it('records the whole trail, and no credential anywhere in it', async () => {
    await anAccount();
    const token = await requestReset();
    await post(`${RESET_PATH}/confirm`, { token, password: NEW_PASSWORD });

    const rows = await trail();
    expect(rows.map((row) => row.action)).toEqual([
      'PASSWORD_RESET_REQUEST',
      'PASSWORD_RESET_CONFIRM',
    ]);
    const serialized = JSON.stringify(rows);
    // The new password appears nowhere; the token appears nowhere; the email
    // appears nowhere. `AGENTS.md` 2.13, asserted.
    expect(serialized).not.toContain(NEW_PASSWORD);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain(PRINCIPAL);
  });

  /**
   * `PLT-1001` AC-2 — the e-mail half.
   *
   * The suite above proves the link carries the minted token. None of it
   * proves the link's ORIGIN is the configured one: every harness boots with
   * the default `WEB_ORIGIN`, so a module that hard-coded
   * `http://localhost:3500` into its `RequestPasswordReset` wiring would pass
   * all of them and mail every parent a link to a developer's machine. This
   * boots a SECOND harness whose `WEB_ORIGIN` differs and requires the mail to
   * follow it — the same derivation `main.ts` performs for CORS, proven from
   * the other end of the wire.
   */
  it('mails the reset link at the origin WEB_ORIGIN names — the config, not the module', async () => {
    const configured = 'https://staging.school.example';
    await anAccount();

    const custom = await startHttpHarness({
      env: harnessEnv({ WEB_ORIGIN: configured }),
      overrides: [{ token: I_EMAIL_DELIVERY, useValue: mail }],
    });

    try {
      const response = await custom.request(`${RESET_PATH}/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
        body: JSON.stringify({ email: PRINCIPAL }),
      });

      expect(response.status).toBe(200);
      expect(mail.sent).toHaveLength(1);
      expect(mail.sent[0]?.textBody).toContain(`${configured}/en/sign-in/reset?token=`);
      // And the default is not present anywhere: the link moved, it did not
      // gain a second origin.
      expect(mail.sent[0]?.textBody).not.toContain('http://localhost:3500');
    } finally {
      await custom.close();
    }
  });
});

describe('the unmarked route', () => {
  it('produces no audit row for a route without @Audited', async () => {
    const response = await harness.request('/auth/oidc/redirect', {
      headers: { [CSRF_HEADER_NAME]: 'test' },
    });
    expect(response.status).toBe(302);

    expect(await trail()).toEqual([]);
  });
});
