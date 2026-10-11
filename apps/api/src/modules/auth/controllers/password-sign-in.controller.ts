import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
// `ZodError` is only ever named as a type here — the value comes from
// `safeParse(...).error` — so `import type` is correct and the lint rule is right.
import type { ZodError } from 'zod';
import { Public } from '../../../common/guards/public.decorator.js';
import { Audited } from '../../../common/guards/route-guards.decorator.js';
import {
  sourceAddressOf,
  toDeviceContext,
  type RequestWithAddress,
} from '../../../common/http/request-context.js';
import {
  attachAuditActor,
  attachAuditSubject,
  auditSubjectFor,
  type AuditCarrier,
} from '../../../common/http/audit-actor.js';
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
import type { ThrottlePolicy } from '../../../common/throttle/fixed-window-throttle.js';
import { PasswordSignInBody } from '../dto/password-sign-in.dto.js';
// `CLOCK` is a VALUE (a DI token) and `IClock` is a type. One statement, inline
// `type` modifier — which is what `@typescript-eslint/consistent-type-imports` asks
// for, and which keeps the runtime import that `@Inject(CLOCK)` needs. Splitting
// them into `import type { IClock }` plus a bare `import` of the same module would
// also work; what does NOT work is marking the whole statement type-only, which is
// the defect this file's sibling controller documents.
import { CLOCK, type IClock } from '../domain/ports/clock.js';
import { ExpressCookieCarrier } from '../infrastructure/adapters/express-cookie-carrier.js';
import { SessionCookieAdapter } from '../infrastructure/adapters/session-cookie.js';
import { SignInWithPassword } from '../use-cases/sign-in-with-password.js';

/** The throttle configuration for this route, as a DI token. */
export const LOGIN_THROTTLE_POLICY = Symbol('LOGIN_THROTTLE_POLICY');

/**
 * `@Public` justification, as a single-line named constant.
 *
 * Login is public for the same reason the OIDC redirect is: a permission check would
 * require the permission the route exists to obtain. It differs from that route in
 * that this one CHANGES something — it issues a session — so the exemption is narrower
 * and the reason says so. What makes it safe is not that nothing happens (something
 * does) but that what happens happens only to the caller, on the strength of a
 * credential they presented, and only when that credential is correct.
 */
const LOGIN_PUBLIC_REASON =
  'Sign-in is how a session is obtained, so a permission check would require the permission the ' +
  'route exists to grant. Unlike the OIDC redirect this route does change state - it issues a ' +
  'session - but only ever for the caller, only on a credential they presented, and only when that ' +
  'credential verifies. No other account is read or written, no role is consulted, and no school data ' +
  'is reachable from here. Hence no @RequireEntitlement: a Basic-edition school must still be able to ' +
  'sign in. AGENTS.md 2.3.';

/**
 * The ONE body a refused sign-in produces.
 *
 * A single frozen constant used for every refusal, and that is the whole point. A
 * missing account, a wrong password, a suspended account and an account not yet
 * activated all serialise to these exact bytes. Give each its own message and the
 * route becomes an oracle while still looking like ordinary good error handling.
 *
 * `PLT-101`'s acceptance criterion: "Given invalid credentials, login returns 401
 * without leaking whether email or password was wrong."
 */
const REFUSED_BODY = Object.freeze({
  statusCode: HttpStatus.UNAUTHORIZED,
  error: 'Unauthorized',
  message: 'Those credentials were not accepted.',
});

/** The keys this schema knows about, used to bound what a validation failure may report. */
const KNOWN_BODY_KEYS: ReadonlySet<string> = new Set(['identifier', 'password']);

/**
 * The slice of a response this route needs.
 *
 * `cookie`/`clearCookie` for the session credential, and `setHeader` because a 429
 * without a `Retry-After` is a lockout the client cannot wait out properly. Both are
 * satisfied structurally by the real Express response, so `express` — a transitive
 * dependency this package does not declare — is never imported.
 */
interface CredentialWritingResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options: Record<string, unknown>): unknown;
  setHeader(name: string, value: string): unknown;
}

