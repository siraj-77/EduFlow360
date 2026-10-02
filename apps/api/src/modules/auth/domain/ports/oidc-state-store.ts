import type { CookieAttributes } from './session-cookie.js';

/**
 * Carrying one sign-in from `GET /auth/oidc/redirect` to the callback.
 *
 * ## Why this file exists at all
 *
 * `IOidcProvider.beginAuthorization()` returns four values together — `state`,
 * `nonce`, `codeVerifier` and `redirectUri` — and the port says why: it makes it
 * impossible to start a flow without also producing the values that make the
 * callback verifiable. The corollary is that all four must survive the trip to
 * Google and back, and nothing in the browser's URL can carry them:
 *
 * - `codeVerifier` must not leave the server. That is the entire point of PKCE.
 * - `nonce` must not be readable by a script.
 * - `state` must come back unchanged, and the callback must be able to tell
 *   whether this callback belongs to a flow *this* server started.
 *
 * So something has to hold them for the length of a round trip to Google.
 *
 * ## Why a signed cookie, and not a server-side store
 *
 * **The choice: a stateless, HMAC-signed cookie.** The bundle is serialised,
 * signed with a key the process already holds, and written to the browser with
 * `httpOnly`. The callback verifies the signature and uses the contents.
 *
 * The alternative, and the one `AGENTS.md` 3.1 tempts you into, is Redis:
 * write `state -> {nonce, codeVerifier}` under a random key at the redirect,
 * read it back at the callback. It is the textbook answer and it is the wrong
 * one *here*:
 *
 * 1. **It makes sign-in depend on a service that may not be running.** There is
 *    no verified Redis deployment in this repository (`G1-10` is open). The
 *    result of depending on one is that a degraded cache becomes a school that
 *    cannot log in — a cache outage escalating into an authentication outage.
 *    A login path is the last thing that should fail for a reason unrelated to
 *    credentials.
 * 2. **It moves the decision about who is authenticated from a signature to a
 *    lookup.** With a server-side store the callback trusts a key that arrived
 *    in the query string; with a signed cookie it trusts a MAC it computed
 *    itself over the bundle. The second cannot be satisfied by guessing a
 *    reference, only by holding the key.
 * 3. **The bundle is small.** `state` and `nonce` are 32 base64url characters
 *    each, `codeVerifier` is 43, `redirectUri` is a path-length URL. Signed, the
 *    whole cookie is a few hundred bytes, far under the ~4 KB every current
 *    browser accepts and under the 512-byte-per-cookie figure some proxies still
 *    assume. A size argument that only works below a threshold should say where
 *    the threshold is; this says so above, and a future bundle that outgrows the
 *    limit should move to the store below rather than silently truncate.
 *
 * The honest costs, which are real:
 *
 * - **Multi-tab sign-in.** One cookie name means one in-flight flow per browser.
 *    Starting a second sign-in overwrites the first, and the first tab's callback
 *    then finds a `state` that is not its own and is refused. That is a failed
 *    login, never an accepted one, which is the correct direction to fail in. If
 *    the product needs parallel flows, the key must vary per flow
 *    (`eduflow_oidc_state.<id>`) and the lookup become per-key — a change to this
 *    port, made when it is needed rather than pre-built.
 * - **The key is load-bearing and process-wide.** Rotating it invalidates every
 *    in-flight sign-in. That is the intended failure: those flows are dead
 *    anyway.
 * - **Statelessness means revocation is not free.** Nothing can cancel a bundle
 *    before it expires; the window is bounded by `ttlMs`, which is why it is a
 *    short, configured number rather than a session lifetime.
 *
 * ## Why the callback may trust the cookie's *contents*
 *
 * Only its signature. Every field here arrives from the provider on the way out,
 * and the callback compares the `state` it receives in the query against the
 * `state` inside this bundle — a comparison, not an assignment. Nothing in the
 * cookie is ever used as "the user", "the role" or "the account"; those do not
 * exist yet. The cookie says *this callback corresponds to a sign-in this server
 * started, and here are the values that sign-in was started with*, and nothing
 * more.
 */

