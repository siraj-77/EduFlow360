import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from '../../../auth/infrastructure/adapters/argon2-password-hasher.js';
import {
  DEFAULT_PASSWORD_HASH_PARAMETERS,
  resolvePasswordHashParameters,
} from '../../domain/services/password-hash-parameters.js';
import { PrismaPasswordHashParameterStore } from './prisma-password-hash-parameter-store.js';

/**
 * The cost-parameter reader, proved against a real PostgreSQL.
 *
 * The unit spec proves the RESOLUTION RULE. This proves the three things a fake
 * cannot:
 *
 *  - **that a `Json?` column round-trips the object intact.** The column
 *    constrains nothing, so numbers can arrive as numbers and strings as
 *    strings, and the reader is the only thing that can tell the difference. A
 *    stub returns whatever the test hands it.
 *  - **that a school with no settings row at all resolves to the documented
 *    default.** This is the state a freshly provisioned database is in, and it
 *    cannot be produced by an in-memory fixture because the row does not exist.
 *  - **that the whole chain agrees.** The last test writes parameters to the
 *    column, reads them back, resolves them, hashes with them and asserts the
 *    costs in the resulting digest. Every link is the real one, so a rename at
 *    any of them — a column, a JSON key, an option name — fails here rather than
 *    in production, where the symptom would be that a school's configured cost
 *    was silently ignored.
 */

let prisma: PrismaClient;

/** A school whose single settings row carries the given value verbatim. */
async function aSchoolWith(parameters: Prisma.InputJsonValue | null): Promise<string> {
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
      ...(parameters === null ? {} : { passwordHashParameters: parameters }),
    },
  });
  return schoolId;
}

/** A school with NO settings row at all — the state a new database is in. */
async function aSchoolWithoutSettings(): Promise<string> {
  return randomUUID();
}

/** Read a school's parameters and resolve them, exactly as a caller would. */
async function resolvedFor(schoolId: string) {
  const store = new PrismaPasswordHashParameterStore(prisma, schoolId);
  return resolvePasswordHashParameters(await store.readParameters());
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite needs a real PostgreSQL: the claim under test is ' +
        'that a Json column round-trips an untyped value and that a missing settings row is ' +
        'resolvable as "not configured", and a stub repository cannot demonstrate either.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('a school that has configured its parameters', () => {
  it('reads them back verbatim, leaving judgement to the rule', async () => {
    // The layer boundary, asserted. A reader that clamped here would put a
    // second, untested opinion about what a usable cost is in the layer that is
    // supposed to know nothing.
    const schoolId = await aSchoolWith({ memoryCost: 8192, timeCost: 1, parallelism: 1 });
    const store = new PrismaPasswordHashParameterStore(prisma, schoolId);

    expect(await store.readParameters()).toEqual({ memoryCost: 8192, timeCost: 1, parallelism: 1 });
  });

  it('resolves them as configured, with nothing replaced', async () => {
    const resolution = await resolvedFor(
      await aSchoolWith({ memoryCost: 8192, timeCost: 1, parallelism: 1 }),
    );

    expect(resolution.origin).toBe('configured');
    expect(resolution.replaced).toEqual([]);
    expect(resolution.parameters).toEqual({ memoryCost: 8192, timeCost: 1, parallelism: 1 });
  });

  it('carries them all the way into the digest argon2 writes', async () => {
    // The chain, end to end, with the real column and the real native binding.
    // A rename of the JSON key, of the resolver's key, or of the argon2 option
    // name breaks exactly here.
    const schoolId = await aSchoolWith({ memoryCost: 1024, timeCost: 2, parallelism: 2 });
    const { parameters } = await resolvedFor(schoolId);
    const hasher = new Argon2PasswordHasher({ currentParameters: parameters });

    const { hash } = await hasher.hash('pw', parameters);
    const costs = hash.split('$')[3] ?? '';

    expect(costs).toContain('m=1024');
    expect(costs).toContain('t=2');
    expect(costs).toContain('p=2');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });
});

describe('a school that has configured nothing', () => {
  // These must all still be able to sign anyone in. The contrast with the
  // allowlist column, where the same three states mean LOCKED, is deliberate
  // and is asserted in the store's own header.
  const NOT_CONFIGURED: ReadonlyArray<readonly [string, () => Promise<string>]> = [
    ['no settings row at all', aSchoolWithoutSettings],
    ['a settings row with a null column', () => aSchoolWith(null)],
    ['a settings row with an empty object', () => aSchoolWith({})],
  ];

  it.each(NOT_CONFIGURED)(
    'falls back to the documented default when it has %s',
    async (_label, arrange) => {
      const resolution = await resolvedFor(await arrange());

      expect(resolution.parameters).toEqual(DEFAULT_PASSWORD_HASH_PARAMETERS);
      // Visible, not silent: a reader must be able to tell "this school chose
      // 19 MiB" from "nobody configured anything".
      expect(resolution.origin).toBe('default');
      expect(resolution.replaced).toEqual(['parallelism', 'memoryCost', 'timeCost']);
    },
  );
});

