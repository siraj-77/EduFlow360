import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@eduflow/shared-types';

import { SESSION_COOKIE_NAME } from './session-cookie-name';

export { SESSION_COOKIE_NAME };

/**
 * A locale-prefixed `/admin` route: `/en/admin`, `/ta/admin/users`, ...
 *
 * Built from `SUPPORTED_LOCALES` rather than written as `(en|ta|si|ar)`,
 * so a fifth locale needs one change in shared-types and none here.
 * `localePrefix: 'always'` is what makes the prefix part of the route,
 * and the trailing `(?:/|$)` is what matches the index and its
 * children without also matching a route that merely starts with the
 * letters.
 */
export const ADMIN_ROUTE_PATTERN = new RegExp(`^/(${SUPPORTED_LOCALES.join('|')})/admin(?:/|$)`);

/**
 * Where an anonymous caller to the console is sent, or `null` to let the
 * request through.
 *
 * ## What this is, and what it is not
 *
 * This is the CHEAP half of `PLT-1002` AC-1, and it is not the security
 * boundary (`AGENTS.md` 2.3: the frontend gate is UX only). It answers
 * one question before any rendering happens — is there a session cookie
 * at all — because the expensive half, `RequirePermission`, answers the
 * real question only after the permissions fetch answers. Without this,
 * an anonymous caller watches a skeleton appear and then vanish, which
 * reads as a broken page rather than as a guard.
 *
 * A cookie that is PRESENT is not a cookie that is VALID. Forged,
 * expired and revoked tokens all pass this check and are refused by the
 * API's `SessionGuard`, which is the boundary. The client-side guard
 * then sends that caller to sign-in carrying `next`, so the two halves
 * fail the same way.
 *
 * @param pathname - the request path, locale-prefixed
 * @param hasSessionCookie - whether the request carried the session cookie
 * @returns the sign-in URL with the destination encoded, or `null`
 */
export function adminRedirect(pathname: string, hasSessionCookie: boolean): string | null {
  const locale = ADMIN_ROUTE_PATTERN.exec(pathname)?.[1];
  if (locale === undefined) {
    return null;
  }

  if (hasSessionCookie) {
    return null;
  }

  // The destination is encoded, because it becomes a query parameter.
  // It is the request's own path, so it is a path this app serves by
  // construction — no round-trip through `safeNextPath` is needed HERE,
  // though the value is checked again where it is read.
  return `/${locale}/sign-in?next=${encodeURIComponent(pathname)}`;
}

/** The default locale, re-exported so callers need not reach for shared-types. */
export { DEFAULT_LOCALE };
