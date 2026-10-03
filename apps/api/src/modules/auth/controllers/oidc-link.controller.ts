import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { requirePrincipal, type PrincipalCarrier } from '../../../common/guards/session.guard.js';
import { Audited, RequirePermission } from '../../../common/guards/route-guards.decorator.js';
import type { RequestWithAddress } from '../../../common/http/request-context.js';
import {
  ExpressCookieCarrier,
  type CookieWritingResponse,
} from '../infrastructure/adapters/express-cookie-carrier.js';
import { OIDC_STATE_COOKIE_PATH } from '../domain/ports/oidc-state-store.js';
// A VALUE import, used by `@Inject` below — deliberately not `import type`. See
// `oidc-sign-in.controller.ts` for the two rules that collide here and how the
// collision is resolved, and `D60` for what it costs to get it wrong: the deployed
// application cannot boot, while `tsc`, lint and the build all report success.
import { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';

/**
 * `GET /auth/oidc/link` — start a flow that binds a Google identity to an account.
 *
 * ## Why this route exists at all
 *
 * `D57` ratified **must-link** Google sign-in: an identity is authorised by an
 * `ExternalIdentity` row, and no row is created by signing in. So somebody has to
 * create it, and the only moment at which the system knows *which* account to attach
 * it to is a moment when that account is authenticated.
 *
 * That is this route, and its whole reason to exist separately from
 * `GET /auth/oidc/redirect` is the authentication it requires.
 */

/** The response methods this route uses. Declared, not imported — see the sibling. */
interface RedirectingResponse extends CookieWritingResponse {
  /** Express's `res.redirect(status, url)`. Chainable; the value is unused. */
  redirect(status: number, url: string): unknown;
}

/**
 * What to persist about the request. The principal is there because `SessionGuard`
 * put it there; `requirePrincipal` throws rather than returning `null`, so this
 * handler has no "and if there is no caller" branch to forget to write.
 */
type LinkRequest = RequestWithAddress & PrincipalCarrier;

/**
 * ## `@RequirePermission` is here, and it enforces NOTHING yet
 *
 * Stated plainly, because a decorator reads like a control:
 *
 * - **It is not `@Public`.** That is the load-bearing decision. `@Public` is the
 *   exemption marker `SessionGuard` honours, so marking this route `@Public` would
 *   remove the authentication and leave a link endpoint anyone could call.
 * - **`SessionGuard` is what authenticates it, today.** It is registered globally
 *   with no per-route opt-in, and this route carries no exemption, so a request
 *   without a live session never reaches this handler.
 * - **The permission itself is unread.** No guard reads `@RequirePermission` in this
 *   repository — that is `PLT-2xx` and the RBAC engine. `check-route-guards` proves the
 *   key is PRESENT; it cannot prove anything is checked. `route-guards.decorator.ts`
 *   says so at the top of the file, and this paragraph exists so nobody reads the
 *   decorator below as an implemented control.
 *
 * `AUTH_LINK_EXTERNAL_IDENTITY` is the `MODULE_ACTION` key `ADR-012` asks for. It
 * names a real action on a real account, which is what makes it the right thing to
 * gate when the engine lands.
 */
@Controller('auth')
export class OidcLinkController {
  constructor(@Inject(BeginOidcSignIn) private readonly beginSignIn: BeginOidcSignIn) {}

  /**
   * Begin a link flow for the signed-in account.
   *
   * ## Why this handler reads a principal and nothing else
   *
   * `requirePrincipal` is the ONLY source of the account this flow will link to. It
   * reads what `SessionGuard` resolved from the session cookie, so the account is
   * established by a verified credential rather than by anything in the URL.
   *
   * There is no `userId` parameter, no `?account=` and no `return_to`. A route that
   * took one would let a caller bind an identity to an account of their choosing,
   * which is the same class of bug as the open redirect `oidc-sign-in.controller.ts`
   * refuses to be able to express.
   *
   * ## Why it redirects rather than answering
   *
   * Because the next thing that has to happen is at Google's consent screen, and only
   * a browser can go there. `@Res()` is used, so this handler owns the response — the
   * honest consequence of answering with a `302`, since Nest's declarative return
   * values do not include "302 somewhere".
   */
  @RequirePermission('AUTH_LINK_EXTERNAL_IDENTITY')
  @Audited('OIDC_LINK')
  @Get('oidc/link')
  async link(@Req() request: LinkRequest, @Res() response: RedirectingResponse): Promise<void> {
    const principal = requirePrincipal(request);

    // `beginLink` seals `mode: 'link'` together with this account id, so the account
    // travels to the callback INSIDE the signature. The callback is `@Public` and will
    // therefore have no session to read this from — which is precisely why the value
    // has to be in there.
    const { redirectTo, stateCookie } = await this.beginSignIn.beginLink(principal.userId);

    // The state cookie must reach the callback, and its path is `/auth/oidc`, which
    // covers `/auth/oidc/callback`. That is asserted in `oidc-state-store.spec.ts`
    // against the configured redirect URI; if the callback were ever moved, both this
    // constant and `GOOGLE_REDIRECT_URI` would have to move with it.
    if (stateCookie.attributes.path !== OIDC_STATE_COOKIE_PATH) {
      // Unreachable unless a store change moved the path without moving the callback.
      // Throwing is right: a cookie whose path does not cover the callback is a failed
      // sign-in with no diagnosis, and this is the one place the two are visible
      // together.
      throw new Error(
        `The OIDC state cookie is scoped to ${stateCookie.attributes.path}, which does not ` +
          `cover the callback at /auth/oidc/callback. A link flow started here could never be ` +
          `completed. See OIDC_STATE_COOKIE_PATH in domain/ports/oidc-state-store.ts.`,
      );
    }

    // Request-scoped, because it wraps *this* response. Same reasoning as the redirect
    // route: a singleton carrier would have to be handed a response per call, which is
    // the god-interface shape `ICookieCarrier` warns against.
    new ExpressCookieCarrier(response).setCookie(stateCookie);

    // 302 Found. Deliberately not 307: this request is a GET with no body, and 307
    // would preserve a method that has no meaning here.
    response.redirect(302, redirectTo);
  }
}