/**
 * `POST /auth/login` — the route the whole sign-in path depends on.
 *
 * ## Why this is mandatory infrastructure, not a fallback
 *
 * `D57` ratified **must-link** Google sign-in: a Google identity must already be
 * linked to a `User`, linking needs an authenticated session, and the only way to get
 * one is a password. So this is not a fallback beside OIDC — it is the thing OIDC
 * depends on. Remove it and no user can ever link a Google account, so every later
 * Google sign-in fails, so the sign-in path is dead.
 *
 * ## What `@Audited` does and does not do HERE, stated plainly
 *
 * **It appends one row.** The decorator records a key in route metadata, and
 * `AuditInterceptor` (`PLT-402`, since 2026-10-11) reads it and writes one
 * `audit_records` row per outcome — after the handler, before the response is
 * released. The over-HTTP proof that both a success and a failure produce a
 * real row is `audited-routes-over-http.integration.spec.ts`.
 *
 * ## `@Audited` covers success AND failure, and that has a cost worth naming
 *
 * The decorator sits on the handler, so it marks both outcomes. That is right: a
 * sign-in is exactly the event an auditor wants, and `ARCHITECTURE.md` line 211 lists
 * "login success · login failure · lockout" as events that must be recorded. A silent
 * failure is un-investigable.
 *
 * **The cost:** an audit implementation that recorded the IDENTIFIER of every failed
 * sign-in would itself become an enumeration oracle — in the log rather than on the
 * wire. So the requirement the implementation carries is that a failure record
 * carries no identifier and no credential: only the fact that an attempt failed, the
 * source, and the timestamp. Enforced by `AuditInterceptor` (it reads the principal on
 * the failure path and never the handler's declared actor), asserted by
 * `audit-interceptor.spec.ts` and over HTTP by
 * `audited-routes-over-http.integration.spec.ts`.
 *
 * ## The one place two outcomes are allowed to differ
 *
 * `locked` answers 429 with a `Retry-After`; everything else answers 401 with the one
 * frozen body. That difference IS a leak — it says an account exists — and it is the
 * corpus's decision rather than an oversight. `sign-in-with-password.ts` records why
 * the alternative was rejected.
 */
@Controller('auth')
export class PasswordSignInController {
  constructor(
    // `@Inject(...)` with VALUE imports, never `import type`. `emitDecoratorMetadata`
    // cannot turn a type-only import into a runtime token; this repository shipped
    // that bug once and the application could not boot while `tsc`, lint and the build
    // all reported success. See `oidc-sign-in.controller.ts`, and the failure recorded
    // in `setup-completion.controller.spec.ts` where the same mistake appeared again on
    // a different line and was caught by a test rather than by a compiler.
    @Inject(SignInWithPassword) private readonly signIn: SignInWithPassword,
    @Inject(SessionCookieAdapter) private readonly sessionCookie: SessionCookieAdapter,
    // The CLOCK token, not the `SystemClock` class. Injecting the concrete class
    // binds this handler to the wall clock, which defeats the seam `AGENTS.md` 2.4
    // exists to create — and the cookie TTL below is computed from this clock, so a
    // consumer that cannot be faked here cannot be tested at all. See `clock.ts`.
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(FixedWindowThrottle) private readonly throttle: FixedWindowThrottle,
    @Inject(LOGIN_THROTTLE_POLICY) private readonly throttlePolicy: ThrottlePolicy,
  ) {}