describe('what the column will accept, because Json constrains nothing', () => {
  // This is the recorded cost of choosing `Json?` over typed columns, being
  // paid: the row takes nonsense, and the rule above it is the only thing
  // standing between that nonsense and a login path.
  const NONSENSE: ReadonlyArray<readonly [string, Prisma.InputJsonValue]> = [
    ['a memory cost of zero', { memoryCost: 0, timeCost: 2, parallelism: 1 }],
    ['negative passes', { memoryCost: 8192, timeCost: -1, parallelism: 1 }],
    ['lanes above 2^24', { memoryCost: 8192, timeCost: 2, parallelism: 16777216 }],
    ['memory below eight times the lanes', { memoryCost: 16, timeCost: 1, parallelism: 4 }],
    ['numbers as strings', { memoryCost: '8192', timeCost: '2', parallelism: '1' }],
    ['an array instead of an object', [8192, 2, 1]],
    ['a bare string', 'm=8192,t=2,p=1'],
    ['a bare number', 8192],
    ['a nested object', { memoryCost: { value: 8192 } }],
    ['unknown keys beside good ones', { hashLength: 64, version: 19 }],
  ];

  it.each(NONSENSE)('resolves %j to something the hasher can use', async (_label, stored) => {
    const resolution = await resolvedFor(await aSchoolWith(stored));

    expect(resolution.parameters.memoryCost).toBeGreaterThanOrEqual(8);
    expect(resolution.parameters.timeCost).toBeGreaterThanOrEqual(1);
    expect(resolution.parameters.parallelism).toBeGreaterThanOrEqual(1);
    expect(resolution.parameters.memoryCost).toBeGreaterThanOrEqual(
      8 * resolution.parameters.parallelism,
    );
  });

  it("honours unknown keys' presence without letting them reach the parameters", async () => {
    // A settings blob shared with a future algorithm must not break today's
    // resolution, and must not leak a key the hasher does not understand.
    const resolution = await resolvedFor(
      await aSchoolWith({ memoryCost: 8192, timeCost: 2, parallelism: 1, hashLength: 64 }),
    );

    expect(resolution.origin).toBe('configured');
    expect(Object.keys(resolution.parameters).sort()).toEqual([
      'memoryCost',
      'parallelism',
      'timeCost',
    ]);
  });
});

describe('one school cannot retune another', () => {
  it('keeps a tuned school tuned when a second school is added', async () => {
    // One database per school in production (`ADR-003`), so two schools here
    // only because the suite shares one database. This is the case that proves
    // the lookup is keyed on `schoolId`: without it, configuring one school
    // silently retunes the other, and every credential in it is re-hashed at a
    // cost nobody chose.
    const cheap = await aSchoolWith({ memoryCost: 8192, timeCost: 1, parallelism: 1 });
    const expensive = await aSchoolWith({ memoryCost: 65536, timeCost: 3, parallelism: 1 });

    expect((await resolvedFor(cheap)).parameters).toEqual({
      memoryCost: 8192,
      timeCost: 1,
      parallelism: 1,
    });
    expect((await resolvedFor(expensive)).parameters).toEqual({
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  });

  it('leaves an unconfigured school on the default when another is configured', async () => {
    const configured = await aSchoolWith({ memoryCost: 1024, timeCost: 2, parallelism: 2 });
    const unconfigured = await aSchoolWithoutSettings();

    await resolvedFor(configured);
    expect((await resolvedFor(unconfigured)).parameters).toEqual(DEFAULT_PASSWORD_HASH_PARAMETERS);
  });
});

describe('what the column looks like in the catalog', () => {
  it('leaves the column nullable, so "not configured" is representable at all', async () => {
    const columns = await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
      "select is_nullable from information_schema.columns where table_name = 'school_settings' and column_name = 'password_hash_parameters'",
    );

    expect(columns).toHaveLength(1);
    expect(columns[0]?.is_nullable).toBe('YES');
  });

  it('carries no database default, so a row nobody configured reads as null', async () => {
    // Asserted against the catalog rather than the schema text, because a
    // `DEFAULT` is applied by PostgreSQL and is invisible in the generated
    // schema a reader would check. This is what makes an unconfigured school
    // come up on the documented default rather than on a value nobody typed.
    const columns = await prisma.$queryRawUnsafe<{ column_default: string | null }[]>(
      "select column_default from information_schema.columns where table_name = 'school_settings' and column_name = 'password_hash_parameters'",
    );

    expect(columns).toHaveLength(1);
    expect(columns[0]?.column_default, 'a default here is a value nobody typed').toBeNull();
  });
});
