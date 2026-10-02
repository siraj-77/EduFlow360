import { describe, expect, it } from 'vitest';
import { isTrustedAuthorizationUrl } from './oidc-authorization-target.js';

/**
 * Where this server is willing to send a browser, as a rule.
 *
 * ## Why this is table-driven and not a happy-path test
 *
 * The single most expensive failure on this route is not a crash. It is a
 * `302` to a host an attacker chose, on a route that is `@Public` and therefore
 * reachable by anyone. The interesting cases are therefore all the ways a URL
 * *looks* like the one we wanted:
 *
 * - `https://accounts.google.com.evil.test` - a subdomain of the real host
 * - `https://accounts.google.com@evil.test` - the real host as userinfo
 * - `http://accounts.google.com` - the real host, downgraded
 * - `javascript:` and `//host` - not a URL at all, or a protocol-relative one
 *
 * `AGENTS.md` 4.1 asks for exactly this: "Cover boundary conditions
 * explicitly, not just the happy path."
 *
 * ## What the rule may and may not know
 *
 * It is handed the one origin this deployment trusts. It does not hold a list of
 * providers, does not know what Google is, and cannot be widened by adding an
 * entry somewhere. `auth.module.ts` derives that single origin from
 * configuration at start-up. See `oidc-authorization-target.ts` for why that
 * derivation is honest about its own circularity.
 */
describe('isTrustedAuthorizationUrl', () => {
  const GOOGLE = 'https://accounts.google.com';

  describe('accepts', () => {
    it.each([
      {
        case: 'the expected origin, with a path and query',
        candidate: `${GOOGLE}/o/oauth2/v2/auth?client_id=x&state=y`,
      },
      {
        case: 'the expected origin, with no path',
        candidate: GOOGLE,
      },
      {
        case: 'a different path, because the origin is the boundary, not the path',
        candidate: `${GOOGLE}/some/other/path`,
      },
      {
        case: 'an uppercase host, because DNS names are case-insensitive',
        candidate: 'https://ACCOUNTS.GOOGLE.COM/o/oauth2/v2/auth',
      },
      {
        case: 'an explicit :443, because that is the same origin',
        candidate: 'https://accounts.google.com:443/o/oauth2/v2/auth',
      },
    ])('$case', ({ candidate }) => {
      expect(isTrustedAuthorizationUrl(candidate, GOOGLE)).toBe(true);
    });
  });

  describe('rejects', () => {
    it.each([
      { case: 'plain http on the expected host', candidate: 'http://accounts.google.com/auth' },
      {
        case: 'a subdomain of the expected host',
        candidate: 'https://accounts.google.com.evil.test/auth',
      },
      {
        case: 'the expected host presented as userinfo',
        candidate: 'https://accounts.google.com@evil.test/auth',
      },
      {
        case: 'an unexpected port on the expected host',
        candidate: 'https://accounts.google.com:8443/auth',
      },
      {
        case: 'userinfo on the expected host, which still resolves to Google',
        candidate: 'https://someone@accounts.google.com/auth',
      },
      { case: 'an unrelated host', candidate: 'https://evil.test/auth' },
      { case: 'a scheme-relative URL', candidate: '//accounts.google.com/auth' },
      { case: 'a javascript: URL', candidate: 'javascript:alert(1)' },
      { case: 'a data: URL', candidate: 'data:text/html,<script>1</script>' },
      { case: 'a string that is not a URL at all', candidate: 'accounts.google.com/auth' },
      { case: 'an empty string', candidate: '' },
      {
        case: 'a protocol other than http or https, on the expected host',
        candidate: 'ftp://accounts.google.com/auth',
      },
    ])('$case', ({ candidate }) => {
      expect(isTrustedAuthorizationUrl(candidate, GOOGLE)).toBe(false);
    });
  });

  it('refuses a plain-http origin even when that is the origin it was handed', () => {
    // The fail-closed property. If configuration ever handed this rule an
    // `http://` origin - a typo, a staging copy-paste - the rule does not
    // become permissive with it. It refuses, and the route 500s on a
    // misconfiguration rather than sending a browser over cleartext.
    expect(
      isTrustedAuthorizationUrl('http://accounts.google.com/auth', 'http://accounts.google.com'),
    ).toBe(false);
  });

  it('refuses when the expected origin is not itself https', () => {
    expect(isTrustedAuthorizationUrl('http://accounts.google.com/auth', 'not a url')).toBe(false);
  });

  it('does not accept a host that merely *contains* the expected host', () => {
    // The specific shape a substring check would let through, and the reason
    // this is an origin comparison and not `includes()`.
    expect(
      isTrustedAuthorizationUrl('https://evil.test/?x=https://accounts.google.com', GOOGLE),
    ).toBe(false);
  });

  it('is not fooled by a trailing dot, which browsers resolve but origins do not', () => {
    // `accounts.google.com.` is a distinct cookie origin and a distinct
    // `Location` target. The URL parser keeps it, so the comparison fails and
    // the redirect is refused rather than sent somewhere a certificate check
    // would treat differently.
    expect(isTrustedAuthorizationUrl('https://accounts.google.com./auth', GOOGLE)).toBe(false);
  });
});
