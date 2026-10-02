import type { ICookieCarrier, SessionCookie } from '../../domain/ports/session-cookie.js';

/**
 * `ICookieCarrier`, backed by an Express response.
 *
 * ## Why this class exists at all
 *
 * The cookie adapter needs somewhere to put a cookie. Without a carrier, there
 * is no path from a session token to a browser, and the whole transport is a
 * type definition — correct, tested, and delivering nothing. This is the
 * adapter that closes that path, and it is an adapter in `AGENTS.md` 2.2's
 * sense: the vendor integration sits behind the port, and nothing inward of it
 * names Express.
 *
 * ## Why it does not import `express`
 *
 * `express` is a transitive dependency of `@nestjs/platform-express`. It is not
 * in this package's `package.json`, so importing its types would depend on a
 * package this one does not declare — the failure mode where a transitive
 * dependency is quietly load-bearing and then breaks on a version bump.
 *
 * Instead the two response methods this class calls are **declared** below.
 * Structural typing means the real `Response` satisfies them without any
 * declaration merging, a cast, or `any`, and a test can pass a two-method
 * recorder that is not an HTTP server at all.
 *
 * ## Why it delegates serialisation instead of building the header
 *
 * `Set-Cookie` has more sharp edges than it appears: `Expires` versus `Max-Age`
 * and their precedence, the comma-and-space separator, value quoting, attribute
 * casing, and what happens to a value containing a semicolon. `res.cookie` has
 * handled all of it for a decade. This class translates our named attributes
 * into Express's option names and gets out of the way, so those decisions stay
 * in one well-tested place instead of being re-derived per module.
 */

/**
 * The two response methods this carrier calls.
 *
 * `cookie` and `clearCookie` are both chainable on a real Express `Response`,
 * which is why they are typed as returning `unknown` here — the return value is
 * deliberately not used, and typing it as `Response` would require importing
 * the very type this file avoids.
 */
export interface CookieWritingResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options: Record<string, unknown>): unknown;
}

/**
 * Translate `SessionCookie` into `res.cookie` arguments.
 *
 * ## The mapping, and what is deliberately absent
 *
 * | Ours                          | Express          |
 * |-------------------------------|------------------|
 * | `attributes.httpOnly`         | `httpOnly`       |
 * | `attributes.secure`           | `secure`         |
 * | `attributes.sameSite`         | `sameSite`       |
 * | `attributes.path`             | `path`           |
 * | `attributes.expiresAt`        | `expires`        |
 *
 * Three things are **not** passed, and each omission is a decision:
 *
 * - **No `domain`.** A `Domain` attribute widens the cookie to sibling
 *   subdomains, which hands an attacker-controlled `shop.school.edu` the ability
 *   to overwrite the session cookie — cookie tossing. Omitting it scopes the
 *   cookie to the exact host.
 * - **No `maxAge`.** `Expires` alone is enough, and RFC 6265 gives `Max-Age`
 *   precedence when both are present. Passing both means the browser picks
 *   whichever it likes, from two values computed from two clocks. `expiresAt` is
 *   already derived from the single injected `IClock`.
 * - **No `encode`.** Express URL-encodes the value by default, which is the
 *   right default for a cookie whose value must not contain a separator. The
 *   session token is base64url and needs no encoding, so overriding the default
 *   would only add a way for a semicolon to reach the header.
 */
export class ExpressCookieCarrier implements ICookieCarrier {
  constructor(private readonly response: CookieWritingResponse) {}

  setCookie(cookie: SessionCookie): void {
    this.response.cookie(cookie.name, cookie.value, {
      httpOnly: cookie.attributes.httpOnly,
      secure: cookie.attributes.secure,
      sameSite: cookie.attributes.sameSite,
      path: cookie.attributes.path,
      expires: cookie.attributes.expiresAt,
    });
  }
}
