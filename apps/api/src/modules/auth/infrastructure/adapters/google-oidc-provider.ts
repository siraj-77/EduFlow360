import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { KeyObject, webcrypto } from 'node:crypto';
import {
  type IOidcProvider,
  type OidcAuthorizationRequest,
  type OidcCallbackQuery,
  type OidcIdentity,
} from '../../domain/ports/oidc-provider.js';

/**
 * Google, as an `IOidcProvider`.
 *
 * ## Why this class is boring on purpose
 *
 * Every security decision here was made once, in the port, and this file is
 * the mechanical execution of it. The provider is reached only through two
 * injected seams — a token-exchange function and a JWKS resolver — so the
 * entire adapter is testable without a network and without a Google project,
 * and so a test is exercising this logic rather than Google.
 *
 * ## The five checks, and why each one is load-bearing
 *
 * 1. **`state` must match.** Without it, an attacker starts a flow in the
 *    victim's browser and completes it with the attacker's account. This is
 *    login CSRF, and `state` is the only defence.
 * 2. **The signature must verify against Google's JWKS.** An unsigned or
 *    self-signed ID token is a stranger's assertion with a Google hat on.
 * 3. **`iss` must be Google.** Otherwise any issuer Google trusts can mint a
 *    token this server accepts.
 * 4. **`aud` must be this client ID.** Otherwise a token minted for *another*
 *    application on Earth is accepted here.
 * 5. **`nonce` must match.** Binds the ID token to the request this server
 *    started, defeating replay of a token captured elsewhere.
 *
 * ## The checks that are deliberately NOT here
 *
 * **Email is never verified as identity and never used to find an account.**
 * `AGENTS.md` 2.13. It is read, carried, and otherwise ignored. Two unrelated
 * people can share an address; signing in by one silently merges two families.
 *
 * ## Randomness
 *
 * `state`, `nonce` and the PKCE verifier come from `node:crypto`, not
 * `Math.random`. This file is outside the `domain/` and `use-cases/` folders,
 * so `Math.random()` would be permitted by the lint rule — and would still be
 * the wrong choice for a value an attacker must not predict.
 */

export interface GoogleOidcConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly issuer?: string;
  readonly authorizationEndpoint?: string;
  readonly tokenEndpoint?: string;
  readonly jwksUri?: string;
  readonly scopes?: readonly string[];
}

/**
 * What `jwtVerify` accepts as its verification key: a remote JWKS, a local
 * key, or a resolver. Widening this to all three is what lets a test hand the
 * adapter a locally generated public key instead of standing up a JWKS
 * endpoint — so the suite exercises real signature verification with no
 * network and no Google project.
 */
export type OidcVerificationKey = JWTVerifyGetKey | webcrypto.CryptoKey | KeyObject;

export interface GoogleOidcDeps {
  /** Swappable so tests never reach the network. */
  readonly postForm: (
    url: string,
    body: URLSearchParams,
    headers: Record<string, string>,
  ) => Promise<unknown>;
  /** Swappable so tests can verify against a locally generated key. */
  readonly jwks: OidcVerificationKey;
  /**
   * Injected so `exp` is deterministic in tests. Defaults to the real clock.
   * This adapter is outside `domain/`, so it is allowed to read ambient time —
   * but allowed is not the same as required.
   */
  readonly currentDate?: () => Date;
}

const DEFAULTS = {
  issuer: 'https://accounts.google.com',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  scopes: ['openid', 'email', 'profile'],
} as const;

/** Raised for every failure, so no branch can leak a provider detail upward. */
export class OidcVerificationError extends Error {
  constructor(
    readonly reason:
      | 'state-mismatch'
      | 'provider-error'
      | 'missing-code'
      | 'token-exchange-failed'
      | 'signature-invalid'
      | 'issuer-invalid'
      | 'audience-invalid'
      | 'nonce-mismatch'
      | 'malformed-claims',
    message: string,
  ) {
    super(message);
    this.name = 'OidcVerificationError';
  }
}

/** Real HTTP, using the global `fetch`. No axios, no dependency. */
const defaultPostForm: GoogleOidcDeps['postForm'] = async (url, body, headers) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body,
  });
  if (!response.ok) {
    throw new Error(`token endpoint returned ${response.status}`);
  }
  return response.json();
};

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

export class GoogleOidcProvider implements IOidcProvider {
  readonly key = 'google';

  private readonly cfg: Required<GoogleOidcConfig>;
  private readonly deps: GoogleOidcDeps;

  constructor(config: GoogleOidcConfig, deps?: Partial<GoogleOidcDeps>) {
    this.cfg = {
      issuer: config.issuer ?? DEFAULTS.issuer,
      authorizationEndpoint: config.authorizationEndpoint ?? DEFAULTS.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint ?? DEFAULTS.tokenEndpoint,
      jwksUri: config.jwksUri ?? DEFAULTS.jwksUri,
      scopes: config.scopes ?? DEFAULTS.scopes,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    };
    // Built conditionally because the project compiles with
    // `exactOptionalPropertyTypes`, which rejects an explicit `undefined` for
    // an optional property. Spreading an empty object is how a genuinely
    // absent dependency is spelled here.
    this.deps = {
      postForm: deps?.postForm ?? defaultPostForm,
      jwks: deps?.jwks ?? createRemoteJWKSet(new URL(this.cfg.jwksUri)),
      ...(deps?.currentDate ? { currentDate: deps.currentDate } : {}),
    };
  }

