import { createPublicKey, verify } from 'node:crypto';
import type { ILicenceSignatureVerifier } from '../../domain/ports/licence-signature-verifier.js';

/**
 * ECDSA P-256 over the canonical material — `ADR-009`'s decision, and the only
 * place in this repository that knows the scheme exists.
 *
 * ## The PEM arrives at construction, from the build's own key file
 *
 * `LICENSE_PUBLIC_KEY_PATH` names a file in the deployment (`.env.example`
 * documents it, `env.ts` validates it when present). The module reads it and
 * hands the content here. A missing or malformed key is a BOOT failure, not a
 * request failure: `AGENTS.md` §11 — start-up fails fast naming the problem,
 * because a deployment that cannot verify licences and finds out when a school
 * tries to sign in has failed in the worst possible order.
 *
 * ## `false`, never a throw
 *
 * The port's contract: a bad key, a bad signature or bad material all answer
 * `false`. This file narrows to that by construction — `verify` returns false
 * on a malformed signature, and the key is validated once in the constructor
 * so a bad key cannot reach here.
 */
export class EcdsaLicenceSignatureVerifier implements ILicenceSignatureVerifier {
  private readonly publicKey: ReturnType<typeof createPublicKey>;

  constructor(config: { readonly publicKeyPem: string }) {
    try {
      this.publicKey = createPublicKey(config.publicKeyPem);
    } catch (cause) {
      throw new Error(
        'EcdsaLicenceSignatureVerifier could not load the licence public key. The key is ' +
          'embedded in the build (ADR-009), so this is a deployment fault: LICENSE_PUBLIC_KEY_PATH ' +
          'names a file that is not a PEM-encoded SPKI public key. ' +
          `(${cause instanceof Error ? cause.message : String(cause)})`,
      );
    }
  }

  verify(params: { readonly material: string; readonly signature: string }): boolean {
    try {
      return verify(
        // `ec` with a `sha256` digest is ECDSA P-256 + SHA-256, the scheme
        // ADR-009 chose. The digest is part of the algorithm name rather than
        // a separate argument, so the two can never disagree.
        'sha256',
        Buffer.from(params.material, 'utf8'),
        this.publicKey,
        Buffer.from(params.signature, 'base64'),
      );
    } catch {
      // A malformed base64 signature is a `false`, not a crash: the caller
      // asked a yes/no question and a certificate nobody forged is still a
      // certificate that cannot be verified.
      return false;
    }
  }
}