  @Public(LOGIN_PUBLIC_REASON)
  @Audited('LOGIN')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    // The request is typed as an `AuditCarrier` too because this handler
    // DECLARES the actor for the audit record (`PLT-402`): the route is
    // `@Public`, so `SessionGuard` attached no principal, and the one moment
    // this codebase knows who just signed in is right here. Without the
    // declaration every successful sign-in would be an audit row nobody
    // performed.
    @Req() request: RequestWithAddress & AuditCarrier,
    @Res({ passthrough: true }) response: CredentialWritingResponse,
  ): Promise<{ readonly signedIn: true }> {
    // ── Throttle first, keyed on the SOURCE address. ─────────────────────────
    // On the source rather than the identifier on purpose: keying on the identifier
    // would let an attacker lock a colleague's account by failing five times as them.
    // Locking an account is a real control and it belongs to the use-case, where it
    // is durable, keyed on the account, and survives a restart.
    const decision = this.throttle.check(sourceAddressOf(request), this.throttlePolicy);
    if (!decision.allowed) {
      refuseAsThrottled(response, decision.retryAfterMs);
    }

    const parsed = PasswordSignInBody.safeParse(body);
    if (!parsed.success) throw toBadRequest(parsed.error);

    const outcome = await this.signIn.signIn({
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      // Conditional spreads, because `exactOptionalPropertyTypes` is on and
      // `PrismaSessionRepository` rejects an explicit `undefined` where an absent
      // optional column is meant. The device is assembled first so the two branches
      // cannot each build a different half of it.
      ...toDeviceContext(request),
    });

    if (outcome.outcome === 'locked') {
      const remaining = outcome.lockedUntil.getTime() - this.clock.now().getTime();
      refuseAsThrottled(
        response,
        Math.max(1, remaining),
        'This account is temporarily locked after too many failed sign-in attempts.',
      );
    }

    if (outcome.outcome !== 'signed-in') {
      // The one refusal, byte for byte, whatever the cause.
      throw new UnauthorizedException(REFUSED_BODY);
    }

    // ── The cookie, through the adapters that already own it. ───────────────
    // `SessionCookieAdapter` owns the attribute policy; `ExpressCookieCarrier` owns
    // the `Set-Cookie` serialisation. This handler decides nothing and adds nothing.
    //
    // The TTL is the session's OWN REMAINING LIFETIME, not the configured window. A
    // cookie that outlives its server-side session is a credential that looks valid
    // and is not, and `ISessionCookieDelivery.issue` says so in its own contract.
    this.sessionCookie.issue({
      carrier: new ExpressCookieCarrier(response),
      rawToken: outcome.session.sessionTokenPlaintext,
      ttlMs: outcome.session.sessionExpiresAt.getTime() - this.clock.now().getTime(),
    });

    // The body says only that it worked. The credential is in the cookie, where
    // `HttpOnly` keeps it away from script — a body value would be readable by any
    // XSS on the web app, and the stolen token works from anywhere, indefinitely.
    //
    // Declared for `@Audited('LOGIN')` AFTER the session exists, so a failed
    // sign-in throws before this line and never attaches a claimed identity.
    // `AuditInterceptor` reads it on the success path only — see
    // `password-sign-in.controller.ts`'s header for the failure-record rule.
    attachAuditActor(request, { userId: outcome.session.userId });
    attachAuditSubject(request, auditSubjectFor(outcome.session.userId));

    return { signedIn: true };
  }
}

/**
 * Answer 429, with a `Retry-After` in whole seconds.
 *
 * Rounded UP, never down: a `Retry-After: 0` tells a client to retry immediately,
 * guarantees another refusal, and burns one of its own remaining attempts.
 *
 * `HttpException` rather than a bespoke subclass, because Nest has no
 * `TooManyRequestsException` — the 429 is constructed from the status. A
 * hand-rolled error class that is not an `HttpException` produces a 500, which is
 * the opposite of what a throttle is for.
 *
 * Declared `never`-returning so the caller reads it as terminal; the `throw` is
 * inside, and a reader should not have to check.
 */
function refuseAsThrottled(
  response: CredentialWritingResponse,
  retryAfterMs: number,
  message = 'Too many sign-in attempts from this source. Try again shortly.',
): never {
  response.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  throw new HttpException(
    { statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'Too Many Requests', message },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * A validation failure, as a 400 that can only name this route's own fields.
 *
 * See `setup-completion.controller.ts` for the same helper on the setup route. Zod's
 * own message is discarded rather than reformatted, because on a credential route some
 * issue types quote the offending value — and here that value is a password
 * (`AGENTS.md` 2.13).
 */
export function toBadRequest(error: ZodError): BadRequestException {
  const fields = [
    ...new Set(
      error.issues
        .map((issue) => issue.path[0])
        .filter((segment): segment is string => typeof segment === 'string')
        .filter((segment) => KNOWN_BODY_KEYS.has(segment)),
    ),
  ].sort();

  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    message:
      'The request body is not valid for this route.' +
      (fields.length > 0 ? ` Check: ${fields.join(', ')}.` : ''),
    fields,
  });
}

/** Re-exported so this route's outcome type is nameable from a spec without a deep import. */
export type { PasswordSignInOutcome } from '../use-cases/sign-in-with-password.js';
