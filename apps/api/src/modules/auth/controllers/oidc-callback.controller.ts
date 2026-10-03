import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../../../common/guards/public.decorator.js';
import { Audited } from '../../../common/guards/route-guards.decorator.js';
import {
  sourceAddressOf,
  toDeviceContext,
  type RequestWithAddress,
} from '../../../common/http/request-context.js';
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
import type { ThrottlePolicy } from '../../../common/throttle/fixed-window-throttle.js';
import { readCookieHeader } from '../../../common/guards/session.guard.js';
import {
  IOIDC_STATE_STORE,
  OIDC_STATE_COOKIE_NAME,
  type IOidcStateStore,
} from '../domain/ports/oidc-state-store.js';
import type { OidcCallbackQuery } from '../domain/ports/oidc-provider.js';
import {
  ExpressCookieCarrier,
  type CookieWritingResponse,
} from '../infrastructure/adapters/express-cookie-carrier.js';
import { SessionCookieAdapter } from '../infrastructure/adapters/session-cookie.js';
import { CLOCK, type IClock } from '../domain/ports/clock.js';
import {
  CompleteOidcCallback,
  type OidcCallbackOutcome,
} from '../use-cases/complete-oidc-callback.js';

/** The throttle configuration for this route, as a DI token. Declared here for the
 *  same structural reason `LOGIN_THROTTLE_POLICY` is: the module imports this
 *  controller, so importing the token back out of the module would close a cycle. */
export const OIDC_CALLBACK_THROTTLE_POLICY = Symbol('OIDC_CALLBACK_THROTTLE_POLICY');

/**
 * `@Public` justification, as a single-line named constant.
 *
 * Single-line because `check-route-guards.mjs` walks outward from the route decorator
 * absorbing contiguous decorator lines, and keeping the call on one line is what the
 * three existing public routes do.
 *
 * The full argument also lives in `route-guards.allowlist.json`, which is the artefact
 * a reviewer actually reads.
 */
const OIDC_CALLBACK_PUBLIC_REASON =
  'Sign-in is how a session is obtained, so a permission check would require the permission ' +
  'this route exists to grant: no account, session or role exists before a verified identity ' +
  'is resolved, and D57 makes that lookup the authorisation. It is @Public in the strict sense ' +
  'that it is reachable without a session AND it can NEVER link: the flow mode travels inside ' +
  'the signed state cookie, and only the authenticated link route can seal link mode. No ' +
  '@RequireEntitlement, because a Basic-edition school must still be able to sign in. AGENTS.md ' +
  '2.3, 2.13; D57.';

/**
 * The ONE body every refusal produces.
 *
 * `GET /auth/oidc/callback` has nine refusals and this is all of them: no bundle,
 * forged bundle, expired bundle, `state` mismatch, provider rejection, all four domain
 * refusals, unverified email, unlinked identity, and an identity already bound to
 * another account.
 *
 * **One status, one body, for all nine.** Not because the distinction is unimportant —
 * it is carried in `OidcCallbackOutcome.reason` for the log and the audit — but
 * because a caller who could tell "your state was forged" from "that Google account
 * belongs to somebody else" learns things about this deployment for free. `AGENTS.md`
 * 2.13, and the same rule `password-sign-in.controller.ts` applies with its one frozen
 * `REFUSED_BODY`.
 *
 * `401` rather than `400` because this route has no credential to be wrong about: the
 * caller is anonymous by necessity, so "you are not authorised" is the honest single
 * answer.
 */
const REFUSED_BODY = Object.freeze({
  statusCode: HttpStatus.UNAUTHORIZED,
  error: 'Unauthorized',
  message: 'That sign-in could not be completed. Start again from the sign-in page.',
});

