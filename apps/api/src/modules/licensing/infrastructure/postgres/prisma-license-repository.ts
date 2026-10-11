import type { PrismaClient } from '@prisma/client';
import type {
  ILicenceRepository,
  LicenceEnvelopeRecord,
} from '../../domain/repositories/license-repository.js';

/**
 * `PrismaLicenseRepository` — the deployment's certificate row (`PLT-301` T2).
 *
 * ## The eligibility filter, and why it is here
 *
 * Only `ACTIVE` and `GRACE` rows are eligible. Everything else is a row that
 * must NOT reach the validator:
 *
 * - **`REVOKED`** is the load-bearing exclusion. A revoked licence carries a
 *   perfectly genuine signature — it was real when issued — so validation
 *   alone would accept it forever. Status is the retirement mechanism, and
 *   this filter is where it is enforced (`AGENTS.md` §2.3: fail closed).
 * - **`PENDING`** is un-activated: nobody has redeemed it yet.
 * - **`EXPIRED`** and **`INVALID`** are terminal records kept for audit; a
 *   validator cannot re-judge either, and re-judging a known-INVALID row on
 *   every boot is how a bad certificate becomes a habit.
 *
 * The validator then decides expiry from the CERTIFICATE's own dates, which
 * is why an EXPIRED *status* does not need to exclude: the row's status is
 * an administrative marker, the certificate's `expiry_date` is the clock.
 *
 * ## `schoolId`, stamped like every other repository here
 *
 * `ADR-003`: physical isolation makes it metadata, and every statement
 * carries it anyway so a row cannot be attributed to the wrong school.
 */
export class PrismaLicenseRepository implements ILicenceRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  async findEnvelopeForValidation(): Promise<LicenceEnvelopeRecord | null> {
    const row = await this.prisma.license.findFirst({
      where: {
        schoolId: this.schoolId,
        status: { in: ['ACTIVE', 'GRACE'] },
      },
      // Deterministic: when several rows are eligible the answer must not be
      // whichever the engine happened to return first.
      orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
      select: {
        licenseId: true,
        certificate: true,
        signature: true,
        keyId: true,
        canonicalizationVersion: true,
      },
    });

    if (row === null) return null;

    return {
      licenceId: row.licenseId,
      // `certificate` is a `Json` column. The value travels as stored — no
      // re-serialisation, no reordering — because the canonicaliser must see
      // the same VALUE the signer signed, and a Json column is where that
      // value meets the database.
      certificate: row.certificate,
      canonicalisationVersion: row.canonicalizationVersion,
      keyId: row.keyId,
      signature: row.signature,
    };
  }

  async stampValidatedAt(params: {
    readonly licenceId: string;
    readonly now: Date;
  }): Promise<void> {
    await this.prisma.license.update({
      // `school_id` alone is UNIQUE in this schema (one licence per school),
      // so the school names the row on its own. The `licenceId` is carried on
      // the interface so a future multi-licence-per-school deployment changes
      // one line here rather than the port's callers.
      where: { schoolId: this.schoolId },
      data: { lastValidatedAt: params.now },
    });
  }
}
