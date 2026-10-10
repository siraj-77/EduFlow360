import { describe, expect, it } from 'vitest';
import type { SessionCookie } from '../../domain/ports/session-cookie.js';
import { ExpressCookieCarrier, type CookieWritingResponse } from './express-cookie-carrier.js';
import { instant } from '../../../../testing/instant.js';

/**
 * The Express binding, in isolation.
 *
 * ## Provenance, stated plainly
 *
 * This class was written *before* this spec, as the collaborator
 * `session-cookie.spec.ts` needed — that spec exercises the whole path and
 * passes through this code, so the carrier is not untested. But this file was
 * not written first, so no red run is claimed for it. What it adds is the part
 * the adapter spec cannot see: the *absences*, and the option names.
 *
 * The absences are the reason this file is worth having. Every attribute this
 * carrier passes is asserted in the adapter spec. The three it deliberately
 * omits are asserted only here, and they are the three where adding something
 * would look like helpfulness and would be a vulnerability.
 *
 * The absences were also verified by mutation rather than by reading: adding a
 * `domain` key to `setCookie` turns the corresponding test red. See the report.
 */

/** Records every call, so an absence can be asserted as an absence. */
function recorder() {
  const cookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const clearCalls: Array<{ name: string; options: Record<string, unknown> }> = [];

  const response: CookieWritingResponse = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookieCalls.push({ name, value, options });
      return response;
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      clearCalls.push({ name, options });
      return response;
    },
  };

  return { cookieCalls, clearCalls, carrier: new ExpressCookieCarrier(response) };
}

const ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  expiresAt: instant('2026-03-01T10:00:00.000Z'),
} as const;

const COOKIE: SessionCookie = {
  name: 'eduflow_session',
  value: 'localdev-session-token',
  attributes: ATTRIBUTES,
};

describe('ExpressCookieCarrier', () => {
  it('passes each attribute to the option of the same meaning', () => {
    const { cookieCalls, carrier } = recorder();

    carrier.setCookie(COOKIE);

    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0].name).toBe('eduflow_session');
    expect(cookieCalls[0].value).toBe(COOKIE.value);
    expect(cookieCalls[0].options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: ATTRIBUTES.expiresAt,
    });
  });

  it('forwards a false `secure` rather than substituting a default', () => {
    const { cookieCalls, carrier } = recorder();

    carrier.setCookie({ ...COOKIE, attributes: { ...ATTRIBUTES, secure: false } });

    // A carrier written as `secure: attributes.secure ?? true` would pass this
    // test and would make the deliberate local-development exception
    // unreachable, so the false case is asserted directly.
    expect(cookieCalls[0].options.secure).toBe(false);
  });

  it('sends no Domain attribute, which is what prevents cookie tossing', () => {
    const { cookieCalls, carrier } = recorder();

    carrier.setCookie(COOKIE);

    // A `Domain` widens the cookie to sibling subdomains, so an
    // attacker-controlled `shop.school.edu` could overwrite the session cookie
    // and fixate a session of its own choosing. Omitting it scopes the cookie
    // to the exact host, which is half of what the `__Host-` prefix would
    // enforce.
    expect(cookieCalls[0].options).not.toHaveProperty('domain');
  });

  it('sends no Max-Age, because RFC 6265 would let it override Expires', () => {
    const { cookieCalls, carrier } = recorder();

    carrier.setCookie(COOKIE);

    // `Max-Age` takes precedence over `Expires`. Sending both means the browser
    // picks one of two values, and on a cleared cookie a disagreement leaves the
    // credential alive. `expiresAt` already comes from the single injected
    // `IClock`, so there is exactly one source of time in the header.
    expect(cookieCalls[0].options).not.toHaveProperty('maxAge');
  });

  it('sends no encoder override, keeping the framework default', () => {
    const { cookieCalls, carrier } = recorder();

    carrier.setCookie(COOKIE);

    // Express URL-encodes by default, which is what stops a value containing a
    // semicolon from forging an attribute. The session token is base64url and
    // needs no encoding; replacing the default would only remove a protection.
    expect(cookieCalls[0].options).not.toHaveProperty('encode');
  });

  it('carries no attribute the port did not declare', () => {
    const { cookieCalls, carrier } = recorder();

    carrier.setCookie(COOKIE);

    // The whole argument for "attributes as data" is that the set is closed. If
    // the carrier could add a key, a second policy would exist alongside the
    // first and only one of them would be in `session-cookie.ts`.
    expect(Object.keys(cookieCalls[0].options).sort()).toEqual([
      'expires',
      'httpOnly',
      'path',
      'sameSite',
      'secure',
    ]);
  });

  it('uses cookie() for a cleared cookie and never clearCookie()', () => {
    const { cookieCalls, clearCalls, carrier } = recorder();

    carrier.setCookie({
      ...COOKIE,
      value: '',
      attributes: { ...ATTRIBUTES, expiresAt: new Date(0) },
    });

    // One mechanism for both directions. If the clear took a different path
    // then the attributes on that path are a second copy of the policy, and a
    // change to one would not change the other.
    expect(cookieCalls).toHaveLength(1);
    expect(clearCalls).toHaveLength(0);
  });

  it('satisfies the port structurally, with no cast', () => {
    const { carrier } = recorder();

    // The point of declaring `CookieWritingResponse` instead of importing
    // Express's `Response`: this compiles because the real response satisfies
    // the narrow type, and it is checked by `pnpm typecheck`, not asserted here.
    expect(carrier).toBeDefined();
    expect(typeof carrier.setCookie).toBe('function');
  });
});
