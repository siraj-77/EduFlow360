import { describe, expect, it } from 'vitest';
import { OIDC_STATE_COOKIE_NAME, OIDC_STATE_COOKIE_PATH } from './oidc-state-store.js';

/**
 * The wire constants of the OIDC state cookie.
 *
 * `session-cookie.spec.ts` holds this shape for the session cookie, and it is
 * worth repeating rather than generalising: these are not names, they are a
 * **contract with the browser**.
 *
 * A cookie name carrying a separator makes the `Set-Cookie` header ambiguous,
 * and browsers disagree about how to parse an ambiguous header. Some truncate at
 * the first invalid octet and keep a cookie under a *different* name than the
 * server believes it wrote - a sign-in that appears to work and authenticates
 * nobody, on one browser and not another. The path has the same class of risk in
 * the other direction: too narrow and the callback never receives the cookie.
 */
describe('OIDC_STATE_COOKIE_NAME', () => {
  it('is a bare token, with no separator that could split the header', () => {
    expect(OIDC_STATE_COOKIE_NAME).not.toMatch(/[=;\s]/);
  });

  it('is non-empty and lower-case', () => {
    expect(OIDC_STATE_COOKIE_NAME.length).toBeGreaterThan(0);
    expect(OIDC_STATE_COOKIE_NAME).toBe(OIDC_STATE_COOKIE_NAME.toLowerCase());
  });

  it('is not the session cookie, so clearing one can never clear the other', () => {
    // Two cookies on one origin share the `name`, `domain` and `path` triple for
    // deletion. A state cookie issued under the session cookie's name would be
    // deleted by every logout, and a logout issued under the state cookie's name
    // would leave a live session behind.
    expect(OIDC_STATE_COOKIE_NAME).not.toBe('eduflow_session');
  });

  it('is not a name a script may read', () => {
    // The bundle holds the PKCE verifier. A readable sibling cookie would give an
    // XSS the verifier and with it the ability to redeem an intercepted code.
    expect(OIDC_STATE_COOKIE_NAME).not.toMatch(/token|csrf|xsrf|verifier/i);
  });
});

describe('OIDC_STATE_COOKIE_PATH', () => {
  it('is scoped to the OIDC routes, and reaches the callback', () => {
    // The narrowest path that still covers both routes this flow uses. A cookie
    // at `/` would ride along on every request the browser makes to this origin,
    // which is a strictly larger exposure for no benefit: the bundle is only ever
    // read by the callback.
    expect(OIDC_STATE_COOKIE_PATH).toBe('/auth/oidc');
  });

  it('is a prefix of the callback path the redirect URI carries', () => {
    // The failure this prevents is silent and total: the browser holds a valid
    // signed bundle it will never send, and every sign-in ends at a callback that
    // reports no state.
    expect('/auth/oidc/callback'.startsWith(OIDC_STATE_COOKIE_PATH)).toBe(true);
  });

  it('does not end in a slash, which would silently widen nothing and break the match', () => {
    // RFC 6265 path matching treats a trailing slash as a different path string.
    expect(OIDC_STATE_COOKIE_PATH).not.toMatch(/\/$/);
  });
});
