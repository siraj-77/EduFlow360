import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decideEmailDomain } from '../../domain/services/allowed-email-domain.js';
import { PrismaAllowedEmailDomainStore } from './prisma-allowed-email-domain-store.js';

/**
 * The allowlist reader, proved against a real PostgreSQL.
 *
 * The unit spec proves the RULE. This proves the two things a fake cannot:
 *
 *  - **that `null` survives the round trip as `null`.** A `Json?` column read
 *    back is the whole input to `decideEmailDomain`, and the difference between
 *    "unconfigured" and "configured empty" is decided by that value. A stub
 *    repository returns whatever the test hands it, so it can only ever confirm
 *    what the test already believed.
 *  - **that a school with no settings row at all is LOCKED.** This is the state
 *    a freshly provisioned database is in, and it is the one a schema-level or
 *    in-memory test cannot produce because it does not exist in a fixture.
 *
 * Every assertion goes through the store and then through the rule. Prisma
 * appears only to WRITE and to READ BACK raw, so the store is the thing under
 * test and nothing here reads the column directly to decide an outcome.
 */
let prisma: PrismaClient;

/** A school whose single settings row carries the given stored value verbatim. */
async function aSchoolWith(allowlist: Prisma.InputJsonValue | null): Promise<string> {
  const schoolId = randomUUID();
  await prisma.schoolSettings.create({
    data: {
      schoolId,
      name: 'Test School',
      timezone: 'Asia/Colombo',
      defaultLocale: 'en',
      currencyCode: 'LKR',
      minorUnitScale: 2,
      roundingMode: 'HALF_UP',
      academicYearStartMonth: 1,
      settings: {},
      // Spread conditionally rather than assigned `undefined`: the column is
      // nullable, and `exactOptionalPropertyTypes` makes an explicit undefined
      // a different thing from an absent property.
      ...(allowlist === null ? {} : { allowedEmailDomains: allowlist }),
    },
  });
  return schoolId;
}

/** A school with NO settings row at all — the state a new database is in. */
async function aSchoolWithoutSettings(): Promise<string> {
  return randomUUID();
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite needs a real PostgreSQL: the claim under test is ' +
        'that a NULL in a nullable jsonb column stays distinguishable from a configured empty ' +
        'list after the round trip, and a stub repository cannot demonstrate a round trip.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('reading the allowlist', () => {
  it('permits an address in the configured domain', async () => {
    const schoolId = await aSchoolWith(['school.lk']);
    const store = new PrismaAllowedEmailDomainStore(prisma, schoolId);

    const decision = decideEmailDomain({
      allowlist: await store.readAllowlist(),
      email: 'teacher@school.lk',
    });

    expect(decision).toEqual({ allowed: true, domain: 'school.lk' });
  });

  it('returns the stored value verbatim, leaving normalisation to the rule', async () => {
    // The layer boundary, asserted. A reader that tidied the value on the way
    // out would mean two places that know what a domain looks like, and they
    // would disagree about it — which is how 'evilmicrosoft.com' gets in.
    const schoolId = await aSchoolWith(['  SCHOOL.LK.  ', 'not a domain']);
    const store = new PrismaAllowedEmailDomainStore(prisma, schoolId);

    expect(await store.readAllowlist()).toEqual(['  SCHOOL.LK.  ', 'not a domain']);
  });

  it('still permits the address, because the rule normalises on both sides', async () => {
    const schoolId = await aSchoolWith(['  SCHOOL.LK.  ']);
    const store = new PrismaAllowedEmailDomainStore(prisma, schoolId);

    expect(
      decideEmailDomain({ allowlist: await store.readAllowlist(), email: 'T@School.LK' }),
    ).toEqual({ allowed: true, domain: 'school.lk' });
  });
});

