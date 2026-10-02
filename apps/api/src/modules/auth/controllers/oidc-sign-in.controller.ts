import { Controller, Get, Res } from '@nestjs/common';
import { Public } from '../../../common/guards/public.decorator.js';
import {
  ExpressCookieCarrier,
  type CookieWritingResponse,
} from '../infrastructure/adapters/express-cookie-carrier.js';
import type { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';

/**
 * `GET /auth/oidc/redirect` — the route that starts a sign-in.
 *
 * The first controller in this repository, which makes its shape the precedent
 * for every route after it. Three things about it are decisions rather than
 * defaults.
 */

/**
 * The response methods this route uses.
 *
 * **Declared, not imported.** `express` is a transitive dependency of
 * `@nestjs/platform-express` and is not in this package's `package.json`, so
 * importing its types would make a package this one does not declare
 * load-bearing. Structural typing lets the real `Response` satisfy this without
 * a cast or an `any` — the same arrangement `ExpressCookieCarrier` uses.
 */
interface RedirectingResponse extends CookieWritingResponse {
  /**
   * Express's `res.redirect(status, url)`.
   *
   * Typed as returning `unknown` because it is chainable and the return value is
   * deliberately unused.
   */
  redirect(status: number, url: string): unknown;
}

/**
 * The `@Public` justification, as a named constant.
 *
 * ## Why it is a constant and not an inline string
 *
 * Two reasons, and the second is mechanical rather than stylistic.
 *
 * 1. It is long, and `AGENTS.md` 2.3 asks an exemption to be *justifiable*, not
 *    merely present. The full argument also lives in
 *    `route-guards.allowlist.json`, which is the artefact `AGENTS.md` points a
 *    reviewer at; this is the copy that travels with the code.
 * 2. **`check-route-guards.mjs` reads the line immediately above the route
 *    decorator.** A multi-line `@Public(...)` call puts the route decorator three
 *    lines below the `@Public(`, the checker sees an unguarded route, and
 *    `pnpm check:route-guards` fails on a route that is in fact guarded. That is
 *    the gate working — it caught exactly this on the first attempt — and the
 *    fix is a single-line call, not a change to the gate.
 */
const OIDC_REDIRECT_PUBLIC_REASON =
  'Starts a Google OIDC sign-in. It is the only route reachable before a session exists, so a ' +
  'permission check here would require the permission the route exists to obtain. It grants ' +
  'nothing and changes nothing: no session, no row, no school data, no role consulted. Hence ' +
  'no @RequireEntitlement, and no @Audited — that belongs on the callback, where a stranger ' +
  'assertion becomes a local account.';

/**
 * ## Why this route is `@Public`, in full
 *
 * `AGENTS.md` 2.3: "`@Public('<reason>')` is the only exemption from
 * `@RequirePermission`. The reason is mandatory." Both halves hold here: the
 * reason is not blank (`Public('')` throws at the call site), and the use is
 * reconciled against `route-guards.allowlist.json` in both directions by
 * `pnpm check:route-guards`.
 *
 * It is safe because of what it does **not** do. No `@RequireEntitlement`: it
 * touches no school data, so a Basic-edition school is not thereby reaching
 * anything a Deluxe one can. No `@Audited`: nothing has happened yet. No
 * `@RequirePermission`: there is no role to check, and the route's own output —
 * a URL plus a cookie of values the provider generated — is not a capability.
 */
@Controller('auth')
export class OidcSignInController {
  constructor(private readonly beginSignIn: BeginOidcSignIn) {}

  /**
   * Begin a sign-in.
   *
   * ## Why this handler takes no request object
   *
   * Not `@Query()`, not `@Req()`, not `@Body()`. A redirect route that reads
   * `?state=`, `?return_to=` or `?redirect_uri=` from the caller is an open
   * redirect and a login-CSRF primitive, and the cheapest way to make that
   * impossible is for the handler to have no way to ask. The use-case takes zero
   * arguments for the same reason, and
   * `begin-oidc-sign-in.spec.ts` asserts that arity so a later convenience
   * parameter fails a test instead of a review.
   *
   * ## Why the URL is not built here
   *
   * `@Res()` is used, so this handler owns the response. That is the honest
   * consequence of answering with a redirect: Nest's declarative return values do
   * not include "302 somewhere", and a filter or an interceptor that tried to add
   * one would be a second opinion about where a browser goes.
   *
   * The URL itself comes from the use-case, which got it from the provider and
   * checked its origin first (`oidc-authorization-target.ts`). A controller that
   * assembled a redirect URL would be the thing under review.
   */
  @Public(OIDC_REDIRECT_PUBLIC_REASON)
  @Get('oidc/redirect')
  async begin(@Res() response: RedirectingResponse): Promise<void> {
    const { redirectTo, stateCookie } = await this.beginSignIn.begin();

    // Request-scoped, because it wraps *this* response. Constructing it here is
    // the honest option: a singleton carrier would have to be handed a response
    // per call, which is the god-interface shape `ICookieCarrier`'s comment warns
    // against. The cookie's attributes were decided by the state store; this only
    // serialises them.
    new ExpressCookieCarrier(response).setCookie(stateCookie);

    // 302 Found, deliberately. `307` would preserve the method and the body, which
    // is meaningful for a POST callback and meaningless here; and a `Location`
    // this route has already verified is the whole response.
    response.redirect(302, redirectTo);
  }
}
