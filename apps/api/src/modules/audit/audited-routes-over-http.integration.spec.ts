import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { Argon2PasswordHasher } from '../auth/infrastructure/adapters/argon2-password-hasher.js';
import { DEFAULT_PASSWORD_HASH_PARAMETERS } from '../settings/domain/services/password-hash-parameters.js';
import type { PasswordHashParameters } from '../auth/domain/ports/password-hasher.js';
import { CSRF_HEADER_NAME } from '../../common/guards/csrf.guard.js';

/**
 * The audit trail, produced by real requests over a real socket against a
 * real PostgreSQL (`PLT-402`'s end of the story).
 *
 * ## Why this exists when `audit.interceptor.spec.ts` already passes
 *
 * The unit spec proves the interceptor's behaviour against a fake repository
 * and a reflector. That is necessary and it is not sufficient: it cannot see
 * the decorator on the REAL controller, the REAL `AuditModule` registered by
 * `AppModule.forRoot`, the REAL `PrismaAuditRepository` stamping `schoolId`,
 * or the database defaults assigning `id` and `occurred_at`. A wiring fault
 * anywhere in that chain leaves the unit spec green and the trail empty —
 * which is precisely the failure this file exists to catch.
 *
 * ## What is real
 *
 * Everything: the real app through `createApp()`, all three global guards,
 * the real `AuditInterceptor` with its real dependencies, real argon2id
 * verification, and a real `audit_records` row read back through a real
 * client. Nothing is substituted except the network edge — there is no
 * browser, so the user-agent is whatever the harness sends.
 *
 * ## No cleanup, by design
 *
 * `audit_records` is append-only and the trigger forbids deletion, so the
 * suite filters on the per-test `schoolId` instead. The table grows by a few
 * rows per run, which is what an append-only table is for.
 */

const CORRECT = 'a-sufficiently-long-password';
const WRONG = 'a-different-long-password';
const PRINCIPAL = 'teacher@school.lk';
const TEST_PARAMETERS: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS;

let prisma: PrismaClient;
let hasher: Argon2PasswordHasher;
let schoolId: string;
let harness: HttpHarness;

/** One account with a real argon2id hash, in the test school. */
async function anAccount(): Promise<string> {
  const hashed = await hasher.hash(CORRECT, TEST_PARAMETERS);
  return (
    await prisma.user.create({
      data: {
        schoolId,
        email: PRINCIPAL,
        username: `audit-signin-${randomUUID()}`,
        status: 'ACTIVE',
        passwordHash: hashed.hash,
        passwordAlgorithm: hashed.algorithm,
      },
      select: { id: true },
    })
  ).id;
}

const post = (h: HttpHarness, body: unknown) =>
  h.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
    body: JSON.stringify(body),
  });

/** Every audit row the test school's trail holds. */
const trail = () =>
  prisma.auditRecord.findMany({ where: { schoolId }, orderBy: { occurredAt: 'asc' } });

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite writes real rows to a real audit_records table, ' +
        'and a trail that only a real database can hold is the subject.',
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
      name: 'Audit trail school',
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
    },
  });
});

afterEach(async () => {
  await harness?.close();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('a successful sign-in', () => {
  it('writes exactly one LOGIN record, attributed to the account it created', async () => {
    const userId = await anAccount();

    const response = await post(harness, { identifier: PRINCIPAL, password: CORRECT });
    expect(response.status).toBe(200);

    const rows = await trail();

    // Exactly one. A second write per action would double-count every
    // sensitive action in the trail, and the decorator's contract is one
    // action, one record.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('LOGIN');
    expect(rows[0]?.module).toBe('auth');
    // The actor the HANDLER declared, because this route is @Public and
    // SessionGuard attached no principal — `attachAuditActor` at the sign-in
    // site is what fills this in.
    expect(rows[0]?.actorId).toBe(userId);
    expect(rows[0]?.entityType).toBe('user');
    expect(rows[0]?.entityId).toBe(userId);
  });

  it('stamps the school as metadata, and storage assigns id and occurredAt', async () => {
    await anAccount();
    await post(harness, { identifier: PRINCIPAL, password: CORRECT });

    const [row] = await trail();

    // `AGENTS.md` 2.1: the column is metadata, and the repository stamps it
    // so a caller cannot forget it or forge another school's.
    expect(row?.schoolId).toBe(schoolId);
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.occurredAt).toBeInstanceOf(Date);
    expect(row?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    // The harness sends its own user-agent; the address is the loopback peer.
    expect(row?.ipAddress).not.toBeNull();
    expect(row?.deviceInfo).not.toBeNull();
  });

  it('carries no credential, whatever the body carried', async () => {
    await anAccount();

    await post(harness, { identifier: PRINCIPAL, password: CORRECT });

    const [row] = await trail();
    const serialized = JSON.stringify(row);

    // The whitelist in `reasonOf` is one key. A password in `audit_records`
    // would put a credential in the one table nothing may ever delete.
    expect(serialized).not.toContain(CORRECT);
    expect(serialized).not.toContain(PRINCIPAL);
  });
});

describe('a failed sign-in', () => {
  it('is recorded with the fact, the source and the timestamp — and no identity', async () => {
    await anAccount();

    const response = await post(harness, { identifier: PRINCIPAL, password: WRONG });
    expect(response.status).toBe(401);

    const rows = await trail();

    // The failed-attempt record is what makes a brute force visible after the
    // fact; without it the trail holds only successes, which is the half an
    // attacker never generates.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('LOGIN');
    expect(rows[0]?.ipAddress).not.toBeNull();
    // NO actor, even though the request carried an identifier: a failure
    // record naming an identity would let anyone write an accusation into the
    // trail by typing someone else's address. The controller's header states
    // the rule this implements.
    expect(rows[0]?.actorId).toBeNull();
    expect(JSON.stringify(rows[0])).not.toContain(PRINCIPAL);
    expect(JSON.stringify(rows[0])).not.toContain(WRONG);
  });

  it('answers the frozen refusal body, so the interceptor changed no status', async () => {
    await anAccount();

    const response = await post(harness, { identifier: PRINCIPAL, password: WRONG });

    // The controller's own frozen body, byte for byte. An interceptor that
    // wrapped the error would change this to a 500, and the difference is the
    // caller's only signal about what happened.
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Those credentials were not accepted.',
    });
  });
});

describe('a route without @Audited', () => {
  it('writes nothing, so the decorator is what makes a route recorded', async () => {
    // `GET /auth/oidc/redirect` is @Public and carries no @Audited: the
    // redirect mints nothing, and a trail that recorded it would be a trail
    // where the noise drowns the events.
    const response = await harness.request('/auth/oidc/redirect', {
      headers: { [CSRF_HEADER_NAME]: 'test' },
    });
    expect(response.status).toBe(302);

    expect(await trail()).toEqual([]);
  });
});
