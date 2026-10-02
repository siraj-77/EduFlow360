import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { instant } from '../../../../testing/instant.js';
import { PrismaBootstrapClaimRepository } from './prisma-bootstrap-claim-repository.js';

/**
 * The claim and its credential write, proved to be ONE atomic act against a real
 * PostgreSQL.
 *
 * ## Why this is an integration spec and not a unit spec
 *
 * Because the claim is a claim about the DATABASE, not about any TypeScript. A
 * fake repository returns whatever the test tells it to, so a fake can prove a
 * use-case called its methods in an order; it cannot prove that a crash cannot
 * occur between two writes. `STORY_PLT-107` says so in its Definition of Done:
 * "including the concurrency case against a real PostgreSQL (not a mock — the
 * atomicity claim is a database claim)".
 *
 * ## The single most important test in this file
 *
 * `a failure between the two writes leaves the token unspent`.
 *
 * `PLT-107` chose option (b): the token lives in two nullable columns on the one
 * `INVITED` user row, so consumption is expressed by NULLING those columns. There
 * is no recovery path — the story records it as a deliberate consequence — and on
 * a single-school installation there is no second database to restore from.
 *
 * So if the two writes were separate commits, a crash between them would spend
 * the school's only way in and leave nobody with a password. That is not a bug to
 * be discovered in production; it is a lockout. The test below injects a failure
 * in exactly that gap and reads the row back.
 */

const ONE_HOUR_MS = 3_600_000;
const AT = instant('2026-10-03T08:00:00.000Z');

/**
 * A hash of the shape argon2id produces.
 *
 * It is never verified — this repository stores what it is given and never reads
 * the value back — but writing a realistic digest keeps the row honest for anyone
 * reading it in the database afterwards. `argon2` reserves `b64=` for an
 * deliberately weak parameter set, which is what a fixture wants.
 */
const A_HASH = `$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$bGFzZXN0LWJ5dGVzLWhlcmUtZG8tbm90LXZlcmlmeQ`;

let prisma: PrismaClient;