/**
 * `GET /auth/oidc/callback` — where a stranger's assertion becomes a local account.
 *
 * ## What `@Audited` does and does not do HERE, stated plainly
 *
 * **Nothing yet.** `@Audited('OIDC_CALLBACK')` records a key in route metadata and
 * `PLT-402` is the story that will write it to `audit_records`. Nothing reads the
 * metadata in this repository, so this route produces no audit row today and no test
 * here asserts one — asserting that a mock was called would be asserting a fiction.
 *
 * The decorator is on **this** route rather than on `GET /auth/oidc/redirect` because
 * this is where a stranger's assertion becomes a local account. The redirect mints
 * nothing; this either issues a session or refuses. That is the event an auditor wants.
 *
 * ## Why this route is `@Public` and the link route is not
 *
 * Because they have opposite security postures and the brief for this story is that
 * they must not be merged:
 *
 * | route                  | guard         | may                |
 * |------------------------|---------------|--------------------|
 * | `GET /auth/oidc/link`     | authenticated | link only       |
 * | `GET /auth/oidc/callback` | `@Public`     | **sign in only**  |
 *
 * "If a session cookie is present, link" is account takeover: the victim is signed in,
 * the attacker completes their own Google sign-in in the victim's browser, and this
 * route binds the ATTACKER's identity to the VICTIM's account. So the mode is decided by
 * the route that began the flow, sealed inside `OidcStatePayload`, and this handler has
 * no session cookie, no `userId` parameter and no code path that could produce one.
 */
@Controller('auth')
export class OidcCallbackController {
  constructor(
    // `@Inject(...)` with VALUE imports, never `import type`. `emitDecoratorMetadata`
    // cannot turn a type-only import into a runtime token; this repository shipped that
    // bug once and the application could not boot while `tsc`, lint and the build all
    // reported success. `D60`.
    @Inject(CompleteOidcCallback) private readonly completeCallback: CompleteOidcCallback,
    @Inject(IOIDC_STATE_STORE) private readonly stateStore: IOidcStateStore,
    @Inject(SessionCookieAdapter) private readonly sessionCookie: SessionCookieAdapter,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(FixedWindowThrottle) private readonly throttle: FixedWindowThrottle,
    @Inject(OIDC_CALLBACK_THROTTLE_POLICY) private readonly throttlePolicy: ThrottlePolicy,
  ) {}

  @Public(OIDC_CALLBACK_PUBLIC_REASON)
  @Audited('OIDC_CALLBACK')
  @Get('oidc/callback')
  @HttpCode(HttpStatus.OK)
  async callback(
    @Query() query: unknown,
    // The raw header rather than `@Req()` for the cookie: reading one named cookie out
    // of it is `readCookieHeader`'s tested job, and the header is a string Node has
    // already joined.
    @Headers('cookie') cookieHeader: string | undefined,
    @Req() request: RequestWithAddress,
    // `passthrough`, because the state cookie is cleared on EVERY outcome including a
    // refusal, and a `@Res()` without it would take the response away from Nest's
    // exception filter.
    @Res({ passthrough: true }) response: CallbackResponse,
  ): Promise<CallbackBody> {
    // ── Throttle first, before anything is read. ─────────────────────────────
    // This route is the only one that performs a token exchange, so it is the one
    // worth bounding. Keyed on the SOURCE because an attacker holds no credential to
    // key on. See `fixed-window-throttle.ts` for why in-process is correct on a
    // one-deployment-per-school topology.
    const decision = this.throttle.check(sourceAddressOf(request), this.throttlePolicy);
    if (!decision.allowed) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Too many sign-in attempts from this source. Try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // The state cookie is cleared on every outcome below, including a throw. A bundle
    // left in the browser after a failed callback looks valid to the next request, and
    // `IOidcStateStore.expired()` exists so this cannot invent its own attributes and
    // get the name, path or flags subtly wrong.
    const carrier = new ExpressCookieCarrier(response);

    let outcome: OidcCallbackOutcome;
    try {
      outcome = await this.completeCallback.complete({
        query: toOidcCallbackQuery(query),
        // `readCookieHeader` answers `null` for "absent or unusable"; the use-case
        // parameter is `string | undefined`. Converting here, explicitly, keeps the
        // two vocabularies apart — `null` means "we looked and there was nothing", and
        // `undefined` is the same statement expressed in the parameter's own type.
        stateCookie: readCookieHeader(cookieHeader, OIDC_STATE_COOKIE_NAME) ?? undefined,
        // Conditional spread rather than `device: toDeviceContext(request).device`:
        // `exactOptionalPropertyTypes` is on, so `device: undefined` is not the same
        // as an absent `device`, and the use-case's parameter is optional. `{}` from
        // `toDeviceContext` therefore has to stay absent.
        ...toDeviceContext(request),
      });
    } finally {
      // Through the PORT's own `expired()`, never a hand-built clear. The attributes
      // must match the ones `seal` wrote in name, path, `httpOnly`, `secure` and
      // `sameSite`, and a clear differing in any of them removes nothing — which
      // leaves a bundle in the browser that still looks valid. The port says so on the
      // method itself, and this is the call site that makes it true.
      carrier.setCookie(this.stateStore.expired());
    }

    return this.deliver(outcome, carrier);
  }

