import { describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../../../testing/fake-clock.js';
import { instant } from '../../../../testing/instant.js';
import type { ICookieCarrier, SessionCookie } from '../../domain/ports/session-cookie.js';
import {
  InsecureSessionCookieError,
  InvalidSessionCookieError,
  SessionCookieAdapter,
  type SessionCookieAdapterConfig,
} from './session-cookie.js';
import { ExpressCookieCarrier, type CookieWritingResponse } from './express-cookie-carrier.js';

/**
 * The session cookie adapter, tested through the **real** carrier.
 *
 * There is no fake carrier in this file, and that is the point. The adapter is
 * exercised against `ExpressCookieCarrier` wrapping a recording response, so
 * the assertions cover the whole path a token actually travels — policy in the
 * adapter, translation in the carrier, and the options object that leaves the
 * process. A fake carrier would have tested that the adapter called a method
 * this spec itself defined, which proves nothing about the cookie.
 */

const NOW = instant('2026-03-01T09:00:00.000Z');
const MINUTE = 60_000;

/** A response that records what was asked of it, and nothing else. */
function recordingResponse() {
  const set: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const response: CookieWritingResponse = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      set.push({ name, value, options });
      return response;
    },
    clearCookie() {
      throw new Error('clearCookie must not be used: clearing is an expired setCookie');
    },
  };
  return { set, carrier: new ExpressCookieCarrier(response) as ICookieCarrier };
}

const TOKEN = 'kZ7f2QwErTyUiOpAsDfGhJkL4zXcVbNm';

/**
 * Builds an adapter over a frozen clock.
 *
 * `config` is nested rather than spread into the deps, because that is where
 * the adapter reads it. The first version of this helper spread the config keys
 * at the top level, where they were silently ignored — and three tests that
 * looked like they were exercising the `secure` exception were in fact
 * exercising nothing at all. Vitest does not type-check, so the excess-property
 * error that would have caught it never fired.
 */
function adapter(config?: SessionCookieAdapterConfig) {
  const clock = new FakeClock(NOW);
  return {
    clock,
    adapter: new SessionCookieAdapter(config === undefined ? { clock } : { clock, config }),
  };
}

describe('SessionCookieAdapter — the four attributes D48 settles', () => {
  it('marks the cookie httpOnly', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // JavaScript must never be able to read a session credential. Not
    // `document.cookie`, not a `fetch` wrapper, not a bug in our own code. An
    // XSS that steals the token is strictly worse than the XSS: with
    // httpOnly=false one injected script is a permanent, silent, cross-origin
    // credential exfiltration. Nothing else in the transport defends against
    // that, because the script runs on the origin that is allowed to send the
    // cookie anyway.
    expect(set[0].options.httpOnly).toBe(true);
  });

  it('marks the cookie secure by default', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // Without `Secure` the cookie is sent over plaintext HTTP, so anyone on the
    // path — a school LAN, a café hotspot, an ISP middlebox — reads the session
    // token straight out of the request headers. HTTPS without `HSTS` still
    // permits one plaintext request before the browser remembers, so
    // "we are always on HTTPS" does not make this attribute redundant.
    expect(set[0].options.secure).toBe(true);
  });

  it('keeps secure true when it is asked for explicitly', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter({ secure: true });

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    expect(set[0].options.secure).toBe(true);
  });

  it("sets sameSite to 'lax'", () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // This is the whole CSRF story for the cross-site case, and it is the
    // reason D48 chose a cookie over a header token: `Lax` attaches the cookie
    // to top-level navigations but not to a subresource load or a cross-site
    // form POST, which is the shape of nearly every CSRF attack.
    //
    // `Strict` is NOT used, and the reason is a product decision rather than a
    // security one: a `Strict` cookie is withheld on the top-level navigation
    // that arrives from the identity provider's redirect, so every Google
    // sign-in would land on a page rendered as signed-out and then recover a
    // moment later. `Lax` is the strongest value that keeps login working.
    // The subdomain gap `Lax` leaves open is covered by `CsrfGuard`.
    expect(set[0].options.sameSite).toBe('lax');
  });

  it("sets path to '/'", () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // A narrower path makes the cookie invisible to every route it was not
    // issued under, which is not a security win — it is a support incident
    // where logout on `/auth/logout` cannot see a cookie scoped to `/auth`.
    // The path must be identical on issue and on clear or the clear silently
    // does nothing, leaving a valid credential in the browser.
    expect(set[0].options.path).toBe('/');
  });

  it('gives the cookie the same name the session repository is asked to resolve', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // A name that drifts from what `ISessionRepository.findByToken` is given
    // produces a login that appears to succeed and authenticates nobody.
    expect(set[0].name).toBe('eduflow_session');
  });

  it('never sets a Domain attribute', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // Omitting `Domain` scopes the cookie to the exact host, so an
    // attacker-controlled sibling subdomain cannot read or overwrite it — the
    // "cookie tossing" primitive. This is half of what the `__Host-` prefix
    // would enforce; the prefix is not used because it would forbid the
    // plain-HTTP local-development escape that `secure: false` exists for.
    // See the note on SESSION_COOKIE_NAME in the port.
    expect(set[0].options).not.toHaveProperty('domain');
  });
});

