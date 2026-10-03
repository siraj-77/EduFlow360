import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaExternalIdentityRepository } from './prisma-external-identity-repository.js';

/**
 * `IExternalIdentityRepository`, against a real PostgreSQL.
 *
 * ## Why this cannot be a unit test with a fake
 *
 * The claim under test is about **what the database will and will not allow**:
 *
 * - `(provider, subject)` is unique in the schema, and a fake would happily hold two
 *   rows for one pair — which is precisely the state that makes an identity
 *   ambiguous.
 * - `link` must NOT re-point an existing identity. A fake's `link` returns whatever
 *   the test tells it to, so "it returned `already-linked-elsewhere`" proves only
 *   that the test asked for that answer.
 *
 * `database-contract.integration.spec.ts` already proved the unique constraint
 * exists. This file proves the **repository honours it**, which is a different claim
 * about a different piece of code.
 *
 * ## Every assertion goes through the repository
 *
 * Direct Prisma reads are used only to inspect the resulting rows — never to perform
 * the operation under test. A test that writes with Prisma and asserts with the
 * repository would pass even if the repository did nothing.
 */
const SCHOOL_ID = randomUUID();

let prisma: PrismaClient;
let repo: PrismaExternalIdentityRepository;

async function aUser(): Promise<string> {
  return (
    await prisma.user.create({
      data: {
        schoolId: SCHOOL_ID,
        email: `identity-${randomUUID()}@example.test`,
        username: `identity-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;
}

const aSubject = (): string => `sub-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    // Refusing to skip is the rule the rest of this repository follows: a skipped
    // test that reports success is the defect class `AUD-30-02` removed from the
    // integration gate.
    throw new Error(
      'DATABASE_URL is not set. This suite talks to a real PostgreSQL because the claim under ' +
        'test is what the SCHEMA will allow, and a fake repository proves nothing about that.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
  repo = new PrismaExternalIdentityRepository(prisma, SCHOOL_ID);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('finding an identity by subject', () => {
  it('returns the account the identity is bound to', async () => {
    const userId = await aUser();
    const subject = aSubject();
    await repo.link({ userId, provider: 'google', subject, email: null, emailVerified: null });

    const found = await repo.findBySubject('google', subject);

    expect(found).toMatchObject({ userId, provider: 'google', subject });
  });

  it('returns null for a subject nobody has linked', async () => {
    // `null` is the answer that decides D57: no match means refuse the sign-in,
    // never create a User.
    expect(await repo.findBySubject('google', aSubject())).toBeNull();
  });

  it('is scoped by provider, so two providers may issue the same subject', async () => {
    // `provider` is a COLUMN (owner decision, 2026-09-30: "Google first, more
    // providers expected"), so a second provider is a row and not a migration. That
    // only holds if the lookup names the provider.
    const userId = await aUser();
    const subject = aSubject();
    await repo.link({ userId, provider: 'google', subject, email: null, emailVerified: null });

    expect(await repo.findBySubject('microsoft', subject)).toBeNull();
    expect(await repo.findBySubject('google', subject)).not.toBeNull();
  });

  it('never finds one account by another account email, even though the email is stored', async () => {
    // The `AGENTS.md` 2.13 rule, exercised through the repository this time: the
    // address is written on link and is NOT a lookup key, so two people who share
    // one address stay two identities pointing at two accounts.
    const alice = await aUser();
    const bob = await aUser();
    const shared = `shared-${randomUUID()}@example.test`;

    await repo.link({
      userId: alice,
      provider: 'google',
      subject: aSubject(),
      email: shared,
      emailVerified: true,
    });
    await repo.link({
      userId: bob,
      provider: 'google',
      subject: aSubject(),
      email: shared,
      emailVerified: true,
    });

    const rows = await prisma.externalIdentity.findMany({
      where: { schoolId: SCHOOL_ID, providerEmail: shared },
      select: { userId: true },
    });

    // Both rows exist, bound to different accounts, with no unique index on the
    // email anywhere in the way.
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.userId))).toEqual(new Set([alice, bob]));
  });
});

describe('linking an identity', () => {
  it('writes the row and reports `linked`', async () => {
    const userId = await aUser();
    const subject = aSubject();

    const outcome = await repo.link({
      userId,
      provider: 'google',
      subject,
      email: `link-${randomUUID()}@school.test`,
      emailVerified: true,
    });

    expect(outcome).toEqual({ outcome: 'linked' });
    expect(
      await prisma.externalIdentity.count({
        where: { schoolId: SCHOOL_ID, provider: 'google', providerSubject: subject },
      }),
    ).toBe(1);
  });

  it('records the email and the provider-s claim as snapshots, not as authority', async () => {
    const userId = await aUser();
    const subject = aSubject();
    const email = `snap-${randomUUID()}@school.test`;

    await repo.link({ userId, provider: 'google', subject, email, emailVerified: false });

    const row = await prisma.externalIdentity.findFirstOrThrow({
      where: { schoolId: SCHOOL_ID, providerSubject: subject },
      select: { providerEmail: true, providerEmailVerified: true },
    });
    expect(row).toEqual({ providerEmail: email, providerEmailVerified: false });
  });

  it('accepts a provider that asserted no email at all', async () => {
    // `null` must be representable: "the provider said nothing" is a different
    // fact from "the provider said false", and collapsing them loses a distinction
    // `oidc-provider.ts` goes out of its way to keep.
    const userId = await aUser();
    const subject = aSubject();

    expect(
      await repo.link({ userId, provider: 'google', subject, email: null, emailVerified: null }),
    ).toEqual({ outcome: 'linked' });
  });

  it('reports `already-linked` for the SAME account, and changes nothing', async () => {
    // Idempotence. A user who re-runs "connect Google" must not get an error, and
    // must not get a second row.
    const userId = await aUser();
    const subject = aSubject();
    await repo.link({
      userId,
      provider: 'google',
      subject,
      email: 'first@school.test',
      emailVerified: true,
    });

    const outcome = await repo.link({
      userId,
      provider: 'google',
      subject,
      email: 'second@school.test',
      emailVerified: true,
    });

    expect(outcome).toEqual({ outcome: 'already-linked' });
    // The snapshot is NOT refreshed. That is deliberate and worth stating: the
    // stored address is what the provider said at LINK time, and rewriting it on
    // every re-link would turn a historical record into a live one.
    expect(
      await prisma.externalIdentity.findFirstOrThrow({
        where: { schoolId: SCHOOL_ID, providerSubject: subject },
        select: { providerEmail: true },
      }),
    ).toEqual({ providerEmail: 'first@school.test' });
  });

  it('REFUSES to re-point an identity already bound to another account', async () => {
    // THE decision. An `upsert` here would be silent account takeover: the attacker
    // links their own Google, then re-links it onto the victim's account, and from
    // then on the attacker signs in as the victim.
    const victim = await aUser();
    const attacker = await aUser();
    const subject = aSubject();
    await repo.link({
      userId: attacker,
      provider: 'google',
      subject,
      email: 'attacker@school.test',
      emailVerified: true,
    });

    const outcome = await repo.link({
      userId: victim,
      provider: 'google',
      subject,
      email: 'victim@school.test',
      emailVerified: true,
    });

    expect(outcome).toEqual({ outcome: 'already-linked-elsewhere' });
    // And the row still points at the attacker's account, byte for byte.
    expect(await repo.findBySubject('google', subject)).toMatchObject({ userId: attacker });
  });

  it('lets exactly one of two concurrent links win, and never writes two rows', async () => {
    // The race the read-then-write in `link` opens. `Promise.all` on one connection
    // pool issues both reads before either write lands, so both can see "no row".
    // The schema's unique constraint is what settles it.
    const alice = await aUser();
    const bob = await aUser();
    const subject = aSubject();
    const params = { provider: 'google', subject, email: null, emailVerified: null };

    const outcomes = await Promise.all([
      repo.link({ userId: alice, ...params }),
      repo.link({ userId: bob, ...params }),
    ]);

    expect(outcomes.filter((o) => o.outcome === 'linked')).toHaveLength(1);
    expect(
      await prisma.externalIdentity.count({
        where: { schoolId: SCHOOL_ID, providerSubject: subject },
      }),
    ).toBe(1);
  });
});

describe('isolation between schools', () => {
  it('never sees another school-s identity for the same subject', async () => {
    // `AGENTS.md` 2.1 makes isolation physical, so this is really about the
    // `schoolId` predicate being present — which is what the composite unique key
    // needs and what keeps a second school's test data out of this one.
    const otherSchool = randomUUID();
    const otherRepo = new PrismaExternalIdentityRepository(prisma, otherSchool);
    const subject = aSubject();
    const elsewhere = (
      await prisma.user.create({
        data: {
          schoolId: otherSchool,
          email: `elsewhere-${randomUUID()}@example.test`,
          username: `elsewhere-${randomUUID()}`,
        },
        select: { id: true },
      })
    ).id;
    await otherRepo.link({
      userId: elsewhere,
      provider: 'google',
      subject,
      email: null,
      emailVerified: null,
    });

    expect(await repo.findBySubject('google', subject)).toBeNull();
  });
});
