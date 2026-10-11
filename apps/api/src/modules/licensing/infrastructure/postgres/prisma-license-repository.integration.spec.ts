import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaLicenseRepository } from './prisma-license-repository.js';

/**
 * `PrismaLicenseRepository` against a real PostgreSQL (`PLT-301` T2).
 *
 * ## Why this suite exists
 *
 * The two properties under test belong to the database, not to this class:
 * which rows count as ELIGIBLE (the status filter — a revoked licence must
 * never reach the validator, because a revoked licence that validates is a
 * bypass), and that the envelope travels INTACT through a Json column
 * (`certificate` is `Json` in the schema, so a round trip could reorder,
 * coerce or truncate — and a payload that changes on its way to the
 * canonicaliser is a payload whose signature no longer holds).
 *
 * The Json round trip is why `findEnvelopeForValidation` is tested against a
 * row written through Prisma rather than a literal: the signature ADR-009
 * cares about is over the CANONICAL form, and a Json column is where
 * canonical form meets the database.
 */

let prisma: PrismaClient;
let repo: PrismaLicenseRepository;
let schoolId: string;

const certificate = {
  product: 'EduFlow360',
  edition: 'Deluxe',
  school_id: 'sch_om_muscat_01',
  school_name: 'Muscat International Academy',
  activation_date: '2026-09-01T00:00:00Z',
  expiry_date: '2027-08-31T23:59:59Z',
  allowed_modules: ['academics', 'finance'],
  limits: { maximum_students: 1500 },
  features: { ai_chatbot: true, video_conferencing_provider: 'zoom' },
};

const seed = (status: 'ACTIVE' | 'GRACE' | 'REVOKED' | 'PENDING' | 'EXPIRED' | 'INVALID') =>
  prisma.license.create({
    data: {
      schoolId,
      licenseId: `lic-${randomUUID()}`,
      edition: 'Deluxe',
      certificate,
      signature: 'base64-signature-over-the-canonical-form',
      keyId: 'primary-2026',
      canonicalizationVersion: 1,
      status,
      issuedAt: new Date('2026-09-01T00:00:00.000Z'),
      expiresAt: new Date('2027-08-31T23:59:59.000Z'),
    },
    select: { id: true, licenseId: true },
  });

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. This suite writes real rows.');
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();
  schoolId = randomUUID();
  repo = new PrismaLicenseRepository(prisma, schoolId);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('PrismaLicenseRepository — which row is eligible', () => {
  it('finds the ACTIVE row and hands back the whole envelope', async () => {
    await seed('ACTIVE');

    const found = await repo.findEnvelopeForValidation();

    expect(found).not.toBeNull();
    expect(found?.certificate).toEqual(certificate);
    expect(found?.canonicalisationVersion).toBe(1);
    expect(found?.keyId).toBe('primary-2026');
    expect(found?.signature).toBe('base64-signature-over-the-canonical-form');
  });

  it('cannot hold two rows per school: the schema says so', async () => {
    // One licence per deployment, enforced by the `school_id` UNIQUE — the
    // same single-tenant posture as every other table. The consequence this
    // suite cares about: the "which of several ACTIVE rows wins" question the
    // orderBy answers cannot arise here, and a repository that silently
    // picked one would be a repository nobody needed.
    await seed('ACTIVE');

    await expect(seed('GRACE')).rejects.toThrow(/Unique constraint/);
  });

  it('finds a GRACE row, because grace is still a live certificate', async () => {
    // `PLT-305` owns what grace MEANS; the validator only needs the row so it
    // can decide expiry from the certificate's own dates. (One row per school,
    // so this test seeds only GRACE.)
    await seed('GRACE');

    expect(await repo.findEnvelopeForValidation()).not.toBeNull();
  });

  it('does NOT find a REVOKED row, which is the whole point of the filter', async () => {
    // A revoked licence that validates is a bypass: the signature is still
    // genuine — the licence was real when issued. Status is what retires it,
    // and the status filter is where that is enforced.
    await seed('REVOKED');

    expect(await repo.findEnvelopeForValidation()).toBeNull();
  });

  it('does not find a PENDING, INVALID or REVOKED row as the active one', async () => {
    // Each status is seeded into its OWN school, because one licence per
    // school is a schema constraint. PENDING is un-activated and INVALID is a
    // known-bad certificate — neither must reach the validator, or a
    // known-bad row would be re-judged on every boot until someone removed it.
    for (const status of ['PENDING', 'INVALID', 'REVOKED'] as const) {
      const thisSchool = randomUUID();
      const thisRepo = new PrismaLicenseRepository(prisma, thisSchool);
      await prisma.license.create({
        data: {
          schoolId: thisSchool,
          licenseId: `lic-${randomUUID()}`,
          edition: 'Deluxe',
          certificate,
          signature: 'base64-signature',
          keyId: 'primary-2026',
          canonicalizationVersion: 1,
          status,
          issuedAt: new Date('2026-09-01T00:00:00.000Z'),
          expiresAt: new Date('2027-08-31T23:59:59.000Z'),
        },
        select: { licenseId: true },
      });

      expect(await thisRepo.findEnvelopeForValidation()).toBeNull();
    }
  });

  it('returns null when the deployment has no licence at all', async () => {
    expect(await repo.findEnvelopeForValidation()).toBeNull();
  });

  it('never returns another school row, though they share the table', async () => {
    // `ADR-003` makes isolation physical; this proves the metadata stamp is
    // still correct, because a licence from the wrong school would grant
    // entitlements to the wrong school.
    const otherSchool = new PrismaLicenseRepository(prisma, randomUUID());
    await seed('ACTIVE');

    expect(await otherSchool.findEnvelopeForValidation()).toBeNull();
  });
});

describe('PrismaLicenseRepository — stamping the validation instant', () => {
  it('records when the certificate was last validated', async () => {
    // `PLT-305`'s grace countdown and the health endpoint both read this.
    const created = await seed('ACTIVE');
    const now = new Date('2026-10-11T09:00:00.000Z');

    await repo.stampValidatedAt({ licenceId: created.licenseId, now });

    const row = await prisma.license.findUniqueOrThrow({
      where: { id: created.id },
      select: { lastValidatedAt: true },
    });
    expect(row.lastValidatedAt?.getTime()).toBe(now.getTime());
  });
});
