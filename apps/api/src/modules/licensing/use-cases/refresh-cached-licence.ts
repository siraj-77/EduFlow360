import type { IClock } from '../../auth/domain/ports/clock.js';
import type { ILicenceRepository } from '../domain/repositories/license-repository.js';
import type {
  ValidateLicenceCertificate,
  ValidateLicenceInput,
} from './validate-licence-certificate.js';
import type {
  ILicencePayloadCache,
  LicenceCacheState,
} from '../domain/ports/licence-payload-cache.js';

/**
 * `RefreshCachedLicence` — read the certificate, judge it, remember the
 * judgement (`PLT-301` T2; the input `PLT-302`'s guard consumes on every
 * request).
 *
 * ## Why this is a use-case and not part of the guard
 *
 * The guard must not do I/O. `PLT-302` runs on every route, and a guard that
 * read the database (or spent two milliseconds verifying a signature) would
 * put both in front of every request in the product. The verdict is computed
 * here, once at boot and again on `PLT-305`'s schedule, and the guard reads a
 * single in-memory state — which also means the read failure paths are
 * reachable without a request, which is where they belong.
 *
 * ## Why every branch writes the cache
 *
 * Including the failures. A cache left untouched by a failed refresh answers
 * whatever it held before, so a certificate revoked at 09:00 and refreshed
 * at 09:01 would keep granting entitlements from 09:00's payload until the
 * next SUCCESSFUL refresh — a licence that was revoked would stay live for
 * as long as the next failure lasted. Every outcome therefore overwrites the
 * state, and `ADR-009`'s "never a crash, never a silent bypass" is what that
 * buys.
 */

export interface RefreshCachedLicenceDeps {
  readonly licenses: ILicenceRepository;
  /** The real validator; the port is structural so a test need not build a key. */
  readonly validator: ValidateLicenceCertificate;
  readonly clock: IClock;
}

export class RefreshCachedLicence {
  constructor(private readonly deps: RefreshCachedLicenceDeps) {}

  /** Re-validate whatever licence this deployment holds, and remember the verdict. */
  async refresh(cache: ILicencePayloadCache): Promise<LicenceCacheState> {
    const now = this.deps.clock.now();
    let state: LicenceCacheState;

    let record;
    try {
      record = await this.deps.licenses.findEnvelopeForValidation();
    } catch (cause) {
      // Boot continues. `ADR-009`: never a crash, never a silent bypass — a
      // database that cannot be read is an `absent` state the health endpoint
      // reports, not an exception that takes the application down.
      state = {
        outcome: 'absent',
        reason: `the licence could not be read: ${cause instanceof Error ? cause.message : String(cause)}`,
        validatedAt: now,
      };
      cache.remember(state);
      return state;
    }

    if (record === null) {
      state = { outcome: 'absent', reason: 'no licence row', validatedAt: now };
      cache.remember(state);
      return state;
    }

    const input: ValidateLicenceInput = {
      certificate: {
        certificate: record.certificate,
        canonicalisationVersion: record.canonicalisationVersion,
        keyId: record.keyId,
        signature: record.signature,
      },
      now,
    };

    const verdict = this.deps.validator.validate(input);

    switch (verdict.outcome) {
      case 'valid':
        state = { outcome: 'valid', payload: verdict.payload, validatedAt: now };
        break;
      case 'expired':
        state = { outcome: 'expired', payload: verdict.payload, validatedAt: now };
        break;
      case 'schema-error':
        state = { outcome: 'schema-error', reason: verdict.reason, validatedAt: now };
        break;
      case 'invalid-signature':
        state = { outcome: 'invalid-signature', validatedAt: now };
        break;
      case 'unsupported-scheme':
        state = { outcome: 'unsupported-scheme', version: verdict.version, validatedAt: now };
        break;
    }

    cache.remember(state);

    // The success stamp is best-effort by design: a stamp failure must not
    // undo a verdict the guard is about to rely on, and `PLT-305`'s grace
    // window reads the row's expiry, not this timestamp, when it disagrees.
    if (state.outcome === 'valid') {
      try {
        await this.deps.licenses.stampValidatedAt({ licenceId: record.licenceId, now });
      } catch (cause) {
        console.error(
          `RefreshCachedLicence could not stamp lastValidatedAt for licence ${record.licenceId}: ` +
            `${cause instanceof Error ? cause.message : String(cause)}. The verdict is unaffected.`,
        );
      }
    }

    return state;
  }
}
