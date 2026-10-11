import type { LicencePayload } from '../../domain/services/licence-payload.js';

/**
 * The cache the entitlements guard reads, and the port for filling it
 * (`PLT-301` T2, `PLT-302` T1).
 *
 * ## Why a port rather than a direct field on the guard
 *
 * The guard (`PLT-302`) is registered globally in `app.module.ts` and reads
 * this on every request. Holding the cache directly would tie the guard to
 * an in-memory adapter forever; the port lets `PLT-602`'s Redis-backed
 * registry (the corpus's "in memory/Redis" wording) take over without the
 * guard noticing, and lets a test supply a fixed state without booting a
 * container.
 *
 * ## The state shape, and why it carries the failure
 *
 * A cached state is either a VALID payload (with the instant it was validated
 * at, which `PLT-305`'s grace countdown runs from) or the reason it could not
 * be. The reason is part of the state so the guard's refusal can name it and
 * the health endpoint can report it — a cache that only held good payloads
 * would make a locked school indistinguishable from a school with no cache.
 */

export const I_LICENCE_PAYLOAD_CACHE = Symbol('ILicencePayloadCache');

/** What the cache holds about the certificate it last validated. */
export type LicenceCacheState =
  | {
      readonly outcome: 'valid';
      readonly payload: LicencePayload;
      readonly validatedAt: Date;
      /**
       * When a LAPSED certificate's grace ends, or `null` when it has not
       * lapsed (`PLT-305`). Carried on the valid state because the state is
       * what grants: a school inside its grace window is still entitled, and
       * this is the countdown the admin banner renders.
       */
      readonly graceUntil: Date | null;
    }
  | {
      readonly outcome: 'expired';
      readonly payload: LicencePayload;
      readonly validatedAt: Date;
    }
  | { readonly outcome: 'schema-error'; readonly reason: string; readonly validatedAt: Date }
  | { readonly outcome: 'invalid-signature'; readonly validatedAt: Date }
  | { readonly outcome: 'unsupported-scheme'; readonly version: number; readonly validatedAt: Date }
  /** A licence row exists but could not be read, or none exists at all. */
  | { readonly outcome: 'absent'; readonly reason: string; readonly validatedAt: Date };

export interface ILicencePayloadCache {
  /** The state as last written, or `null` before the first refresh. */
  current(): LicenceCacheState | null;

  /** Replace the state. The only write — there is no invalidate, by design. */
  remember(state: LicenceCacheState): void;
}
