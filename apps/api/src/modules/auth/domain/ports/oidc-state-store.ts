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
 * `state` inside this bundle — a comparison, not an assignment. The cookie says
 * *this callback corresponds to a flow this server started, and here are the values
 * that flow was started with*, and nothing more.
 *
 * **The role and the licence are still not in here, and never will be.** A bundle
 * is minted before an account has been named, let alone a role consulted.
 *
 * ## What is different now that a bundle can also carry an account
 *
 * `link`-mode bundles carry a `userId`. That is a real departure from "nothing in
 * the cookie is the user", so it is stated rather than left to be discovered:
 *
 * - **It is not the caller's session.** It is the account that
 *   `GET /auth/oidc/link` authenticated, minutes earlier, in this same browser.
 *   The callback does not read the session cookie to decide what to link, which is
 *   the whole difference between the safe design and the takeover.
 * - **It only exists inside the MAC**, so it cannot be pointed at another account
 *   by editing the cookie. `oidc-state-store.spec.ts` asserts that edit failing.
 * - **It authorises nothing on its own.** `link` still re-reads the identity's
 *   verified `sub` and still refuses a `(provider, subject)` already bound to a
 *   *different* account, so a stolen bundle cannot re-point an identity.
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
 * DI token for this port.
 *
 * Declared HERE, in the port file, rather than in `auth.module.ts`. That is not a
 * style preference and it was learned the hard way: `OidcCallbackController` needs
 * this token, `auth.module.ts` imports that controller, and a controller importing a
 * token back out of the module **closes an import cycle**. The controller's body then
 * evaluates while the symbol is still uninitialised, `@Inject(undefined)` is emitted,
 * Nest falls back to reflected metadata, and the container refuses to boot with:
 *
 *     Nest can't resolve dependencies of the OidcCallbackController
 *     (CompleteOidcCallback, ?, SessionCookieAdapter, ...)
 *     Please make sure that the argument Function at index [1] is available
 *
 * A token has to be importable by the thing that consumes it. `CLOCK` set the
 * precedent; `I_SESSION_REPOSITORY` and `I_EXTERNAL_IDENTITY_REPOSITORY` follow it.
 * `auth.module.ts` re-exports this symbol, so every existing import site still works.
 */
export const IOIDC_STATE_STORE = Symbol('IOidcStateStore');

/**
 * Which flow a callback belongs to.
 *
 * ## Why this is the security core of the whole callback, and not a parameter
 *
 * Two routes can produce a bundle that arrives at `GET /auth/oidc/callback`:
 *
 * | route                  | guard         | what it may do            |
 * |------------------------|---------------|---------------------------|
 * | `GET /auth/oidc/redirect` | `@Public`  | sign in only              |
 * | `GET /auth/oidc/link`     | authenticated | link only               |
 *
 * The naive design is "if a session cookie is present, link; otherwise sign in".
 * **That is account takeover.** A victim is signed in; an attacker starts a Google
 * sign-in in the victim's browser and completes it with the *attacker's* Google
 * account; the callback sees the victim's session cookie and binds the attacker's
 * identity to the victim's account. The attacker then signs in as the victim, and
 * the victim's children are now visible to them.
 *
 * So the mode cannot be derived at the callback. It has to be **sealed**, decided
 * by the route that started the flow, and carried inside the MAC — which is why it
 * is a field on this payload rather than a query parameter, a second cookie, or a
 * server-side lookup. A second store would be a second MAC to get wrong; a query
 * parameter is a flag the caller owns.
 */
export type OidcFlowMode = 'sign-in' | 'link';

/**
 * The four values the PROVIDER produced.
 *
 * Split from the payload so the thing that is ours — the mode — is visibly not
 * the thing that came from Google. `IOidcProvider.verifyCallback` takes these four
 * as its `expected` argument, and it takes them from here unchanged.
 */
export interface OidcFlowValues {
  /** Correlates the callback and rejects a forged one. */
  readonly state: string;
  /** Bound into the ID token to bind it to this request. */
  readonly nonce: string;
  /** PKCE verifier. Never in a URL, never in a log, never script-readable. */
  readonly codeVerifier: string;
  /** Where the provider must send the browser back. */
  readonly redirectUri: string;
}

/**
 * What a route asks to have sealed.
 *
 * ## Why this is a discriminated union and not one interface with an optional
 *
 * Because the dangerous mistake this file exists to prevent is reading
 * `payload.userId` on a sign-in flow. With an optional field that compiles, and
 * `undefined` is exactly the value that would make a use-case fall back to "the
 * account on the session cookie" — the takeover.
 *
 * As a union, `sealed.userId` **does not typecheck at all** unless the mode has
 * already been narrowed to `'link'`. The mistake is a compile error rather than a
 * review item, which is the only durable place this class of bug can be caught.
 */
export type OidcStatePayload =
  | ({ readonly mode: 'sign-in' } & OidcFlowValues)
  /** `userId` is the account `GET /auth/oidc/link` authenticated — never the caller's cookie. */
  | ({ readonly mode: 'link'; readonly userId: string } & OidcFlowValues);

/** A payload plus when the server issued it, which is what makes it expirable. */
interface SealedOidcStateValues extends OidcFlowValues {
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

/** The same union, recovered. `issuedAtMs` does not discriminate, so it is shared. */
export type SealedOidcState =
  | ({ readonly mode: 'sign-in' } & SealedOidcStateValues)
  | ({ readonly mode: 'link'; readonly userId: string } & SealedOidcStateValues);

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