/**
 * The cookie name. A wire contract — see `session-cookie.spec.ts` for why these
 * are pinned rather than trusted.
 *
 * Deliberately NOT `__Host-` prefixed. The prefix is genuinely stronger — a
 * browser rejects a `__Host-` cookie without `Secure`, `Path=/` and no `Domain`,
 * which makes cookie-tossing from a sibling subdomain impossible. It is not used
 * for the same reason `SESSION_COOKIE_NAME` does not use it: `__Host-` forces
 * `Secure`, and this deployment keeps a deliberate plain-HTTP local-development
 * escape for testing on a phone over the LAN. The origin here is narrow enough
 * (`/auth/oidc`) that the subdomain exposure is small, and it is the same
 * exposure the session cookie already accepts.
 */
export const OIDC_STATE_COOKIE_NAME = 'eduflow_oidc_state' as const;

/**
 * The narrowest path that still covers both routes of this flow.
 *
 * `/` would make the browser attach the PKCE verifier to every request it makes
 * to this origin — a strictly larger exposure for no benefit, because the bundle
 * is read by exactly one route. `/auth/oidc` covers `GET /auth/oidc/redirect`
 * and `GET /auth/oidc/callback` and nothing else. If the callback is ever moved,
 * this constant and `GOOGLE_REDIRECT_URI` must move together, or every sign-in
 * silently ends at a callback that was never sent the bundle.
 */
export const OIDC_STATE_COOKIE_PATH = '/auth/oidc' as const;

/**
 * What the provider produced for one authorization request.
 *
 * Structurally identical to the `expected` argument of
 * `IOidcProvider.verifyCallback`, which is deliberate: the callback hands these
 * four values straight back to the provider, so there is exactly one shape and
 * no translation step where a field could be dropped.
 */
export interface OidcStatePayload {
  /** Correlates the callback and rejects a forged one. */
  readonly state: string;
  /** Bound into the ID token to bind it to this request. */
  readonly nonce: string;
  /** PKCE verifier. Never in a URL, never in a log, never script-readable. */
  readonly codeVerifier: string;
  /** Where the provider must send the browser back. */
  readonly redirectUri: string;
}

/** A payload plus when the server issued it, which is what makes it expirable. */
export interface SealedOidcState extends OidcStatePayload {
  /**
   * Milliseconds since the epoch, from the injected `IClock`.
   *
   * Not `Date.now()` and not `new Date()`: `AGENTS.md` 2.4 bans ambient time in
   * `domain/` and `use-cases/` precisely so that this boundary is placeable in a
   * test. A store with no server-side expiry trusts the browser to honour
   * `Expires`, and the browser is the party an attacker controls.
   */
  readonly issuedAtMs: number;
}

/**
 * The cookie carrying a sealed bundle. As data, like `SessionCookie`.
 *
 * It is an `ICookieCarrier`-compatible value rather than a `SessionCookie`: a
 * different name, a narrower path, and a lifetime measured in minutes. Reusing
 * the session cookie's *type* would have meant the store could overwrite the
 * session, and reusing its *name* would have meant every logout deleted an
 * in-flight sign-in.
 */
export interface OidcStateCookie {
  readonly name: typeof OIDC_STATE_COOKIE_NAME;
  readonly value: string;
  readonly attributes: CookieAttributes;
}

/**
 * The store, as the application layer sees it.
 *
 * Three verbs, and no fourth. Notably absent: anything that *finds* a bundle for
 * a caller who did not already hold one. Reading a request's cookies is a
 * framework concern — see `ICookieCarrier`, which is write-only for exactly this
 * reason — so `open` takes the raw value the transport already extracted and
 * nothing else.
 */
export interface IOidcStateStore {
  /**
   * Sign a payload and describe the cookie that carries it.
   *
   * Returns the cookie rather than writing it, so the use-case never touches a
   * response and the caller decides when it is set.
   */
  seal(payload: OidcStatePayload): OidcStateCookie;

  /**
   * Recover a payload from a raw cookie value.
   *
   * `null` for absent, malformed, wrongly signed, or past `ttlMs` — four
   * different failures that the callback answers identically, because the
   * callback's only correct answer to all four is to refuse.
   */
  open(raw: string | undefined): SealedOidcState | null;

  /**
   * The already-dead cookie, for clearing at the end of a flow.
   *
   * Present so the callback cannot invent its own expiry and get the attributes
   * subtly wrong: a clear that differs in name, path or attributes removes
   * nothing, and leaves a bundle sitting in the browser looking valid.
   */
  expired(): OidcStateCookie;
}
