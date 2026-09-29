import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Locale negotiation.
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
export default createMiddleware(routing);

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
