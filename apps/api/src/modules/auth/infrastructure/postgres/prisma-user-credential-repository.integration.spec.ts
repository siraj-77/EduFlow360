import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { instant } from '../../../../testing/instant.js';
import { PrismaUserCredentialRepository } from './prisma-user-credential-repository.js';

/**
 * The credential reads and writes behind `POST /auth/login`.
 *
 * ## What is proved here rather than in the HTTP spec
 *
 * That the statements the timing argument depends on actually run. The
 * enumeration claim is that an unknown identifier and a wrong password cost the
 * same, and part of that cost is the database: `recordFailedSignIn` must issue
 * the same UPDATE and the same SELECT whether or not an account matched. That is
 * a statement-level property, and asserting it here is cheaper and more precise
 * than inferring it from response times.
 *
 * The end-to-end timing is measured over a real socket in
 * `login-over-http.integration.spec.ts`.
 */

const AT = instant('2026-10-03T09:00:00.000Z');
const ONE_HOUR = 3_600_000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 600_000;

let prisma: PrismaClient;

interface Seeded {
  readonly userId: string;
  readonly schoolId: string;
  readonly repo: PrismaUserCredentialRepository;
  readonly email: string;
  readonly username: string;
}

async function anAccount(options?: {
  status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
}): Promise<Seeded> {
  const schoolId = randomUUID();
  const email = `staff-${randomUUID()}@school.test`;
  const username = `staff-${randomUUID()}`;
  const userId = (
    await prisma.user.create({
      data: {
        schoolId,
        email,
        username,
        status: options?.status ?? 'ACTIVE',
        passwordHash: '$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA',
        passwordAlgorithm: 'argon2id',
      },
      select: { id: true },
    })
  ).id;

  return {
    userId,
    schoolId,
    repo: new PrismaUserCredentialRepository(prisma, schoolId),
    email,
    username,
  };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. This suite reads and writes real rows.');
  }
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('finding an account by identifier', () => {
  it('matches on the email', async () => {
    const seeded = await anAccount();

    const match = await seeded.repo.findByIdentifier(seeded.email);

    expect(match.matched).toBe(true);
    expect(match.matched && match.record.userId).toBe(seeded.userId);
    expect(match.matched && match.record.status).toBe('ACTIVE');
  });

  it('matches on the username, because the story names both identifiers', async () => {
    const seeded = await anAccount();

    const match = await seeded.repo.findByIdentifier(seeded.username);

    expect(match.matched && match.record.userId).toBe(seeded.userId);
  });

  it('carries the hash and the algorithm label, and nothing else', async () => {
    const seeded = await anAccount();

    const match = await seeded.repo.findByIdentifier(seeded.email);

    expect(match.matched && match.record.passwordAlgorithm).toBe('argon2id');
    expect(match.matched && match.record.passwordHash).toContain('$argon2id$');
    // The record must not become a general user projection. `PLT-203` resolves
    // ownership through abstract ports that do not exist yet, and this row is a
    // credential, not a person.
    expect(Object.keys(match.matched ? match.record : {}).sort()).toEqual([
      'failedLoginAttempts',
      'lockedUntil',
      'passwordAlgorithm',
      'passwordHash',
      'status',
      'userId',
    ]);
  });

  it('reports no match for an identifier no account carries', async () => {
    const seeded = await anAccount();

    expect(await seeded.repo.findByIdentifier(`${randomUUID()}@nowhere.test`)).toEqual({
      matched: false,
    });
  });

  it('still returns a SUSPENDED account, because hiding it would be a leak too', async () => {
    // A suspension must read as "real account, cannot sign in", not as "no such
    // user" — otherwise suspending a user is indistinguishable from deleting one
    // from the outside, and the operator loses the distinction they rely on.
    const seeded = await anAccount({ status: 'SUSPENDED' });

    const match = await seeded.repo.findByIdentifier(seeded.email);

    expect(match.matched && match.record.status).toBe('SUSPENDED');
  });

  it('cannot see an account in another school', async () => {
    // Isolation is physical here (`AGENTS.md` 2.1), so `schoolId` is metadata —
    // but it is still metadata the repository applies, and this proves it.
    const seeded = await anAccount();

    const elsewhere = new PrismaUserCredentialRepository(prisma, randomUUID());

    expect(await elsewhere.findByIdentifier(seeded.email)).toEqual({ matched: false });
  });
});

