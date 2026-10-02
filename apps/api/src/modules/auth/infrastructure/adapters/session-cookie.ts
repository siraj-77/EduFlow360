import { Injectable } from '@nestjs/common';
import { type IClock } from '../../domain/ports/clock.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
  type ICookieCarrier,
  type ISessionCookieDelivery,
  type SessionCookie,
  type SessionCookieAttributes,
} from '../../domain/ports/session-cookie.js';

/**
 * Delivering the session cookie, and only that.
 *
 * ## What this class is responsible for
 *
 * Exactly one thing: deciding the cookie's attributes and handing them to a
 * carrier. It does not serialise a header, it does not read a request, and it
 * does not enforce CSRF. The last of those is `CsrfGuard`, and the reason it is
 * not here is written out at length in that file — briefly, the two face
 * opposite directions, this class never sees an incoming request, and a
 * `POST` that changes state while setting no cookie at all would be uncovered
 * by anything named "cookie protection".
 *
 * ## `new Date()` appears here, and this is why that is allowed
 *
 * `AGENTS.md` 2.4 bans ambient time under `domain/` and `use-cases/`, enforced
 * by an ESLint rule scoped to those two folders. This file is
 * `infrastructure/`, so it is outside the rule — but it does not read the wall
 * clock anyway. "Now" comes from an injected `IClock`, so the expiry on a
 * cookie is a value a test can place exactly, on either side of the boundary.
 *
 * ## Why `IClock` and not `SystemClock` directly
 *
 * Injected, like every other seam. `GoogleOidcProvider` takes a `currentDate`
 * for the same reason and says so: *allowed* to read ambient time is not the
 * same as *required* to.
 */

/** Everything the adapter will not do to a cookie, said once, in one place. */
export interface SessionCookieAdapterConfig {
  /**
   * `true` unless explicitly set to `false`.
   *
   * The default is the safe value on purpose: a configuration that has never
   * been written produces a secure cookie, and losing `secure` requires an
   * omission rather than an instruction.
   */
  readonly secure?: boolean | undefined;

  /**
   * The second of two independent switches required to turn `secure` off.
   *
   * One switch is not enough, because one switch is indistinguishable from a
   * typo, a copy-pasted staging config, or a `secure: false` left behind after
   * a local-development session. Two named switches have to be read
   * together and only ever are, deliberately, by someone who has read the
   * warning this unlocks.
   *
   * The name says what the flag asserts — that the exception is for local
   * plain-HTTP development — so the config file itself carries the warning
   * rather than relying on the reader having this file open.
   */
  readonly acknowledgeInsecureLocalhostOnly?: boolean | undefined;
}

export interface SessionCookieAdapterDeps {
  readonly clock: IClock;
  readonly config?: SessionCookieAdapterConfig;
}

/**
 * `secure: false` without the acknowledgement.
 *
 * Thrown at construction, not at first use. `AGENTS.md` 11 wants start-up to
 * fail fast naming the problem, and this is start-up: a process that refuses to
 * boot is impossible to misread, whereas a warning line in a log is a thing
 * that scrolls past during exactly the kind of incident where it matters.
 */
export class InsecureSessionCookieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsecureSessionCookieError';
  }
}

/**
 * A token or a TTL that would produce an unusable cookie.
 *
 * Both are refused rather than repaired, and neither message interpolates the
 * offending value — `AGENTS.md` 2.13. A caller that already holds a live token
 * would otherwise have it written into a log file on the same line that reports
 * the failure.
 */
export class InvalidSessionCookieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSessionCookieError';
  }
}

/**
 * The instant a cleared cookie carries.
 *
 * The Unix epoch, not `now`. A cleared cookie must be expired relative to the
 * *browser's* clock, and a server whose clock is behind the browser's would
 * otherwise compute a "past" date that is still in the future on the client —
 * which is precisely when the browser silently keeps the cookie. 1970 is behind
 * every plausible device clock and needs no clock at all, which is what makes
 * the result deterministic.
 */
const EPOCH = new Date(0);

/** Anything that is not a finite, positive, whole number of milliseconds. */
function isUsableTtl(ttlMs: number): boolean {
  return Number.isSafeInteger(ttlMs) && ttlMs > 0;
}

@Injectable()
export class SessionCookieAdapter implements ISessionCookieDelivery {
  private readonly clock: IClock;

  /**
   * Resolved once, at construction, and never re-derived per call.
   *
   * Reading config inside `issue` would mean the answer to "is this cookie
   * secure" could change between the login and the logout of the same session.
   */
  private readonly secure: boolean;