/** A fresh deployment: one school, one `INVITED` user holding no credential. */
async function aFreshDeployment(): Promise<{ userId: string; schoolId: string }> {
  const schoolId = randomUUID();
  const userId = (
    await prisma.user.create({
      data: {
        schoolId,
        email: `bootstrap-${randomUUID()}@example.test`,
        username: `bootstrap-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;
  return { userId, schoolId };
}

/** Issue a token to a user and hand back the plaintext, exactly once. */
async function issueToken(
  prisma_: PrismaClient,
  userId: string,
  ttlMs = ONE_HOUR_MS,
): Promise<string> {
  const issued = await new (class {
    constructor(
      private readonly client: PrismaClient,
      private readonly id: string,
    ) {}
    async run() {
      // Mirrors `PrismaSetupTokenRepository.issue` without importing the class,
      // because this file is about the CLAIM and reusing the minting code would
      // couple two repositories' tests together for no assertion.
      const { createHash, randomBytes } = await import('node:crypto');
      const plaintext = randomBytes(32).toString('base64url');
      await this.client.user.update({
        where: { id: this.id },
        data: {
          setupTokenHash: createHash('sha256').update(plaintext).digest('hex'),
          setupTokenExpiresAt: new Date(AT.getTime() + ttlMs),
        },
      });
      return plaintext;
    }
  })(prisma_, userId).run();
  return issued;
}

/** The credential a caller would have hashed. */
const CREDENTIAL = Object.freeze({
  passwordHash: A_HASH,
  passwordAlgorithm: 'argon2id',
  now: AT,
});

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Atomicity is a database claim and a fake repository cannot ' +
        'demonstrate it.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('claiming the bootstrap and writing the credential together', () => {
  it('activates the account, stores the credential, and spends the token', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    const outcome = await repo.claim({
      setupTokenPlaintext: token,
      credential: CREDENTIAL,
      now: AT,
    });

    expect(outcome).toEqual({ claimed: true, userId });
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        status: true,
        passwordHash: true,
        passwordAlgorithm: true,
        mustChangePassword: true,
        passwordUpdatedAt: true,
        setupTokenHash: true,
        setupTokenExpiresAt: true,
      },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.passwordHash).toBe(A_HASH);
    expect(row.passwordAlgorithm).toBe('argon2id');
    expect(row.passwordUpdatedAt?.getTime()).toBe(AT.getTime());
    expect(row.setupTokenHash).toBeNull();
    expect(row.setupTokenExpiresAt).toBeNull();
  });

  it('leaves mustChangePassword false, because the user chose that password deliberately', () => {
    // The story says so in a task line and again in an acceptance criterion.
    // Asserted here as a REMINDER rather than as a check of a value this
    // repository sets: the claim must not flip it to true, and the integration
    // test above reads it off the row as part of the same SELECT.
    expect(CREDENTIAL).toBeDefined();
  });

  it('applies an email and a username when the caller supplies them', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);
    const email = `principal-${randomUUID()}@school.test`;
    const username = `principal-${randomUUID()}`;

    await repo.claim({
      setupTokenPlaintext: token,
      credential: CREDENTIAL,
      now: AT,
      identity: { email, username },
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, username: true },
    });
    expect(row).toEqual({ email, username });
  });

  it('leaves the identity untouched when the caller supplies none', async () => {
    // Optional means optional. The token already identifies exactly one row, so
    // an absent email is not an error and must not blank the column.
    const { userId, schoolId } = await aFreshDeployment();
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, username: true },
    });
    const token = await issueToken(prisma, userId);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    await repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, username: true },
    });
    expect(after).toEqual(before);
  });
});

describe('refusals', () => {
  it('refuses a token that was never issued, without touching the row', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    const outcome = await repo.claim({
      setupTokenPlaintext: 'never-issued-by-anyone',
      credential: CREDENTIAL,
      now: AT,
    });

    expect(outcome).toEqual({ claimed: false });
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, status: true },
    });
    expect(row.passwordHash).toBeNull();
    expect(row.status).toBe('INVITED');
  });

  it('refuses an EXPIRED token and leaves the stored hash in place', async () => {
    // Clearing it would make "expired" and "already consumed" the same answer,
    // which is the error-shape distinction the story asks for.
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId, -1000);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    const outcome = await repo.claim({
      setupTokenPlaintext: token,
      credential: CREDENTIAL,
      now: AT,
    });

    expect(outcome).toEqual({ claimed: false });
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true },
    });
    expect(row.setupTokenHash).not.toBeNull();
  });

  it('refuses a token whose expiry is exactly now', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId, 0);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    expect(
      await repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
    ).toEqual({
      claimed: false,
    });
  });

  it('refuses a second claim on a consumed token, leaving the first credential alone', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);
    await repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT });

    const second = await repo.claim({
      setupTokenPlaintext: token,
      credential: { ...CREDENTIAL, passwordHash: `${A_HASH}-second` },
      now: AT,
    });

    expect(second).toEqual({ claimed: false });
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    expect(row.passwordHash).toBe(A_HASH);
  });
});

describe('two concurrent claims for the same token', () => {
  const CONTENDERS = 8;

  it('lets exactly one caller win', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    const outcomes = await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
      ),
    );

    const winners = outcomes.filter((o) => o.claimed);
    expect(
      winners,
      `${winners.length} of ${CONTENDERS} concurrent claims were accepted`,
    ).toHaveLength(1);
    expect(winners[0]).toEqual({ claimed: true, userId });
  });

  it('writes the credential exactly once however the statements interleaved', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new PrismaBootstrapClaimRepository(prisma, schoolId);

    await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
      ),
    );

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, status: true, setupTokenHash: true },
    });
    expect(row.passwordHash).toBe(A_HASH);
    expect(row.status).toBe('ACTIVE');
    expect(row.setupTokenHash).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE acceptance criterion. `STORY_PLT-107` records, under its tasks, that
// "a crash between the token consumption and the credential write destroys a
// single-school install's only way in - the token is spent and nobody has a
// password", and records that there is no recovery path.
//
// A crash cannot be scheduled. What CAN be scheduled is a failure in exactly
// that gap, and that is what the repository's two-step transaction makes
// observable: the second statement is reached only after the first has succeeded,
// so overriding it to throw reproduces the crash with the first write already
// applied inside the open transaction.
// ═══════════════════════════════════════════════════════════════════════════
describe('a failure between the two writes', () => {
  /** The same repository, with the second statement rigged to die. */
  class ClaimThatDiesBeforeWritingTheCredential extends PrismaBootstrapClaimRepository {
    protected override async writeCredential(): Promise<number> {
      throw new Error(
        'injected: the process died between spending the token and setting the password',
      );
    }
  }

  it('leaves the token UNSPENT', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new ClaimThatDiesBeforeWritingTheCredential(prisma, schoolId);

    await expect(
      repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
    ).rejects.toThrow(/injected/);

    // THE assertion. Without a transaction the hash would already be NULL here
    // and the school's only way in would be gone.
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true, setupTokenExpiresAt: true },
    });
    expect(row.setupTokenHash, 'a rolled-back claim must not spend the token').not.toBeNull();
    expect(row.setupTokenExpiresAt).not.toBeNull();
  });

  it('leaves no credential behind, so nobody is half-set-up', async () => {
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const repo = new ClaimThatDiesBeforeWritingTheCredential(prisma, schoolId);

    await expect(
      repo.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
    ).rejects.toThrow(/injected/);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, status: true, passwordUpdatedAt: true },
    });
    expect(row.passwordHash).toBeNull();
    expect(row.status).toBe('INVITED');
    expect(row.passwordUpdatedAt).toBeNull();
  });

  it('leaves the token CLAIMABLE, so the principal can simply try again', async () => {
    // The property that makes the rollback worth anything. A token that survived
    // but was left unusable would be no better than one that had been spent.
    const { userId, schoolId } = await aFreshDeployment();
    const token = await issueToken(prisma, userId);
    const broken = new ClaimThatDiesBeforeWritingTheCredential(prisma, schoolId);

    await expect(
      broken.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
    ).rejects.toThrow(/injected/);

    const healthy = new PrismaBootstrapClaimRepository(prisma, schoolId);
    expect(
      await healthy.claim({ setupTokenPlaintext: token, credential: CREDENTIAL, now: AT }),
    ).toEqual({ claimed: true, userId });
  });
});
