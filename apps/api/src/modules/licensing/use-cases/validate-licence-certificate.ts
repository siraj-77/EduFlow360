import {
  CANONICALISATION_VERSION,
  canonicaliseLicenceMaterial,
} from '../domain/services/canonical-json.js';
import { parseLicencePayload, type LicencePayload } from '../domain/services/licence-payload.js';
import type { ILicenceSignatureVerifier } from '../domain/ports/licence-signature-verifier.js';

/**
 * `ValidateLicenceCertificate` — the certificate's verdict (`PLT-301` T1).
 *
 * ## The order, and why each step is where it is
 *
 *   1. **The envelope's shape.** What was even presented: a payload, a scheme
 *      version, a key id, a signature. A missing piece is a schema error, not
 *      a signature failure — nothing was offered to verify.
 *   2. **The scheme version.** BEFORE the canonical form is built: a v2
 *      certificate canonicalised with v1 rules and then refused as a bad
 *      signature would name the wrong problem and send the signer to change
 *      the wrong thing.
 *   3. **The payload's schema** (`ADR-009`: schema before signature). A
 *      mistyped certificate is a clerk's mistake; presenting it as a forgery
 *      would send an administrator hunting an attacker.
 *   4. **The signature.** Canonical material, ECDSA, boolean.
 *   5. **The expiry.** Only reached by a genuine certificate: an expired
 *      licence is a billing conversation, not a security one — `ADR-009`'s
 *      third mandatory test.
 *
 * ## Why `now` is a parameter and never read here
 *
 * `AGENTS.md` §2.4: the use-case holds no clock. The verdict's expiry step is
 * therefore driven by the caller's clock (`IClock` at the module level), which
 * is what makes a certificate expiring at 09:00:00 testable at 09:00:01
 * without a sleep.
 */

/** What the validator was handed: one certificate blob and the instant to judge it at. */
export interface ValidateLicenceInput {
  readonly certificate: unknown;
  readonly now: Date;
}

export type LicenceVerdict =
  | { readonly outcome: 'valid'; readonly payload: LicencePayload }
  /** The certificate does not parse — a clerk's mistake, fixable by re-issuing. */
  | { readonly outcome: 'schema-error'; readonly reason: string }
  /** The bytes do not match the signature. A security event. */
  | { readonly outcome: 'invalid-signature' }
  /** Genuine, and its time has passed. A billing conversation. */
  | { readonly outcome: 'expired'; readonly payload: LicencePayload }
  /** The scheme version is not one this build implements. */
  | { readonly outcome: 'unsupported-scheme'; readonly version: number };

export interface ValidateLicenceDeps {
  readonly verifier: ILicenceSignatureVerifier;
}

/**
 * The envelope's shape: what travels around the signed material.
 *
 * `signature` and `canonicalisationVersion` are typed as validated, because
 * `readEnvelope` checks both BEFORE it casts — a cast from `unknown` to an
 * unchecked shape is how an unvalidated field reaches a verifier.
 */
interface EnvelopeShape {
  readonly certificate: unknown;
  readonly canonicalisationVersion: number;
  readonly keyId: unknown;
  readonly signature: string;
}

function readEnvelope(input: unknown): EnvelopeShape | string {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return 'a certificate is an object with a payload, a scheme version, a key id and a signature';
  }
  const record = input as Record<string, unknown>;
  for (const key of ['certificate', 'canonicalisationVersion', 'keyId', 'signature']) {
    if (!(key in record)) return `the key ${key} is missing from the certificate envelope`;
  }
  if (typeof record.canonicalisationVersion !== 'number') {
    return 'canonicalisationVersion must be a number';
  }
  if (typeof record.signature !== 'string' || record.signature.length === 0) {
    return 'signature must be a non-empty base64 string';
  }
  return record as unknown as EnvelopeShape;
}

export class ValidateLicenceCertificate {
  constructor(private readonly deps: ValidateLicenceDeps) {}

  validate(input: ValidateLicenceInput): LicenceVerdict {
    // ── 1. The envelope's shape ────────────────────────────────────────────
    const envelope = readEnvelope(input.certificate);
    if (typeof envelope === 'string') {
      return { outcome: 'schema-error', reason: envelope };
    }

    // ── 2. The scheme version, before any canonical form is built ──────────
    if (envelope.canonicalisationVersion !== CANONICALISATION_VERSION) {
      return {
        outcome: 'unsupported-scheme',
        version: envelope.canonicalisationVersion as number,
      };
    }

    // ── 3. The payload's schema (ADR-009: before the signature) ────────────
    const parsed = parseLicencePayload(envelope.certificate);
    if (!parsed.ok) {
      return { outcome: 'schema-error', reason: parsed.reason };
    }

    // ── 4. The signature, over the canonical material ─────────────────────
    const material = canonicaliseLicenceMaterial(envelope.certificate);
    const genuine = this.deps.verifier.verify({
      material,
      signature: envelope.signature,
    });
    if (!genuine) return { outcome: 'invalid-signature' };

    // ── 5. The expiry, only for a certificate that is genuine ──────────────
    if (parsed.payload.expiryDate.getTime() <= input.now.getTime()) {
      return { outcome: 'expired', payload: parsed.payload };
    }

    return { outcome: 'valid', payload: parsed.payload };
  }
}
