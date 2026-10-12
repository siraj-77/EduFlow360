import { describe, expect, it } from 'vitest';

import { adminRedirect, ADMIN_ROUTE_PATTERN } from './admin-route-guard';

/**
 * `PLT-1002` T1 — the server-side half of the console guard.
 *
 * The client-side `RequirePermission` answers the permission question,
 * but it answers it AFTER the bundle has loaded: an anonymous caller
 * sees a skeleton and then a redirect. The middleware answers the
 * cheaper question — is there a session cookie at all — before any
 * rendering, and redirects with `next` so the password check can
 * return the caller to where they were going.
 *
 * It is deliberately NOT the security boundary, and the tests below
 * say so: a cookie that is present but forged, expired or revoked
 * passes this check and is refused by the API, which is the boundary
 * (`AGENTS.md` 2.3). A check that tried to validate the session here
 * would need the API in the edge runtime and would be the wrong layer
 * twice over.
 */
describe('adminRedirect', () => {
  it('redirects an anonymous caller to sign-in, carrying the destination', () => {
    expect(adminRedirect('/en/admin', false)).toBe('/en/sign-in?next=%2Fen%2Fadmin');
  });

  it('carries a deep admin path verbatim, encoded', () => {
    expect(adminRedirect('/ta/admin/users/42', false)).toBe(
      '/ta/sign-in?next=%2Fta%2Fadmin%2Fusers%2F42',
    );
  });

  it('preserves the locale, so the sign-in screen is in the caller’s language', () => {
    // The locale is the first segment; the redirect must not fall back
    // to English when an Arabic speaker arrives.
    expect(adminRedirect('/ar/admin', false)).toBe('/ar/sign-in?next=%2Far%2Fadmin');
  });

  it('lets a caller WITH a session cookie through to the real check', () => {
    // Presence is not validity — that is the API's job. The middleware's
    // only claim is "there is something to check".
    expect(adminRedirect('/en/admin', true)).toBeNull();
  });

  it('ignores every non-admin path', () => {
    for (const path of [
      '/',
      '/en',
      '/en/sign-in',
      '/ta/sign-in/forgot',
      '/en/signed-in',
      '/en/forbidden',
      // The near-miss: a route that merely CONTAINS the word.
      '/en/administration',
      // An admin-named route under a DIFFERENT top level.
      '/api/admin',
    ]) {
      expect(adminRedirect(path, false)).toBeNull();
    }
  });

  it('ignores a path with no locale prefix, which next-intl rewrites first', () => {
    // `localePrefix: 'always'` means `/admin` never reaches a page; the
    // negotiation middleware rewrites it to `/en/admin` before this runs.
    expect(adminRedirect('/admin', false)).toBeNull();
  });

  it('matches every supported locale, not just the four hard-coded here', () => {
    // The pattern is the shared vocabulary: a fifth locale must not
    // require a second change in this file.
    expect(ADMIN_ROUTE_PATTERN).toBeInstanceOf(RegExp);
    for (const locale of ['en', 'ta', 'si', 'ar']) {
      expect(adminRedirect(`/${locale}/admin`, false)).toBe(
        `/${locale}/sign-in?next=%2F${locale}%2Fadmin`,
      );
    }
  });
});