describe('an unconfigured school is locked', () => {
  // `D49`: fail-closed when empty. These are the three states a real
  // deployment can be in before an administrator has configured anything, and
  // all three must permit nothing.
  const NOT_CONFIGURED: ReadonlyArray<readonly [string, () => Promise<string>]> = [
    ['no settings row at all', aSchoolWithoutSettings],
    ['a settings row with a null allowlist', () => aSchoolWith(null)],
    ['a settings row with an empty list', () => aSchoolWith([])],
  ];

  it.each(NOT_CONFIGURED)('permits nothing when the school has %s', async (_label, arrange) => {
    const store = new PrismaAllowedEmailDomainStore(prisma, await arrange());
    const allowlist = await store.readAllowlist();

    for (const email of [
      'teacher@school.lk',
      'head@royalcollege.lk',
      'parent@gmail.com',
      'not-an-address',
    ]) {
      expect(decideEmailDomain({ allowlist, email }), `${email} must be refused`).toEqual({
        allowed: false,
        reason: 'allowlist-not-configured',
      });
    }
  });

  it('says so for a school with no settings row, rather than reporting a data fault', async () => {
    // A brand-new database has no row at all, and that is the most common
    // unconfigured state there is. Reporting it as `allowlist-malformed` would
    // send an administrator looking for corruption that does not exist.
    const store = new PrismaAllowedEmailDomainStore(prisma, await aSchoolWithoutSettings());

    expect(
      decideEmailDomain({ allowlist: await store.readAllowlist(), email: 'a@school.lk' }),
    ).toEqual({ allowed: false, reason: 'allowlist-not-configured' });
  });

  it('keeps a locked school locked after an administrator adds a second school', async () => {
    // One database per school, so this is two schools only because the tests
    // share one database. The point is that configuring one must not unblock
    // the other, which a lookup that forgot `schoolId` would do immediately.
    const locked = await aSchoolWith(null);
    const configured = await aSchoolWith(['academy.ac.lk']);

    const lockedStore = new PrismaAllowedEmailDomainStore(prisma, locked);
    const configuredStore = new PrismaAllowedEmailDomainStore(prisma, configured);

    expect(
      decideEmailDomain({
        allowlist: await configuredStore.readAllowlist(),
        email: 'a@academy.ac.lk',
      }),
    ).toEqual({ allowed: true, domain: 'academy.ac.lk' });
    expect(
      decideEmailDomain({ allowlist: await lockedStore.readAllowlist(), email: 'a@academy.ac.lk' }),
      "the first school's own list must not be widened by the second school",
    ).toEqual({ allowed: false, reason: 'allowlist-not-configured' });
  });
});

describe('what the column will accept', () => {
  it('stores a list of mixed-cased entries that round-trip unchanged', async () => {
    // The adversarial spelling, end to end through the database: an operator
    // typing `@School.LK.` and a provider sending `T@school.lk` must meet.
    const schoolId = await aSchoolWith(['@School.LK.', 'xn--80ak6aa92e.com']);
    const store = new PrismaAllowedEmailDomainStore(prisma, schoolId);

    const stored = await store.readAllowlist();
    expect(stored).toEqual(['@School.LK.', 'xn--80ak6aa92e.com']);
    expect(decideEmailDomain({ allowlist: stored, email: 'teacher@school.lk' })).toEqual({
      allowed: true,
      domain: 'school.lk',
    });
  });

  it('refuses a suffix of a configured domain, read straight from the column', async () => {
    // The account-takeover shape, proved against the real column rather than a
    // fixture: a school that has configured `microsoft.com` must not admit
    // `evilmicrosoft.com`, and neither spelling of that address may be
    // accepted by an equality rule that was written by accident as a suffix.
    const schoolId = await aSchoolWith(['microsoft.com']);
    const store = new PrismaAllowedEmailDomainStore(prisma, schoolId);

    expect(
      decideEmailDomain({
        allowlist: await store.readAllowlist(),
        email: 'attacker@evilmicrosoft.com',
      }),
    ).toEqual({ allowed: false, reason: 'domain-not-permitted' });
    expect(
      decideEmailDomain({
        allowlist: await store.readAllowlist(),
        email: 'attacker@MICROSOFT.com',
      }),
    ).toEqual({ allowed: true, domain: 'microsoft.com' });
  });

  it('holds a list that is not strings, and the rule refuses rather than trusting it', async () => {
    // `Json` constrains nothing, which is the cost recorded on the column. This
    // is that cost being paid: the row accepts nonsense, and the reader is the
    // only thing standing between it and an authorisation decision.
    const schoolId = await aSchoolWith([42, { nested: true }]);
    const store = new PrismaAllowedEmailDomainStore(prisma, schoolId);

    expect(
      decideEmailDomain({ allowlist: await store.readAllowlist(), email: 'a@school.lk' }),
    ).toEqual({ allowed: false, reason: 'allowlist-not-configured' });
  });

  it('carries no database default, so a row nobody configured reads as null', async () => {
    // Asserted against the catalog rather than the schema text, because a
    // `DEFAULT` is applied by PostgreSQL and not visible in the generated
    // schema a reader would check. This is what makes an existing deployment
    // come up LOCKED rather than "everyone is allowed", and it is the reason
    // the column carries no `@default`.
    const columns = await prisma.$queryRawUnsafe<{ column_default: string | null }[]>(
      "select column_default from information_schema.columns where table_name = 'school_settings' and column_name = 'allowed_email_domains'",
    );

    expect(columns).toHaveLength(1);
    expect(columns[0]?.column_default, 'a default here is a value nobody typed').toBeNull();
  });

  it('leaves the column nullable, so "not configured" is representable at all', async () => {
    const columns = await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
      "select is_nullable from information_schema.columns where table_name = 'school_settings' and column_name = 'allowed_email_domains'",
    );

    expect(columns).toHaveLength(1);
    expect(columns[0]?.is_nullable).toBe('YES');
  });
});
