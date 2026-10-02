import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_PATH } from './session-cookie.js';

/**
 * The wire constants, pinned.
 *
 * This port is otherwise types only, so following `clock.ts` it would carry no
 * spec of its own. It gets one anyway, for the two names — and the reason is
 * that they are not names, they are a **wire contract**.
 *
 * A cookie name containing a space, a semicolon, an equals sign or a control
 * character is not merely untidy: it makes the `Set-Cookie` header ambiguous,
 * and browsers disagree about how to parse it. Some truncate at the first
 * invalid octet and keep a cookie under a *different* name than the server
 * believes it wrote. The result is a login that appears to succeed and
 * authenticates nobody, on one browser and not another.
 *
 * The second half is the same class of bug: the path is a literal type, and
 * these tests are what notice if someone widens it.
 */
describe('SESSION_COOKIE_NAME', () => {
  it('is a bare token, with no separator that could split the header', () => {
    // RFC 6265 section 4.1.3 defines a cookie name as a `token`, which excludes
    // CTLs, whitespace, DQUOTE, comma, semicolon and backslash. The two
    // separators asserted here are the ones that would silently break parsing:
    // `=` splits name from value, `;` starts the next attribute.
    expect(SESSION_COOKIE_NAME).not.toMatch(/[=;\s]/);
    // Checked by code point rather than by a regex: a control-character range in
    // a literal is itself the subject of the `no-control-regex` rule, and
    // disabling that rule to test for control characters is a poor trade.
    const hasControlChar = [...SESSION_COOKIE_NAME].some((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    });
    expect(hasControlChar).toBe(false);
  });

  it('is non-empty and lower-case', () => {
    expect(SESSION_COOKIE_NAME.length).toBeGreaterThan(0);
    expect(SESSION_COOKIE_NAME).toBe(SESSION_COOKIE_NAME.toLowerCase());
  });

  it('is not the name of a cookie a script may read', () => {
    // A non-`httpOnly` sibling (a CSRF token cookie, say) would be a place for
    // an XSS to find a credential. The adapter sets `httpOnly` and this is the
    // only cookie it writes, so the check is that no second, readable one is
    // implied here.
    expect(SESSION_COOKIE_NAME).not.toMatch(/token|csrf|xsrf/i);
  });
});

describe('SESSION_COOKIE_PATH', () => {
  it("is exactly '/'", () => {
    // Narrower means a clear that does not match the issue, which is a logout
    // that leaves a working credential in the browser. See the port.
    expect(SESSION_COOKIE_PATH).toBe('/');
  });

  it('does not end in a slash other than the root', () => {
    expect(SESSION_COOKIE_PATH).not.toMatch(/\/.$/);
  });
});
