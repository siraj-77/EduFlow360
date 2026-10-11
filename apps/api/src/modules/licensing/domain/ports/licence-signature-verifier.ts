/**
 * The port for "is this signature genuine" (`ADR-009`; `PLT-301` T1).
 *
 * ## Why a port, and why this narrow
 *
 * `ADR-009` chose ECDSA P-256 over canonical JSON and named RSA-2048 its
 * weakest-rejected alternative — *"if a signing service already exists
 * issuing RSA, use RSA"*. Choosing a scheme is the adapter's business; the
 * use-case holds one boolean question. This interface is that question, and
 * nothing more: a change of algorithm is a new file in
 * `infrastructure/adapters/` and no change above it.
 *
 * The key is EMBEDDED IN THE BUILD (`ADR-009`): the public key ships in the
 * application, and the private one exists only on the activation server. That
 * is why this port takes no key lookup — the key is the adapter's
 * construction, and a request-shaped key lookup would be a runtime decision
 * where a build-time one belongs.
 */

export const I_LICENCE_SIGNATURE_VERIFIER = Symbol('ILicenceSignatureVerifier');

export interface ILicenceSignatureVerifier {
  /**
   * Did `signature` come from the holder of the private key matching the
   * embedded public key, over exactly `material`?
   *
   * `material` is the CANONICAL form — the caller never passes raw JSON,
   * because a signature over whatever a serialiser happened to produce is the
   * failure `ADR-009` was written to prevent. `signature` is base64.
   *
   * Answers a boolean and never throws: an unsupported key, a malformed
   * signature or a wrong-length material are all `false`, because the caller
   * needs one answer ("this certificate is not genuine") and the reason is a
   * security-relevant detail that belongs in the adapter's own diagnostics,
   * not in the verdict.
   */
  verify(params: { readonly material: string; readonly signature: string }): boolean;
}