describe('SessionCookieAdapter — the value', () => {
  it('puts the raw token in the cookie, unchanged', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // The repository returns `sessionTokenPlaintext` exactly once and stores
    // only its SHA-256 hash. Hashing again here, or wrapping it in an object,
    // would produce a cookie the server cannot resolve to a session.
    expect(set[0].value).toBe(TOKEN);
  });

  it('does not put a JSON blob in the cookie', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // A cookie carrying `{"userId":...,"role":...}` invites every future change
    // to "just read the role from the cookie", and the browser lets anyone read
    // it unless it is httpOnly — at which point it is unreadable anyway. The
    // transport carries one opaque string and the server resolves it.
    expect(set[0].value.startsWith('{')).toBe(false);
    expect(() => JSON.parse(set[0].value)).toThrow();
  });

  it('rejects an empty token rather than setting an empty cookie', () => {
    const { carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    // An empty cookie value would sit in the browser looking like a session
    // and resolve to nothing on every request, which reads as "logged out" far
    // less clearly than a request that never got a cookie.
    expect(() => subject.issue({ carrier, rawToken: '', ttlMs: 60 * MINUTE })).toThrow(
      InvalidSessionCookieError,
    );
  });

  it('rejects a token that is only whitespace', () => {
    const { carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    expect(() => subject.issue({ carrier, rawToken: '   ', ttlMs: 60 * MINUTE })).toThrow(
      InvalidSessionCookieError,
    );
  });
});

describe('SessionCookieAdapter — expiry comes from IClock', () => {
  it('sets the expiry to now plus the ttl', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 30 * MINUTE });

    expect(set[0].options.expires).toEqual(instant('2026-03-01T09:30:00.000Z'));
  });

  it('uses the injected clock, not ambient time', () => {
    const { set, carrier } = recordingResponse();
    const clock = new FakeClock(instant('1999-12-31T23:59:00.000Z'));
    const subject = new SessionCookieAdapter({ clock });

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // The real date is 2026. If this produced anything near that, the adapter
    // had read the wall clock and the FakeClock assertion above was passing for
    // the wrong reason.
    //
    // 23:59 plus one hour is 00:59, not midnight — written out here because the
    // first version of this line expected 00:00 and was wrong.
    expect(set[0].options.expires).toEqual(instant('2000-01-01T00:59:00.000Z'));
  });

  it('moves with the clock, because the clock is the source', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject, clock } = adapter();

    clock.advance(24 * 60 * MINUTE);
    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 10 * MINUTE });

    expect(set[0].options.expires).toEqual(instant('2026-03-02T09:10:00.000Z'));
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['fractional', 1_500.5],
  ])('rejects a %s ttl', (_label, ttlMs) => {
    const { carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    // Each of these produces a cookie the browser cannot interpret: `NaN`
    // becomes an `Invalid Date`, which serialises to an `Expires` attribute of
    // "Invalid Date" and is silently discarded, leaving a session cookie with no
    // expiry at all — a credential that outlives every session by construction.
    expect(() => subject.issue({ carrier, rawToken: TOKEN, ttlMs })).toThrow(
      InvalidSessionCookieError,
    );
  });

  it('writes exactly one cookie per issue', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    expect(set).toHaveLength(1);
  });
});

