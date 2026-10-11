import { Controller, Headers, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Audited } from '../../../common/guards/route-guards.decorator.js';
import { Public } from '../../../common/guards/public.decorator.js';
import {
  attachAuditActor,
  attachAuditSubject,
  auditSubjectFor,
} from '../../../common/http/audit-actor.js';
import type { AuditCarrier } from '../../../common/http/audit-actor.js';
import type { RequestWithAddress } from '../../../common/http/request-context.js';
import { ExpressCookieCarrier } from '../infrastructure/adapters/express-cookie-carrier.js';
import type { CookieWritingResponse } from '../infrastructure/adapters/express-cookie-carrier.js';
import { SessionCookieAdapter } from '../infrastructure/adapters/session-cookie.js';
import { CLOCK } from '../domain/ports/clock.js';
import type { IClock } from '../domain/ports/clock.js';
import { I_SESSION_REPOSITORY } from '../domain/ports/session-repository.js';
import type { ISessionRepository } from '../domain/ports/session-repository.js';
// The cookie name comes from the DOMAIN PORT, not from the adapter that
// re-exports it. This is the trap `auth.module.ts` records for
// `I_SESSION_REPOSITORY`: a binding imported through a module that
// participates in a cycle evaluates while still uninitialised, so
// `@Inject(undefined)` — or here, a comparison against `undefined` that
// silently matches no cookie — is emitted. Observed as a sign-out that always
// answered 200 while revoking nothing; the spec caught it.
import { SESSION_COOKIE_NAME } from '../domain/ports/session-cookie.js';

/**
 * The single-line `@Public` justification.
 *
 * `check-route-guards.mjs` walks outward from the route decorator absorbing
 * contiguous decorator lines, so the reason must be one line here; the full
 * argument lives in `route-guards.allowlist.json`, which is the artefact a
 * reviewer reads.
 */
const SIGN_OUT_PUBLIC_REASON =
  'Signing out must work for a session that is already dead, expired or corrupt - that is the ordinary case, and a 401 here teaches a user the button is broken. The route revokes only the session its OWN cookie names, idempotently: no cookie, or a token no session matches, revokes nothing and still answers 200. Guarded instead by CsrfGuard on the POST and by the HttpOnly SameSite cookie being the only credential it will act on. AGENTS.md 2.3, 2.13.';

/**
 * The response shape this handler needs: the cookie carrier's own contract.
 *
 * `CookieWritingResponse` rather than a narrower local interface, because the
 * adapter that writes the cookie declares what it uses and a narrower type
 * here would be a cast away from failing at compile time.
 */
type CookieClearingResponse = CookieWritingResponse;
/**
 * `POST /auth/sign-out` — the way out (`ADR-008`'s revoke, connected to the
 * cookie).
 *
 * ## Why this route exists
 *
 * A sign-in with no sign-out is a trap. The interim authenticated landing the
 * auth-screens work needs must be able to END a session; without a server
 * route the only way out is closing the browser, and an `HttpOnly` cookie
 * cannot be cleared from script by design.
 *
 * ## The shape, and the two decisions in it
 *
 * **`@Public`** — a caller holding a dead session is exactly who needs this
 * route. **Idempotent 200** — a caller with no cookie has already achieved
 * what they asked for.
 *
 * The order of the two writes is deliberate and is asserted: the SERVER-SIDE
 * revoke happens first, because a cleared cookie with a live session row is a
 * credential that still works from a copied cookie jar. The cookie is cleared
 * through the same adapter that issues it, so the attribute policy has one
 * owner.
 */
@Controller('auth')
export class SignOutController {
  constructor(
    @Inject(I_SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(SessionCookieAdapter) private readonly sessionCookie: SessionCookieAdapter,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @Public(SIGN_OUT_PUBLIC_REASON)
  @Audited('SIGN_OUT')
  async signOut(
    @Headers('cookie') cookieHeader: string | undefined,
    // The request is typed as an `AuditCarrier` too, because this handler
    // DECLARES the actor for the audit record on a `@Public` route — the
    // interceptor reads the principal, and there is none here. Same
    // arrangement as the sign-in handlers.
    @Req() request: RequestWithAddress & AuditCarrier,
    @Res({ passthrough: true }) response: CookieClearingResponse,
  ): Promise<{ readonly signedOut: true }> {
    const rawToken = readSessionCookie(cookieHeader);

    // ── 1. The server-side revoke, when the cookie names a live session ─────
    // Resolved by TOKEN rather than by a principal: `@Public` means
    // `SessionGuard` attached none, and guessing an identity from a request
    // that never authenticated is how a sign-out revokes the wrong account.
    if (rawToken !== null) {
      const session = await this.sessions.findByToken(rawToken);
      if (session !== null) {
        await this.sessions.revokeSession({
          sessionId: session.sessionId,
          reason: 'signed-out',
          now: this.clock.now(),
        });

        // Declared AFTER the revoke, so the row names the account that was
        // actually signed out. A handler that threw revokes nothing and
        // records a failure with no actor instead (`AuditInterceptor`'s rule).
        attachAuditActor(request, { userId: session.userId });
        attachAuditSubject(request, auditSubjectFor(session.userId));
      }
    }

    // ── 2. The cookie, cleared through the adapter that owns its policy ────
    this.sessionCookie.clear(new ExpressCookieCarrier(response));

    return { signedOut: true };
  }
}

/**
 * Read the session token out of a `Cookie` header.
 *
 * A local parse rather than a cookie library, because this handler needs ONE
 * name. Unknown cookies, an empty header and a malformed one all answer
 * `null`, which the caller treats as "nothing to revoke" — the same
 * idempotent answer a missing session gives.
 */
function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) return null;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const value = pair.slice(separator + 1).trim();
    if (value.length > 0) return value;
  }

  return null;
}
