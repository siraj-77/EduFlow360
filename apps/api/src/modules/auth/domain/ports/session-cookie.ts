/**
 * Delivering a session credential to a browser.
 *
 * ## Why this file is in `domain/ports/`
 *
 * `D48` settles the transport: an `httpOnly`/`Secure`/`SameSite=Lax` cookie for
 * the web app, and the same opaque token in a response body for mobile in
 * milestone 2. A transport decision is policy, so it belongs with the other
 * policy — and `AGENTS.md` 2.2 says a port belongs in `domain/ports/` with its
 * adapter in `infrastructure/adapters/`. The adapter is
 * `infrastructure/adapters/session-cookie.ts`; the thing that adapts Express
 * is `express-cookie-carrier.ts`.
 *
 * ## Why nothing here names a framework
 *
 * `domain/` may not import `@nestjs/*`, an ORM client or a vendor SDK, and
 * ESLint enforces it by path so it cannot be bypassed by editing a file
 * elsewhere (`packages/config/eslint/node.js`). HTTP is a vendor in that list,
 * which is why the two types below are **declared** rather than imported.
 *
 * `ICookieCarrier` in particular is the interesting one. It is not Express's
 * `Response` and it is not a re-export of it. It is the slice of a response
 * this code actually needs — put one cookie on it — and the real Express
 * response satisfies it structurally. That is what lets `domain/` describe how
 * a cookie is delivered without naming the thing that will do the delivering,
 * and it is the arrangement `AGENTS.md` 2.2 describes when it says vendor and
 * hardware integrations sit behind adapter interfaces.
 *
 * ## Why attributes are data and not a serialised string
 *
 * A `Set-Cookie` header is easy to get subtly wrong: `Expires` versus
 * `Max-Age`, the comma-and-space separator, the quoting of a value, and the
 * attribute casing. None of that appears here. These are five named fields, and
 * the framework's own serialiser — which has been correct for twenty years —
 * turns them into a header. `AGENTS.md` says a mechanism with no exception is
 * unsatisfiable and one with exceptions everywhere is decoration; this is the
 * same argument applied to header construction.
 */

/**
 * The cookie name. A wire contract.
 *
 * ## Why it is not `__Host-` prefixed
 *
 * The `__Host-` prefix is genuinely stronger: a browser refuses a `__Host-`
 * cookie unless it is `Secure`, has `Path=/` and carries **no** `Domain`, which
 * makes cookie-tossing from an attacker-controlled sibling subdomain
 * impossible. For a single-school deployment that subdomain threat is real.
 *
 * It is not used, for one reason: `__Host-` makes `Secure` mandatory, which
 * would make the deliberate plain-HTTP local-development escape below
 * *impossible* — and that escape has a genuine use, because a developer testing
 * on a phone over the LAN reaches the API by IP address, where `http://` is
 * not a secure context and a `Secure` cookie is discarded by the browser.
 * (`http://localhost` is treated as a secure context by current browsers, so the
 * common case does not need the escape at all.)
 *
 * So the defence against the subdomain is bought at the other end instead:
 * `Domain` is never set, and `CsrfGuard` refuses the cross-origin request
 * outright. Revisit this when the deployment story settles — a school on a
 * proper hostname could take `__Host-` and drop the escape entirely.
 */
export const SESSION_COOKIE_NAME = 'eduflow_session' as const;

/**
 * The cookie path. A wire contract, and a literal type on purpose.
 *
 * Issue and clear must agree on it exactly. A cookie is only deleted by a
 * matching name *and* domain *and* path, so a clear issued at `/auth` against a
 * cookie set at `/` removes nothing and leaves a valid credential in the
 * browser after the user believes they logged out.
 */
export const SESSION_COOKIE_PATH = '/' as const;

/**
 * The attribute set any cookie on this origin is written with.
 *
 * ## Why this was widened out of `SessionCookieAttributes`
 *
 * It did not exist until `GET /auth/oidc/redirect` needed a *second* cookie. The
 * alternative was to give the OIDC state store its own carrier interface and its
 * own serialiser, which would have been a second implementation of `Set-Cookie`
 * construction in the same codebase — and the exact failure this file's `Expires`
 * / `Max-Age` discussion is about, one level up.
 *
 * The widening is deliberately narrow, and the narrowing is what remains below:
 * `ICookieCarrier` takes the *general* type, while `ISessionCookieDelivery` still
 * takes `SessionCookie`, whose `httpOnly: true` and `path: '/'` are literal types.
 * So the thing that decides the session cookie's policy cannot weaken it, and the
 * thing that can write any cookie at all still cannot invent attributes the
 * serialiser does not map.
 *
 * `httpOnly` is a plain `boolean` here rather than `true` because a state cookie
 * is not a session credential and the difference is not expressible in one shared
 * type — but every cookie this repository actually writes is `httpOnly`, and both
 * adapters refuse to build one that is not. See `OidcStateCookie`.
 */
