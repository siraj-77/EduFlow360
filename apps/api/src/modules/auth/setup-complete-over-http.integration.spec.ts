import { randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  startHttpHarness,
  type HttpHarness,
  type HttpResponse,
} from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { CSRF_HEADER_NAME } from '../../common/guards/csrf.guard.js';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher.js';
import { PrismaSetupTokenRepository } from './infrastructure/postgres/prisma-setup-token-repository.js';

/**
 * `POST /auth/setup/complete` over a real socket, against a real PostgreSQL.
 *
 * ## Why this file exists at all, when a controller spec already exists
 *
 * `setup-completion.controller.spec.ts` covers the status map and the throttle order
 * by calling the handler directly. It cannot see:
 *
 *   - the status code Nest actually puts on the wire, which is decided by the
 *     framework rather than by this repository;
 *   - the response BODY, which is what "indistinguishable" is actually about —
 *     two refusals with the same status and different bytes are still an oracle;
 *   - the row that landed in `users`, which is the acceptance criterion;
 *   - `CsrfGuard`, which is global and therefore armed at every POST and which a
 *     hand-invoked handler never meets.
 *
 * ## One application PER TEST, and why that is not waste
 *
 * `AGENTS.md` 2.1: one database per school. `PLT-107` chose option (b), so a
 * deployment has exactly ONE bootstrap, ever — the first administrator is singular.
 * Two tests sharing a `schoolId` would therefore share a bootstrap, and the second
 * one to run would be asserting against a deployment the first had already claimed.
 * The state machine (`SetupTokenDeploymentState`) reads "is a first administrator
 * still outstanding" off the ACCOUNT, so a shared school makes the 404-versus-409
 * assertions order-dependent.
 *
 * So each test gets a fresh `schoolId` and its own application instance. That is the
 * honest way to model a deployment, and it costs one Nest boot and one argon2 hash
 * (at deliberately cheap test parameters, written into the school's own settings row
 * — so the cheapness exercises the real settings path rather than bypassing it).
 */

const STRONG = 'a-sufficiently-long-password';
const ONE_HOUR_MS = 3_600_000;

/**
 * argon2 at the library's floor, written into the test school's settings row.
 *
 * The module resolves cost parameters from `school_settings`, exactly as production
 * does, so this is not a bypass: it is the same code path with a school that has
 * chosen the cheapest cost argon2 accepts. Without it every verification in this file
 * would run at 19 MiB and the suite would take minutes — the brief's warning about
 * argon2 being deliberately slow.
 */
const TEST_PARAMETERS = Object.freeze({ memoryCost: 8, timeCost: 1, parallelism: 1 });

let prisma: PrismaClient;
let harness: HttpHarness;
let schoolId: string;

