import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { adminRedirect } from './lib/admin-route-guard';
import { SESSION_COOKIE_NAME } from './lib/session-cookie-name';

/**
 * Locale negotiation, then the console's first gate.
 *
 * `i18n/routing.ts` sets `localePrefix: 'always'`, so every real route is
 * locale-prefixed: `/en`, `/ta`, `/si`, `/ar`. That makes the bare root `/`
 * match no page, and without this middleware it is a hard 404. A visitor who
 * types the site address saw "This page could not be found", and a visitor whose
 * browser prefers Tamil was sent nowhere in particular.
 *
 * `createMiddleware(routing)` redirects `/` to the best-matching locale, using
 * `Accept-Language` and falling back to `defaultLocale` (`en`). It also sets the
 * `NEXT_LOCALE` cookie so a later visit skips negotiation.
 *
 * WHY THE FILE IS `src/middleware.ts` AND NOT `proxy.ts`
 * ------------------------------------------------------
 * `proxy.ts` was the Next 16 filename. Next 15 looks for `middleware.ts`, at the
 * project root or in `src/`. The compiled manifest said so plainly -
 * `middleware: {}`, `sortedMiddleware: []` - i.e. zero middleware emitted, and
 * nothing in the build failed or warned.
 *
 * `proxy.ts` was also *redundant* rather than merely misnamed: it exported
 * `createNextIntlPlugin('./src/i18n/request.ts')({})`, and `next.config.ts`
 * already applies that same plugin to the real config. So it wired a wrapped
 * config object that nothing consumed. It is deleted rather than renamed,
 * because renaming it would have produced a middleware that negotiated nothing.
 *
 * This is a deletion, not the rename D31 anticipated. D31's intent - do not
 * upgrade to Next 16 to chase a filename, fix it on 15 - is unchanged. (D31, D43)
 *
 * UI only (AGENTS.md 3.1): this negotiates a locale and sets a cookie. It
 * proxies nothing, fetches nothing, and is not a stand-in for the API.
 */
const negotiateLocale = createMiddleware(routing);

/**
 * `PLT-1002` T1 — the console's server-side gate.
 *
 * Order matters: locale negotiation runs FIRST, because the admin check needs
 * the locale-prefixed path (`/en/admin`, not `/admin`), and a bare `/admin` is
 * rewritten by the line below before this one sees it.
 *
 * The check itself is a COOKIE-PRESENCE test, and it is not the boundary
 * (`AGENTS.md` 2.3): a forged, expired or revoked session passes it and is
 * refused by the API. What it buys is that an anonymous caller is redirected
 * before any rendering, instead of watching a skeleton appear and disappear —
 * which reads as a broken page rather than as a guard. The permission question
 * itself is answered by `RequirePermission` on the client and
 * `@RequirePermission` on the API, both of which are the real gates.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const redirect = adminRedirect(pathname, request.cookies.has(SESSION_COOKIE_NAME));
  if (redirect !== null) {
    return NextResponse.redirect(new URL(redirect, request.url));
  }

  return negotiateLocale(request);
}

export const config = {
  /**
   * Skip Next internals, the API surface, and anything with a file extension
   * (static assets, `robots.txt`, `favicon.ico`, images).
   *
   * The `.*\\..*` term is the load-bearing one: without it the matcher would
   * send every `.js` and `.css` request through the middleware and rewrite
   * asset URLs into locale-prefixed paths that do not exist.
   */
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