export interface CookieAttributes {
  /**
   * Not readable by script.
   *
   * True for every cookie EduFlow writes. An XSS that steals a credential out of
   * the document is worse than the XSS itself, because the stolen value works
   * from anywhere, indefinitely, with no further vulnerability needed.
   */
  readonly httpOnly: boolean;

  /**
   * Sent only over TLS.
   *
   * True by default and not silently dropped for convenience — see
   * `SessionCookieAdapter`, where disabling it requires two explicit
   * acknowledgements and otherwise refuses to construct.
   */
  readonly secure: boolean;

  /**
   * `lax`, in practice.
   *
   * `Lax` withholds the cookie from cross-site subresource loads and form
   * posts, which is the shape of essentially every CSRF attack. `Strict` would
   * also withhold it from the top-level navigation that arrives from Google's
   * sign-in redirect, so every login would render signed-out and recover a
   * moment later — a product failure, not a security gain. The gap `Lax` leaves
   * is same-site attacker-controlled subdomains, and that is `CsrfGuard`'s job.
   */
  readonly sameSite: 'lax' | 'strict' | 'none';

  /**
   * Always `/` for a session cookie, narrower for anything else.
   *
   * Expiry is absolute, UTC, computed from an injected `IClock` — never from
   * ambient time, so a test can place the boundary exactly.
   */
  readonly path: string;
  readonly expiresAt: Date;
}

/** Any cookie this codebase writes onto a response. */
export interface OutboundCookie {
  readonly name: string;
  readonly value: string;
  readonly attributes: CookieAttributes;
}

/**
 * The policy for one session cookie.
 *
 * Two of these are literal types rather than booleans or strings. That is not
 * decoration: `httpOnly: true` and `path: '/'` mean it is a compile error for
 * any future code — a config option, an override, a refactor — to construct a
 * session cookie that a script can read or that is scoped to a subpath. The
 * attributes `D48` settles are the ones that cannot be weakened by accident.
 */
export interface SessionCookieAttributes extends CookieAttributes {
  /**
   * Always `true`.
   *
   * JavaScript must never read a session credential. An XSS that steals the
   * token is worse than the XSS itself, because the stolen token works from
   * anywhere, forever, with no further vulnerability needed.
   */
  readonly httpOnly: true;

  /** Always `/`. See `SESSION_COOKIE_PATH`. */
  readonly path: typeof SESSION_COOKIE_PATH;
}

/**
 * One cookie, as data.
 *
 * The value is the **raw session token** — the plaintext `ISessionRepository`
 * returns once and never again. Not its hash (which the server cannot resolve
 * backwards), not a JSON blob of claims (which invites "just read the role from
 * the cookie", and which the browser could read if `httpOnly` were ever
 * dropped).
 */
export interface SessionCookie {
  readonly name: typeof SESSION_COOKIE_NAME;
  readonly value: string;
  readonly attributes: SessionCookieAttributes;
}

/**
 * The narrow slice of an HTTP response this code needs: somewhere to put one
 * cookie.
 *
 * One method, not two. Clearing is `setCookie` with an already-expired cookie,
 * so the attributes that built it and the attributes that removed it cannot
 * drift — see `SessionCookieAdapter.clear`.
 *
 * An implementation must apply `attributes` verbatim: no adding a `Domain`, no
 * widening `sameSite`, no substituting a default when `secure` is false. A
 * serialiser that "helpfully" repairs the policy is a second policy.
 *
 * The parameter is the general `OutboundCookie`, not `SessionCookie`, because a
 * response carries more than one cookie: see `CookieAttributes` for why, and for
 * why the session's own literal types were kept rather than widened.
 */
export interface ICookieCarrier {
  setCookie(cookie: OutboundCookie): void;
}

/**
 * How a session token reaches a browser.
 *
 * Two verbs, because that is genuinely all there is: put it there, take it
 * away. Note that neither takes a *request* — the request-side CSRF check is a
 * separate concern in a separate class, `CsrfGuard`, and the port says so
 * rather than leaving a reader to guess.
 */
export interface ISessionCookieDelivery {
  /**
   * Deliver a session token.
   *
   * `ttlMs` rather than an absolute `expiresAt` so the adapter is the single
   * place that reads a clock. The caller must pass the session's own remaining
   * lifetime: the cookie is a client-side hint, and a cookie that outlives the
   * server-side session is a credential that appears valid and is not.
   */
  issue(params: {
    readonly carrier: ICookieCarrier;
    /** The raw, plaintext session token. Never logged. */
    readonly rawToken: string;
    readonly ttlMs: number;
  }): SessionCookie;

  /**
   * Remove the session cookie.
   *
   * Identical name, path and attributes to `issue`, with an expiry already in
   * the past. A clear that differs in any of those removes nothing.
   */
  clear(carrier: ICookieCarrier): SessionCookie;
}