  constructor(deps: SessionCookieAdapterDeps) {
    this.clock = deps.clock;

    const wantsInsecure = deps.config?.secure === false;
    const acknowledged = deps.config?.acknowledgeInsecureLocalhostOnly === true;

    if (wantsInsecure && !acknowledged) {
      throw new InsecureSessionCookieError(
        'Refusing to build a session cookie with secure: false. A cookie without `secure` is ' +
          'sent over plaintext HTTP, so anyone on the network path reads the session token out ' +
          'of the request headers, and HTTPS without HSTS still permits one plaintext request ' +
          'before the browser remembers. This is safe to disable ONLY for local plain-HTTP ' +
          'development (note that browsers treat http://localhost as a secure context, so the ' +
          'usual local case does not need it). To proceed you must also set ' +
          'acknowledgeInsecureLocalhostOnly: true, which states on the record that you have ' +
          'checked this never reaches a deployment. See D48.',
      );
    }

    this.secure = !wantsInsecure;

    if (wantsInsecure) {
      // `console.warn` is permitted by the base config's `no-console` allow-list.
      // This moves to the AGENTS.md 2.15 structured logger once one exists — and
      // note that when it does, the file-and-DB dual write applies, because a
      // deployment serving a cleartext session cookie is a CRITICAL event.
      console.warn(
        'Session cookies are being issued WITHOUT the `secure` attribute because ' +
          'acknowledgeInsecureLocalhostOnly was set. The session token is transmissible in ' +
          'cleartext. This must never reach a shared or deployed environment.',
      );
    }
  }

  /**
   * Build the policy and hand it to the carrier.
   *
   * The clock is read here, exactly once, and the returned object is the same
   * one the carrier was given — so there is no way for the policy a caller
   * inspects and the policy that reaches the browser to be two different
   * things built by two different code paths.
   */
  issue(params: {
    readonly carrier: ICookieCarrier;
    readonly rawToken: string;
    readonly ttlMs: number;
  }): SessionCookie {
    if (typeof params.rawToken !== 'string' || params.rawToken.trim().length === 0) {
      // The value is deliberately absent from this message: see the class note.
      throw new InvalidSessionCookieError(
        'Refusing to issue a session cookie with an empty token value. An empty cookie looks ' +
          'like a session to the browser and resolves to no session on every request.',
      );
    }

    if (!isUsableTtl(params.ttlMs)) {
      // A non-finite or fractional TTL serialises to an `Expires` the browser
      // cannot parse — "Invalid Date" — and the browser discards the attribute
      // silently, leaving a session cookie with *no expiry at all*. That is a
      // credential which outlives every session by construction, so this is
      // refused rather than coerced.
      throw new InvalidSessionCookieError(
        'Session cookie ttlMs must be a positive whole number of milliseconds. A value that is ' +
          'not finite, or is fractional, produces an Expires attribute the browser discards, ' +
          'leaving a session cookie with no expiry.',
      );
    }

    const cookie = this.build(params.rawToken, this.clock.now().getTime() + params.ttlMs);
    params.carrier.setCookie(cookie);
    return cookie;
  }

  /**
   * Remove the cookie by issuing an already-dead one.
   *
   * Not a separate `clearCookie` call. One serialiser means the attributes that
   * created the cookie and the attributes that delete it cannot drift apart —
   * and it sidesteps the `Expires` versus `Max-Age` trap entirely. RFC 6265
   * gives `Max-Age` precedence over `Expires`, so two mechanisms computed from
   * two clocks can disagree, and the loser is a logout that leaves a working
   * credential in the browser.
   */
  clear(carrier: ICookieCarrier): SessionCookie {
    const cookie = this.build('', EPOCH.getTime());
    carrier.setCookie(cookie);
    return cookie;
  }

  /**
   * The one place the attribute set is written.
   *
   * `issue` and `clear` both come through here, which is what makes "the clear
   * path rebuilt the attributes from defaults" a compile-time impossibility
   * rather than something to remember.
   */
  private build(value: string, expiresAtMs: number): SessionCookie {
    const attributes: SessionCookieAttributes = {
      // JavaScript must never read a session credential. An XSS that exfiltrates
      // the token is worse than the XSS, because the token works from anywhere,
      // indefinitely, needing no further vulnerability.
      httpOnly: true,
      // Sent only over TLS. The exception is a two-key acknowledgement at
      // construction and this value is fixed for the adapter's lifetime.
      secure: this.secure,
      // Withheld from cross-site subresource loads and form posts — the shape of
      // essentially every CSRF attack — while still reaching the browser on the
      // top-level navigation that completes a Google sign-in. `Strict` would
      // break that navigation. The same-site-subdomain gap `Lax` leaves open is
      // closed by `CsrfGuard`.
      sameSite: 'lax',
      // Scope to the whole origin so every route can see it, and so the clear
      // below matches the issue exactly. A narrower path makes logout a
      // no-op.
      path: SESSION_COOKIE_PATH,
      expiresAt: new Date(expiresAtMs),
    };

    return { name: SESSION_COOKIE_NAME, value, attributes };
  }
}