/** A fresh deployment: one school, its settings row, and one `INVITED` user. */
async function aFreshDeployment(): Promise<{ userId: string; repo: PrismaSetupTokenRepository }> {
  const userId = (
    await prisma.user.create({
      data: {
        schoolId,
        email: `principal-${randomUUID()}@school.test`,
        username: `principal-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;

  return {
    userId,
    repo: new PrismaSetupTokenRepository(prisma, schoolId),
  };
}

const post = (body: unknown): Promise<HttpResponse> =>
  harness.request('/auth/setup/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite makes real requests against a real database; the ' +
        'acceptance criteria are about what landed in a row.',
    );
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();

  schoolId = randomUUID();
  await prisma.schoolSettings.create({
    data: {
      schoolId,
      name: 'HTTP harness school',
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
      // Kept small so the throttle test needs eleven requests rather than eleven
      // hundred. The numbers themselves are asserted in `env.spec.ts`; this suite is
      // about the 429 arriving, not about what the default is.
      SETUP_MAX_ATTEMPTS: '10',
    },
  });
});

afterEach(async () => {
  await harness?.close();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('the happy path', () => {
  it('answers 200 and activates the account with a password set', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const response = await post({ token: issued.setupTokenPlaintext, password: STRONG });

    expect(response.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        status: true,
        passwordHash: true,
        passwordAlgorithm: true,
        mustChangePassword: true,
      },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.passwordHash?.startsWith('$argon2id$')).toBe(true);
    expect(row.passwordAlgorithm).toBe('argon2id');
    // The story is explicit: the user chose this password deliberately.
    expect(row.mustChangePassword).toBe(false);
  });

  it('spends the token, so a replay is refused', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    await post({ token: issued.setupTokenPlaintext, password: STRONG });
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true, setupTokenExpiresAt: true },
    });

    expect(stored.setupTokenHash).toBeNull();
    expect(stored.setupTokenExpiresAt).toBeNull();
  });

  it('never returns the password or the token, not even in the success body', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const response = await post({ token: issued.setupTokenPlaintext, password: STRONG });

    expect(response.body).not.toContain(STRONG);
    expect(response.body).not.toContain(issued.setupTokenPlaintext);
  });

  it('sets no cookie, because this route creates a credential and not a session', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const response = await post({ token: issued.setupTokenPlaintext, password: STRONG });

    expect(response.cookies).toEqual([]);
  });

  it('applies the optional email and username when they are supplied', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });
    const email = `head-${randomUUID()}@school.test`;
    const username = `head-${randomUUID()}`;

    const response = await post({
      token: issued.setupTokenPlaintext,
      password: STRONG,
      email,
      username,
    });

    expect(response.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, username: true },
    });
    expect(row).toEqual({ email, username });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The acceptance criteria. Each one is a claim about the wire AND about the row,
// because either alone would be a weaker claim than the story makes.
// ═══════════════════════════════════════════════════════════════════════════
describe('a token that has already been claimed', () => {
  it('is refused with 409, and no second administrator appears', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const first = await post({ token: issued.setupTokenPlaintext, password: STRONG });
    const second = await post({ token: issued.setupTokenPlaintext, password: STRONG });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    // Exactly one account exists, and it is the one that was there to begin with.
    expect(await prisma.user.count({ where: { schoolId } })).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE acceptance criterion. "Given two concurrent requests presenting the same
// token, then exactly one succeeds and one is rejected. The consumption is atomic,
// not a read-then-write. (This is the case a naive implementation passes and this
// one must not.)"
// ═══════════════════════════════════════════════════════════════════════════
describe('two concurrent claims presenting the same token', () => {
  const CONTENDERS = 6;

  it('lets exactly one request answer 200', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const responses = await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        post({ token: issued.setupTokenPlaintext, password: STRONG }),
      ),
    );

    const accepted = responses.filter((r) => r.status === 200);
    expect(
      accepted,
      `${accepted.length} of ${CONTENDERS} concurrent claims answered 200: ${responses
        .map((r) => r.status)
        .join(', ')}`,
    ).toHaveLength(1);
  });

  it('refuses every loser with 409, never with 400 or 404', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const responses = await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        post({ token: issued.setupTokenPlaintext, password: STRONG }),
      ),
    );

    const losers = responses.filter((r) => r.status !== 200);
    expect(losers).toHaveLength(CONTENDERS - 1);
    for (const loser of losers) expect(loser.status).toBe(409);
  });

  it('writes the credential exactly once, whatever the interleaving was', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        post({ token: issued.setupTokenPlaintext, password: STRONG }),
      ),
    );

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, setupTokenHash: true },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.setupTokenHash).toBeNull();
    expect(await prisma.user.count({ where: { schoolId } })).toBe(1);
  });
});

describe('an expired token and a forged one', () => {
  it('the expired token is refused with 400', async () => {
    const { userId, repo } = await aFreshDeployment();
    // Issued one hour into the past.
    const issued = await repo.issue({ userId, ttlMs: -ONE_HOUR_MS, now: new Date() });

    const response = await post({ token: issued.setupTokenPlaintext, password: STRONG });

    expect(response.status).toBe(400);
  });

  it('the expired token is left on the row, because expired is not spent', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: -ONE_HOUR_MS, now: new Date() });

    await post({ token: issued.setupTokenPlaintext, password: STRONG });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true, passwordHash: true },
    });
    expect(row.setupTokenHash).not.toBeNull();
    expect(row.passwordHash).toBeNull();
  });

  it('the two are INDISTINGUISHABLE: same status, byte-identical body', async () => {
    // D58, scoped within an enrolled deployment. Asserted on the bytes, not on the
    // status, because a matching status with a differing message is still an oracle.
    const expired = await aFreshDeployment();
    const expiredToken = await expired.repo.issue({
      userId: expired.userId,
      ttlMs: -ONE_HOUR_MS,
      now: new Date(),
    });
    // A second account in the SAME deployment, so the forged token is compared against
    // a deployment that genuinely has a token outstanding. Without it the two responses
    // would differ in the DEPLOYMENT STATE and the comparison would prove nothing.
    await aFreshDeployment();

    const expiredResponse = await post({
      token: expiredToken.setupTokenPlaintext,
      password: STRONG,
    });
    const forgedResponse = await post({
      token: `${randomUUID()}${randomUUID()}`,
      password: STRONG,
    });

    expect(expiredResponse.status).toBe(forgedResponse.status);
    expect(expiredResponse.body).toBe(forgedResponse.body);
  });
});

describe('a deployment that has never been enrolled', () => {
  it('answers 404, so the endpoint does not advertise itself', async () => {
    // An `INVITED` user with no credential and no token: exactly the state a fresh
    // installation is in.
    await aFreshDeployment();

    const response = await post({ token: 'whatever-nobody-issued', password: STRONG });

    expect(response.status).toBe(404);
  });

  it("answers with Nest's GENERIC not-found body, which reveals nothing about tokens", async () => {
    // `D58`: an unenrolled deployment "answers 404 to every request and therefore reveals
    // nothing about any token".
    //
    // An earlier version of this file asserted byte-identity with the 404 for a path that
    // does not exist, which was not achievable and should not have been aimed at: Nest's
    // own route-not-found body echoes the requested path
    // (`{"message":"Cannot POST /auth/no-such-route",...}`), so matching it would mean
    // hand-writing framework text that changes between Nest versions.
    //
    // So the property asserted is the one D58 actually states — the response carries no
    // information about any token — plus the structural half, that it is the GENERIC
    // not-found body rather than a bespoke message about this deployment's bootstrap.
    await aFreshDeployment();

    const unenrolled = await post({ token: 'whatever-nobody-issued', password: STRONG });

    expect(unenrolled.status).toBe(404);
    expect(JSON.parse(unenrolled.body)).toEqual({ message: 'Not Found', statusCode: 404 });
  });

  it('says nothing about tokens, passwords or setup in the 404 body', async () => {
    // The specific failure an earlier version of this controller had: a bespoke
    // "This deployment has no setup token outstanding" message, which kept the 404 and
    // announced the very fact D58 exists to withhold.
    await aFreshDeployment();

    const response = await post({ token: 'whatever-nobody-issued', password: STRONG });

    expect(response.body.toLowerCase()).not.toContain('token');
    expect(response.body.toLowerCase()).not.toContain('password');
    expect(response.body.toLowerCase()).not.toContain('setup');
  });
});

describe('a password the policy refuses', () => {
  it('is refused with 400 and does NOT consume the token', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const response = await post({ token: issued.setupTokenPlaintext, password: 'hunter2' });

    expect(response.status).toBe(400);
    // "A rejected attempt does not burn the school's only way in."
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true, passwordHash: true },
    });
    expect(stored.setupTokenHash).not.toBeNull();
    expect(stored.passwordHash).toBeNull();
  });

  it('leaves a token that still works', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    await post({ token: issued.setupTokenPlaintext, password: 'hunter2' });
    const second = await post({ token: issued.setupTokenPlaintext, password: STRONG });

    expect(second.status).toBe(200);
  });

  it('never echoes the password in the refusal', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const response = await post({ token: issued.setupTokenPlaintext, password: 'hunter2' });

    expect(response.body).not.toContain('hunter2');
    expect(response.body).not.toContain(issued.setupTokenPlaintext);
  });
});

describe('the request itself', () => {
  it('is refused with 400 when the body is not a valid request', async () => {
    await post({ token: 'a-token' }).then((r) => expect(r.status).toBe(400));
    await post({}).then((r) => expect(r.status).toBe(400));
    await post({ token: 'a-token', password: STRONG, surprise: true }).then((r) =>
      expect(r.status).toBe(400),
    );
  });

  it('is refused by CsrfGuard without the custom header, before any handler runs', async () => {
    // The one control in this repository that actually ENFORCES anything, so it is
    // worth proving over a socket rather than by reading the guard's source.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const response = await harness.request('/auth/setup/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: issued.setupTokenPlaintext, password: STRONG }),
    });

    expect(response.status).toBe(403);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, setupTokenHash: true },
    });
    expect(row.passwordHash).toBeNull();
    expect(row.setupTokenHash).not.toBeNull();
  });
});

describe('the throttle on an unauthenticated write', () => {
  it('answers 429 after the configured number of attempts from one source', async () => {
    // A token IS issued, deliberately. Without one the deployment reads as
    // `no-token-issued` and every forged attempt answers 404, so the throttle would
    // never be reached — which is D58 working correctly and this test measuring the
    // wrong thing.
    const { userId, repo } = await aFreshDeployment();
    await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await post({ token: 'never-issued-by-anyone', password: STRONG });
      statuses.push(response.status);
    }

    // The statuses are in the failure message, because "every 400" without them is a
    // failure that costs a rerun to diagnose.
    expect(
      statuses.slice(0, 10),
      `the first ten attempts should all be 400; the sequence was ${statuses.join(', ')}`,
    ).toEqual(Array.from({ length: 10 }, () => 400));
    expect(statuses[10]).toBe(429);
  });

  it('says the token was NOT spent, because a throttle a principal hits by typing slowly is not a spent token', async () => {
    const { userId, repo } = await aFreshDeployment();
    await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await post({ token: 'never-issued-by-anyone', password: STRONG });
    }

    const response = await post({ token: 'never-issued-by-anyone', password: STRONG });

    expect(response.body).toContain('NOT been spent');
  });

  it('never echoes the token in a 429', async () => {
    const { userId, repo } = await aFreshDeployment();
    await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    for (let attempt = 0; attempt < 11; attempt += 1) {
      await post({ token: 'a-token-value-an-attacker-guessed', password: STRONG });
    }

    const response = await post({ token: 'a-token-value-an-attacker-guessed', password: STRONG });

    expect(response.status).toBe(429);
    expect(response.body).not.toContain('a-token-value-an-attacker-guessed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// `AGENTS.md` 2.13, asserted end to end rather than by reading the code.
// ═══════════════════════════════════════════════════════════════════════════
describe('the database after every refusal', () => {
  it('holds a SHA-256 of the token and never the token itself', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true },
    });

    expect(stored.setupTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.setupTokenHash).toBe(
      createHash('sha256').update(issued.setupTokenPlaintext).digest('hex'),
    );
    expect(stored.setupTokenHash).not.toBe(issued.setupTokenPlaintext);
  });

  it('holds a hash the supplied password does not appear in', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    await post({ token: issued.setupTokenPlaintext, password: STRONG });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    expect(row.passwordHash).not.toContain(STRONG);
  });

  it('writes a digest the real adapter can verify — the round trip that matters', async () => {
    // Asserting "the column is not null" would pass for any string at all. This asks
    // the production hasher whether the stored digest matches the password the caller
    // chose, at the parameters the school's own settings row declares.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: new Date() });

    await post({ token: issued.setupTokenPlaintext, password: STRONG });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, passwordAlgorithm: true },
    });
    const hasher = new Argon2PasswordHasher({ currentParameters: TEST_PARAMETERS });
    const verdict = await hasher.verify(
      STRONG,
      row.passwordHash ?? '',
      row.passwordAlgorithm ?? 'argon2id',
    );
    expect(verdict.verified).toBe(true);
    // And at the parameters the school configured, so `needsRehash` is false and the
    // migration path is not silently triggered by the deployment's own settings.
    expect(verdict.verified && verdict.needsRehash).toBe(false);
  });
});