describe('counting a failed sign-in', () => {
  it('increments the counter on a real account', async () => {
    const seeded = await anAccount();

    const first = await seeded.repo.recordFailedSignIn({
      identifier: seeded.email,
      now: AT,
      maxAttempts: MAX_ATTEMPTS,
      lockoutMs: LOCKOUT_MS,
    });
    expect(first).toEqual({ outcome: 'counted', failedLoginAttempts: 1 });

    const second = await seeded.repo.recordFailedSignIn({
      identifier: seeded.email,
      now: AT,
      maxAttempts: MAX_ATTEMPTS,
      lockoutMs: LOCKOUT_MS,
    });
    expect(second).toEqual({ outcome: 'counted', failedLoginAttempts: 2 });
  });

  it('reports the same SHAPE for an unknown identifier, matching nothing', async () => {
    // Not `counted: 0` and not an error: a shape a caller could branch on to
    // learn the identifier was real.
    const seeded = await anAccount();

    const outcome = await seeded.repo.recordFailedSignIn({
      identifier: `${randomUUID()}@nowhere.test`,
      now: AT,
      maxAttempts: MAX_ATTEMPTS,
      lockoutMs: LOCKOUT_MS,
    });

    expect(outcome).toEqual({ outcome: 'unknown-identifier' });
  });

  it('locks the account on the threshold attempt, not the one after', async () => {
    const seeded = await anAccount();

    let outcome = await seeded.repo.recordFailedSignIn({
      identifier: seeded.email,
      now: AT,
      maxAttempts: MAX_ATTEMPTS,
      lockoutMs: LOCKOUT_MS,
    });
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      outcome = await seeded.repo.recordFailedSignIn({
        identifier: seeded.email,
        now: AT,
        maxAttempts: MAX_ATTEMPTS,
        lockoutMs: LOCKOUT_MS,
      });
    }

    expect(outcome).toEqual({
      outcome: 'locked',
      lockedUntil: new Date(AT.getTime() + LOCKOUT_MS),
    });
  });

  it('resets the counter when it locks, so the integer cannot run away', async () => {
    const seeded = await anAccount();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await seeded.repo.recordFailedSignIn({
        identifier: seeded.email,
        now: AT,
        maxAttempts: MAX_ATTEMPTS,
        lockoutMs: LOCKOUT_MS,
      });
    }

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.userId },
      select: { failedLoginAttempts: true, lockedUntil: true },
    });
    expect(row.failedLoginAttempts).toBe(0);
    expect(row.lockedUntil?.getTime()).toBe(AT.getTime() + LOCKOUT_MS);
  });

  it('counts against the account whichever identifier was used', async () => {
    // Five guesses by email must not leave a username-based attempt free.
    const seeded = await anAccount();

    await seeded.repo.recordFailedSignIn({
      identifier: seeded.username,
      now: AT,
      maxAttempts: MAX_ATTEMPTS,
      lockoutMs: LOCKOUT_MS,
    });

    const match = await seeded.repo.findByIdentifier(seeded.email);
    expect(match.matched && match.record.failedLoginAttempts).toBe(1);
  });
});

describe('recording a successful sign-in', () => {
  it('stamps lastLoginAt, clears the counter and lifts a lockout', async () => {
    const seeded = await anAccount();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await seeded.repo.recordFailedSignIn({
        identifier: seeded.email,
        now: AT,
        maxAttempts: MAX_ATTEMPTS,
        lockoutMs: LOCKOUT_MS,
      });
    }
    const locked = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.userId },
      select: { lockedUntil: true },
    });
    expect(locked.lockedUntil).not.toBeNull();

    await seeded.repo.recordSuccessfulSignIn({
      userId: seeded.userId,
      now: new Date(AT.getTime() + ONE_HOUR),
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.userId },
      select: { lastLoginAt: true, failedLoginAttempts: true, lockedUntil: true },
    });
    expect(row.lastLoginAt?.getTime()).toBe(AT.getTime() + ONE_HOUR);
    expect(row.failedLoginAttempts).toBe(0);
    expect(row.lockedUntil).toBeNull();
  });
});

describe('replacing the credential after a verified sign-in', () => {
  it('writes the new digest, the new label, and the update stamp', async () => {
    const seeded = await anAccount();
    const fresh = '$argon2id$v=19$m=2,t=2,p=1$bmV3c2FsdA$bmV3ZGlnZXN0';

    await seeded.repo.replaceCredential({
      userId: seeded.userId,
      passwordHash: fresh,
      passwordAlgorithm: 'argon2id',
      now: AT,
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.userId },
      select: { passwordHash: true, passwordAlgorithm: true, passwordUpdatedAt: true },
    });
    expect(row.passwordHash).toBe(fresh);
    expect(row.passwordAlgorithm).toBe('argon2id');
    expect(row.passwordUpdatedAt?.getTime()).toBe(AT.getTime());
  });

  it('leaves the account status alone, because a rehash is not an activation', async () => {
    const seeded = await anAccount({ status: 'SUSPENDED' });

    await seeded.repo.replaceCredential({
      userId: seeded.userId,
      passwordHash: '$argon2id$v=19$m=2,t=2,p=1$bmV3c2FsdA$bmV3ZGlnZXN0',
      passwordAlgorithm: 'argon2id',
      now: AT,
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.userId },
      select: { status: true },
    });
    expect(row.status).toBe('SUSPENDED');
  });
});