  /**
   * Build the consent URL and the three values that make the callback
   * verifiable. All three come from `node:crypto`.
   */
  beginAuthorization(): Promise<OidcAuthorizationRequest> {
    const state = base64url(randomBytes(24));
    const nonce = base64url(randomBytes(24));
    const codeVerifier = base64url(randomBytes(32));

    const url = new URL(this.cfg.authorizationEndpoint);
    url.searchParams.set('client_id', this.cfg.clientId);
    url.searchParams.set('redirect_uri', this.cfg.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.cfg.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', this.s256(codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
    // Force consent every time in development. A silently reused session makes
    // a broken callback look like it worked.
    url.searchParams.set('prompt', 'select_account');

    return Promise.resolve({
      authorizationUrl: url.toString(),
      state,
      nonce,
      codeVerifier,
      redirectUri: this.cfg.redirectUri,
    });
  }

  async verifyCallback(
    query: OidcCallbackQuery,
    expected: {
      readonly state: string;
      readonly nonce: string;
      readonly codeVerifier: string;
      readonly redirectUri: string;
    },
  ): Promise<OidcIdentity> {
    // 1. state. Checked first and before anything else, because everything
    //    after it is only meaningful if this callback belongs to our flow.
    if (query.state !== expected.state) {
      throw new OidcVerificationError(
        'state-mismatch',
        'OIDC state did not match. This callback did not originate from a sign-in this server started.',
      );
    }
    if (query.error) {
      throw new OidcVerificationError(
        'provider-error',
        `The identity provider refused the request: ${query.error}${
          query.errorDescription ? ' - ' + query.errorDescription : ''
        }`,
      );
    }
    if (!query.code) {
      throw new OidcVerificationError(
        'missing-code',
        'The callback carried no authorization code.',
      );
    }

    // Exchange. The PKCE verifier goes here and nowhere else; it is never in
    // the URL the browser was sent to, which is the entire point of PKCE.
    const body = new URLSearchParams({
      code: query.code,
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      redirect_uri: expected.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: expected.codeVerifier,
    });

    let tokens: unknown;
    try {
      tokens = await this.deps.postForm(this.cfg.tokenEndpoint, body, {
        authorization: `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64')}`,
      });
    } catch (cause) {
      throw new OidcVerificationError(
        'token-exchange-failed',
        `The token exchange failed: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      );
    }

    const idToken = (tokens as { id_token?: unknown })?.id_token;
    if (typeof idToken !== 'string' || idToken.length === 0) {
      throw new OidcVerificationError(
        'token-exchange-failed',
        'The token response carried no ID token.',
      );
    }

    // 2, 3 and 4 happen together inside jwtVerify: signature against the JWKS,
    // issuer, audience, and expiry.
    let claims: JWTPayload;
    try {
      const verified = await jwtVerify(idToken, this.deps.jwks, {
        issuer: this.cfg.issuer,
        audience: this.cfg.clientId,
        // jose takes a `Date` here, not a thunk, so the injected function is called
        // at verification time. Calling it then rather than at construction is
        // what makes a test able to move the clock between calls.
        ...(this.deps.currentDate ? { currentDate: this.deps.currentDate() } : {}),
      });
      claims = verified.payload;
    } catch (cause) {
      throw new OidcVerificationError(
        'signature-invalid',
        `The ID token was rejected: ${cause instanceof Error ? cause.message : 'unknown reason'}`,
      );
    }

    // 5. nonce, after the signature, because a nonce in an unverified token is
    //    an attacker's nonce.
    if (claims.nonce !== expected.nonce) {
      throw new OidcVerificationError(
        'nonce-mismatch',
        'The ID token nonce did not match the one this server issued.',
      );
    }

    // `azp` is required when several clients share an audience. Checked when
    // present, because an absent one is legal for a single-client audience.
    if (typeof claims.azp === 'string' && claims.azp !== this.cfg.clientId) {
      throw new OidcVerificationError(
        'audience-invalid',
        'The ID token was authorized party does not match this client.',
      );
    }

    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new OidcVerificationError('malformed-claims', 'The ID token carried no subject.');
    }

    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      // `null` when absent, never defaulted to false: "unknown" and
      // "unverified" are different claims and collapsing them loses the
      // distinction between a Workspace tenant that asserts verification and
      // one that says nothing.
      emailVerified: typeof claims.email_verified === 'boolean' ? claims.email_verified : null,
      provider: this.key,
    };
  }

  /** RFC 7636 S256. The verifier itself never leaves the server. */
  private s256(verifier: string): string {
    return base64url(createHash('sha256').update(verifier).digest());
  }
}
