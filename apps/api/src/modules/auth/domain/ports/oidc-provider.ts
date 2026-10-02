/**
 * The OIDC boundary.
 *
 * `AGENTS.md` 2.2 requires every vendor integration to sit behind an `I`-named
 * interface, and this is the one that matters most in the whole codebase: it
 * is the only place a stranger's assertion becomes a local account.
 *
 * ## The decision this encodes
 *
 * **The provider's `sub` is the lookup key. Never the email address.**
 * `AGENTS.md` 2.13 is the reason and the reason is not abstract. Google `sub`
 * is immutable for a person. An address is not: it can be recycled, and a
 * school moving Workspace domain rewrites every staff address at once. Sign
 * in by address and a recycled mailbox silently becomes another human's
 * account, with their children's data attached.
 *
 * So `OidcIdentity` carries `subject` and treats `email` as an unverified
 * display string. Nothing downstream may join on it, and
 * `database-contract.integration.spec.ts` holds that line with a test.
 *
 * ## Why the port returns claims, not a user
 *
 * It returns *what the provider said*, already verified. It does not resolve
 * a local `User`, does not touch the database, and does not mint a session.
 * Those belong to the application layer. A port that returned a `User` would
 * hide the only interesting question — "which local account does this
 * verified identity belong to?" — inside an adapter nobody tests.
 */

/** A verified set of claims from an external identity provider. */
export interface OidcIdentity {
  /**
   * The provider's immutable id for this person. Google's `sub`.
   *
   * **This is the only field that may be used to find a local account.**
   */
  readonly subject: string;

  /**
   * The address the provider reported, if any. Display only.
   *
   * Deliberately not unique and not authoritative. It may be absent, stale,
   * and shared by two unrelated people. `AGENTS.md` 2.13.
   */
  readonly email: string | null;

  /**
   * What the provider *claimed* about that address at the moment of
   * authentication.
   *
   * A snapshot, never re-read as a current fact. A Workspace tenant that
   * asserts verification can set it; one that does not leaves it null rather
   * than defaulting to false, so "unknown" is distinguishable from "unverified".
   */
  readonly emailVerified: boolean | null;

  /** The provider that vouched for this identity, e.g. `google`. */
  readonly provider: string;
}

/** Everything needed to verify one authorization-code exchange. */
export interface OidcAuthorizationRequest {
  /** Where to send the browser to obtain consent. */
  readonly authorizationUrl: string;
  /** Opaque value to correlate the callback and reject a forged one. */
  readonly state: string;
  /** Value bound into the ID token to bind it to this request. */
  readonly nonce: string;
  /** PKCE verifier. Sent to the provider, never returned to the browser. */
  readonly codeVerifier: string;
  /** Where the provider must send the browser back. */
  readonly redirectUri: string;
}

/** The query a provider sends back to the redirect URI. */
export interface OidcCallbackQuery {
  readonly code: string | null;
  readonly state: string | null;
  readonly error: string | null;
  readonly errorDescription: string | null;
}

/**
 * The provider integration, as the application layer sees it.
 *
 * Narrow on purpose. Two responsibilities, both security-critical, and
 * nothing else — no logout, no account linking, no profile fetching. Those
 * are separate ports when they are actually needed.
 */
export interface IOidcProvider {
  /** Stable provider key stored on `ExternalIdentity.provider`, e.g. `google`. */
  readonly key: string;

  /**
   * Build the authorization URL and the values that must be echoed back.
   *
   * Returning all four together is deliberate: it makes it impossible to
   * start a flow without also producing the `state`, `nonce` and PKCE
   * verifier that make the callback verifiable. A caller cannot forget them.
   */
  beginAuthorization(): Promise<OidcAuthorizationRequest>;

  /**
   * Verify an authorization code and return what the provider asserts.
   *
   * Rejects unless the ID token's signature, issuer, audience, expiry and
   * nonce all check out. An email that merely *looks* right is not a
   * verification, and a caller cannot tell the difference in the return type
   * because there is no unverified path out.
   */
  verifyCallback(
    query: OidcCallbackQuery,
    expected: {
      readonly state: string;
      readonly nonce: string;
      readonly codeVerifier: string;
      readonly redirectUri: string;
    },
  ): Promise<OidcIdentity>;
}
