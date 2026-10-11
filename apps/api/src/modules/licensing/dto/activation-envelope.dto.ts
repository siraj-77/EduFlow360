import { z } from 'zod';

/**
 * The `.lic` file, as a request body (`PLT-304`).
 *
 * ## Why this validates the ENVELOPE and not the payload
 *
 * The payload is `ValidateLicenceCertificate`'s business — schema, then
 * signature, in the order `ADR-009` specifies. Duplicating the payload schema
 * here would (a) risk the two drifting and (b) run the schema check BEFORE
 * the signature check in the wrong place: an unparseable payload arriving
 * with a bad signature must answer as a signature failure to the LOG while
 * the response is one 400 either way.
 *
 * So this schema checks only what the ROUTE needs to hand over: the shape
 * that makes an envelope an envelope. The payload travels as `z.unknown()`
 * and is judged entirely downstream.
 *
 * ## The transport bounds
 *
 * `signature` bounded for the DoS case and in the base64 shape; `keyId` a
 * short label; `canonicalisationVersion` a positive integer (the validator
 * answers a version it does not implement).
 */
export const ActivationEnvelopeBody = z.object({
  /**
   * The payload, as an object of keys. A certificate IS a key-value document
   * (Master Plan §4.2's worked example), so the shape is `record`, not
   * `unknown` — with `z.unknown()` the inferred type makes the key OPTIONAL
   * (`unknown` includes `undefined`) and the controller's call stops
   * typechecking against the use-case's required field. The payload's own
   * schema is the validator's business; this only fixes the shape.
   */
  certificate: z.record(z.string(), z.unknown()),
  canonicalisationVersion: z.number().int().positive(),
  keyId: z.string().trim().min(1).max(64),
  signature: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .regex(/^[A-Za-z0-9+/=_-]+$/, 'must be base64 or base64url'),
});

export type ActivationEnvelopeBodyShape = z.infer<typeof ActivationEnvelopeBody>;
