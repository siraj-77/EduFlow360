/**
 * Reading the deployment's certificate (`PLT-301` T2).
 *
 * ## Why the method returns the ENVELOPE and not a parsed payload
 *
 * Validation is `ValidateLicenceCertificate`'s job, and it needs the raw
 * material to verify — the payload as stored, the signature, the scheme
 * version, the key id. A repository that parsed first would either (a)
 * duplicate the payload schema here, or (b) hand back a shape the validator
 * cannot re-verify. (a) is duplication and (b) is a validator that cannot
 * verify, so the row travels whole.
 *
 * ## Which rows are eligible, and where that is decided
 *
 * `findEnvelopeForValidation` returns the active, unrevoked certificate for
 * this school — the `REVOKED` filter is the repository's, not here, because
 * "which statuses count as live" is a statement about the licence lifecycle
 * (`PLT-303`/`PLT-305`) that changes more often than this port does.
 */
export const I_LICENCE_REPOSITORY = Symbol('ILicenceRepository');

/** What the validator needs from a stored row: the whole envelope, intact. */
export interface LicenceEnvelopeRecord {
  readonly certificate: unknown;
  readonly canonicalisationVersion: number;
  readonly keyId: string;
  readonly signature: string;
  /** The row's own id, so `stampValidatedAt` can name what it stamped. */
  readonly licenceId: string;
}

export interface ILicenceRepository {
  /** The active, unrevoked certificate for this deployment, or `null`. */
  findEnvelopeForValidation(): Promise<LicenceEnvelopeRecord | null>;

  /**
   * Record that the given certificate was validated at this instant.
   *
   * `PLT-305`'s grace countdown and the health endpoint read it. Written from
   * the refresh use-case rather than the validator so the timestamp means
   * "the system confirmed this", not "somebody parsed it".
   */
  stampValidatedAt(params: { readonly licenceId: string; readonly now: Date }): Promise<void>;

  /**
   * Store a certificate the offline-activation path just validated, and make
   * it the deployment's live one (`PLT-304`).
   *
   * An UPSERT, because one database per school (`ADR-003`) and one licence
   * row per school (the `school_id` UNIQUE) mean a renewal REPLACES rather
   * than accumulates: two live certificates would leave
   * `findEnvelopeForValidation` choosing between them, and a choice nobody
   * specified is a licence nobody can reason about. The replaced row's
   * history is the audit trail's job (`@Audited('LICENCE_ACTIVATION')`).
   *
   * The record arrives whole — envelope fields included — because the boot
   * refresh re-validates from the stored row, and a row that kept only the
   * payload could not be verified.
   */
  activate(
    record: Omit<LicenceEnvelopeRecord, 'licenceId'> & {
      /** The payload's own identifier; the store stamps what the row is keyed by. */
      readonly schoolId: string;
      readonly status: 'ACTIVE';
      readonly activatedAt: Date;
      readonly expiresAt: Date;
    },
  ): Promise<{ readonly licenceId: string }>;
}
