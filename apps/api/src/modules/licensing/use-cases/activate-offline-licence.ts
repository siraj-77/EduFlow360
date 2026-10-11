import type { IClock } from '../../auth/domain/ports/clock.js';
import type {
  ILicenceRepository,
  LicenceEnvelopeRecord,
} from '../domain/repositories/license-repository.js';
import type {
  ValidateLicenceCertificate,
  ValidateLicenceInput,
} from './validate-licence-certificate.js';
import type { ILicencePayloadCache } from '../domain/ports/licence-payload-cache.js';

/**
 * `ActivateOfflineLicence` — `PLT-304`'s engine: a `.lic` file becomes a
 * stored certificate and a live cache.
 *
 * ## The shape of the offline path
 *
 * A school at an air-gapped site cannot reach an activation server. The
 * exchange is manual: the vendor hands over a signed certificate, an
 * administrator uploads it, the school runs. The acceptance criterion is that
 * this activates the school "exactly as the online path would, with identical
 * validation rigour" — and the rigour is identical because it is the SAME
 * validator the boot refresh runs (`ValidateLicenceCertificate`). What this
 * use-case adds is the three things validation alone does not do: bind the
 * certificate to THIS deployment, persist it, and refresh the cache so the
 * change is visible on the next request rather than the next restart.
 *
 * ## Why the school binding lives here
 *
 * The validator judges a certificate on its own terms — signed, in date,
 * parseable. Whether it belongs to this deployment is a different question,
 * answerable only where the deployment's own `SCHOOL_ID` is known. A valid
 * certificate naming another school must be refused, or any school's licence
 * would activate anywhere.
 *
 * ## Why a replacement is allowed at all
 *
 * One row per school, so activating over an existing licence REPLACES it —
 * a renewal, not a second key. The replaced certificate stays in the audit
 * trail (`@Audited('LICENCE_ACTIVATION')` on the route), which is what makes
 * the replacement reviewable rather than silent.
 */

export interface ActivateOfflineLicenceDeps {
  readonly licenses: ILicenceRepository;
  readonly validator: ValidateLicenceCertificate;
  readonly cache: ILicencePayloadCache;
  readonly clock: IClock;
  /** This deployment's school, from `SCHOOL_ID`. */
  readonly schoolId: string;
}

/** The `.lic` file, parsed — the same envelope the validator reads. */
export interface ActivationEnvelope {
  readonly certificate: unknown;
  readonly canonicalisationVersion: number;
  readonly keyId: string;
  readonly signature: string;
}

export type ActivationOutcome =
  | { readonly outcome: 'activated' }
  | { readonly outcome: 'school-mismatch' }
  /** The validator refused, in whichever way it did. Named, never detailed. */
  | { readonly outcome: 'refused'; readonly reason: string }
  /** The row could not be stored. Nothing was unlocked. */
  | { readonly outcome: 'storage-failed'; readonly reason: string };

export class ActivateOfflineLicence {
  constructor(private readonly deps: ActivateOfflineLicenceDeps) {}

  async activate(params: { readonly certificate: ActivationEnvelope }): Promise<ActivationOutcome> {
    const now = this.deps.clock.now();

    const input: ValidateLicenceInput = { certificate: params.certificate, now };
    const verdict = this.deps.validator.validate(input);

    // ── The validator's verdict, first: no storage, no cache, no unlock ────
    if (verdict.outcome !== 'valid') {
      return { outcome: 'refused', reason: verdict.outcome };
    }

    // ── The binding: this deployment's school, and only its own ───────────
    if (verdict.payload.schoolId !== this.deps.schoolId) {
      return { outcome: 'school-mismatch' };
    }

    // ── The store, which is what makes it survive a restart ────────────────
    let licenceId: string;
    try {
      const stored = await this.deps.licenses.activate({
        schoolId: this.deps.schoolId,
        certificate: params.certificate.certificate,
        signature: params.certificate.signature,
        keyId: params.certificate.keyId,
        canonicalisationVersion: params.certificate.canonicalisationVersion,
        status: 'ACTIVE',
        activatedAt: now,
        expiresAt: verdict.payload.expiryDate,
      });
      licenceId = stored.licenceId;
    } catch (cause) {
      // A failed write means nothing was unlocked, and the answer must not
      // imply otherwise: an administrator who is told "activated" and then
      // finds the guard still refusing has a broken system and no clue.
      return {
        outcome: 'storage-failed',
        reason: cause instanceof Error ? cause.message : String(cause),
      };
    }

    // ── The cache, which is what makes it IMMEDIATE ───────────────────────
    this.deps.cache.remember({
      outcome: 'valid',
      payload: verdict.payload,
      validatedAt: now,
      // A freshly activated certificate has not lapsed, so it carries no
      // countdown. (A certificate already expired at activation is refused
      // by the validator above — the `expired` verdict — so an activation
      // inside grace is impossible, and inventing a countdown for one would
      // be inventing a state.)
      graceUntil: null,
    });

    // The stamp is best-effort here for the same reason as the refresh path:
    // a stamp failure must not undo a certificate that was stored.
    try {
      await this.deps.licenses.stampValidatedAt({ licenceId, now });
    } catch (cause) {
      console.error(
        `ActivateOfflineLicence could not stamp lastValidatedAt for licence ${licenceId}: ` +
          `${cause instanceof Error ? cause.message : String(cause)}. The activation stands.`,
      );
    }

    return { outcome: 'activated' };
  }
}

/** What the repository's `activate` persists, for readability at the call site. */
export type ActivationRecord = Parameters<ILicenceRepository['activate']>[0];
/** What it holds afterwards, so the caller can stamp without a re-read. */
export type ActivationRecordResult = Awaited<ReturnType<ILicenceRepository['activate']>>;

export type { LicenceEnvelopeRecord };