describe('SessionCookieAdapter — clear', () => {
  it('expires the cookie immediately and empties it', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.clear(carrier);

    // Clearing is done by *issuing* an already-dead cookie rather than by
    // calling a separate clear API. One serialiser means the attributes cannot
    // drift between set and clear, and it sidesteps the `Expires` vs `Max-Age`
    // trap entirely: RFC 6265 gives `Max-Age` precedence, so two mechanisms
    // computed from two clocks can disagree, and the cookie then survives the
    // logout that was supposed to remove it.
    expect(set[0].value).toBe('');
    expect(set[0].options.expires).toEqual(instant('1970-01-01T00:00:00.000Z'));
  });

  it('clears with the same name, path and attributes it issued with', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });
    subject.clear(carrier);

    const [issued, cleared] = set;
    expect(cleared.name).toBe(issued.name);
    expect(cleared.options.path).toBe(issued.options.path);
    expect(cleared.options.httpOnly).toBe(issued.options.httpOnly);
    expect(cleared.options.secure).toBe(issued.options.secure);
    expect(cleared.options.sameSite).toBe(issued.options.sameSite);
  });

  it('keeps the cookie attributes secure on a clear from a default adapter', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    subject.clear(carrier);

    // A browser matches a deletion on name, domain and path — but the deletion
    // must also satisfy the `Secure` requirement, and an implementation that
    // rebuilt the attributes from defaults on the clear path is exactly how a
    // logout leaves a live credential behind after a config change.
    expect(set[0].options.httpOnly).toBe(true);
    expect(set[0].options.secure).toBe(true);
    expect(set[0].options.sameSite).toBe('lax');
  });

  it('returns the same cookie object it handed the carrier', () => {
    const { set, carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    const issued: SessionCookie = subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

    // So a caller can assert on the policy without a response in the way, and
    // so there is no possibility of the returned policy and the written policy
    // being two different objects built by two different code paths.
    expect(issued).toEqual({
      name: 'eduflow_session',
      value: TOKEN,
      attributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        expiresAt: instant('2026-03-01T10:00:00.000Z'),
      },
    });
    expect(set[0].name).toBe(issued.name);
    expect(set[0].value).toBe(issued.value);
  });
});

describe('SessionCookieAdapter — the secure exception must be loud', () => {
  it('refuses to construct with secure:false and nothing else', () => {
    // This is the failure the brief names: a cookie that quietly loses `secure`
    // in a deployment. A boolean that reads `secure: false` in a config file
    // with no further ceremony is indistinguishable from a deliberate, reviewed
    // local-development decision, and nobody re-reads config on day one of a
    // production incident.
    expect(() => adapter({ secure: false })).toThrow(InsecureSessionCookieError);
  });

  it('names the risk and the remedy in the refusal', () => {
    let message = '';
    try {
      adapter({ secure: false });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    // A refusal a developer cannot act on gets worked around, and the workaround
    // is usually to make the cookie insecure.
    expect(message).toMatch(/secure/i);
    expect(message).toContain('acknowledgeInsecureLocalhostOnly');
  });

  it('permits secure:false only with the second, explicit acknowledgement', () => {
    const { set, carrier } = recordingResponse();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { adapter: subject } = adapter({
        secure: false,
        acknowledgeInsecureLocalhostOnly: true,
      });

      subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

      expect(set[0].options.secure).toBe(false);
      // Two independent switches: neither a stray `secure: false` nor a stray
      // acknowledgement alone can disable the attribute.
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn when the secure default is in force', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      adapter();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('still applies the other three attributes on the insecure path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { set, carrier } = recordingResponse();
      const { adapter: subject } = adapter({
        secure: false,
        acknowledgeInsecureLocalhostOnly: true,
      });

      subject.issue({ carrier, rawToken: TOKEN, ttlMs: 60 * MINUTE });

      // Dropping `secure` must not become a general relaxation. An
      // implementation that treats the exception as "this is the dev adapter"
      // and relaxes everything is how an insecure cookie becomes the default.
      expect(set[0].options.httpOnly).toBe(true);
      expect(set[0].options.sameSite).toBe('lax');
      expect(set[0].options.path).toBe('/');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SessionCookieAdapter — nothing sensitive escapes in an error', () => {
  it('never puts the token in the message for a bad ttl', () => {
    const { carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    let message = '';
    try {
      subject.issue({ carrier, rawToken: TOKEN, ttlMs: 0 });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    // AGENTS.md 2.13. An error carrying the credential it rejected is the most
    // convenient way to write a live token into a log file, because the caller
    // is already holding it and passes it in on the same line.
    expect(message).not.toContain(TOKEN);
  });

  it('never puts the token in the message for a bad token', () => {
    const { carrier } = recordingResponse();
    const { adapter: subject } = adapter();

    let message = '';
    try {
      subject.issue({ carrier, rawToken: TOKEN, ttlMs: Number.NaN });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).not.toContain(TOKEN);
  });
});