  /**
   * Turn an outcome into the response, and set a session cookie only where one is due.
   *
   * Split out of the handler so the `switch` is one expression with no fall-through,
   * which is where a missing branch shows up as a missing status code rather than as a
   * type error.
   */
  private deliver(outcome: OidcCallbackOutcome, carrier: ExpressCookieCarrier): CallbackBody {
    switch (outcome.outcome) {
      case 'signed-in': {
        // Through the adapter that already owns the attribute policy, with the
        // session's OWN remaining lifetime rather than the configured window. A cookie
        // that outlives its server-side session is a credential that looks valid and is
        // not, and `ISessionCookieDelivery.issue` says so in its own contract.
        this.sessionCookie.issue({
          carrier,
          rawToken: outcome.session.sessionTokenPlaintext,
          ttlMs: outcome.session.sessionExpiresAt.getTime() - this.clock.now().getTime(),
        });

        // The body says only that it worked. The credential is in the cookie, where
        // `HttpOnly` keeps it away from script.
        return { signedIn: true };
      }

      case 'linked':
      case 'already-linked':
        // **No session is issued on a link.** The caller authenticated before the flow
        // began and still holds that session; a second one would be an orphan nothing
        // ever revokes.
        //
        // `already-linked` answers the same as `linked` because the caller's intent —
        // "this Google account should be usable to sign in as me" — is satisfied either
        // way. The distinction is in the typed outcome and in the audit record.
        return { linked: true };

      case 'refused':
        // Logged with the REASON, never the value. `AGENTS.md` 2.13: the reason names
        // the rule that refused; the address, the subject and the token stay out.
        console.warn(
          `OidcCallback refused a callback: ${outcome.reason}. ` +
            'No session was issued and no identity was linked.',
        );
        throw new UnauthorizedException(REFUSED_BODY);
    }
  }
}

/**
 * The slice of a response this route needs.
 *
 * `cookie` for both the state clear and the session cookie, and `setHeader` because a
 * `429` without a `Retry-After` is a throttle the client cannot wait out. Satisfied
 * structurally by the real Express response, so `express` — a transitive dependency
 * this package does not declare — is never imported.
 */
interface CallbackResponse extends CookieWritingResponse {
  setHeader(name: string, value: string): unknown;
}

/** What a completed callback answers on success. One key per outcome, never both. */
export type CallbackBody = { readonly signedIn: true } | { readonly linked: true };

/**
 * Narrow the callback's query to what `IOidcProvider.verifyCallback` reads.
 *
 * A Google callback carries `code`, `state`, `scope` and `authuser` on success, or
 * `error` and `error_description` on refusal. Only the four the port names are taken,
 * and each is a **string or null** — an array or an object in the query string becomes
 * `null` rather than being passed through as something the provider would have to
 * defend against.
 */
export function toOidcCallbackQuery(query: unknown): OidcCallbackQuery {
  const source = (typeof query === 'object' && query !== null ? query : {}) as Record<
    string,
    unknown
  >;

  const single = (key: string): string | null => {
    const value = source[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  return {
    code: single('code'),
    state: single('state'),
    error: single('error'),
    errorDescription: single('error_description'),
  };
}
