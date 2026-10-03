import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import {
  I_SESSION_REPOSITORY,
  type ISessionRepository,
} from '../../modules/auth/domain/ports/session-repository.js';
import { SESSION_COOKIE_NAME } from '../../modules/auth/domain/ports/session-cookie.js';
import { PUBLIC_ROUTE_KEY, type PublicRouteMetadata } from './public.decorator.js';

/**
 * The two things Nest can hang route metadata on: a class constructor and a method.
 *
 * Declared rather than written as `Function`, which `@typescript-eslint` bans — and the
 * ban is right, because `Function` accepts anything callable, including a value that
 * can never carry metadata. This union is exactly the set `Reflector` can read.
 */
export type MetadataTarget = Type<unknown> | ((...args: never[]) => unknown);

/**
 * `SessionGuard` — the control that turns a cookie into a caller.
 *
 * ## What was missing before this file existed
 *
 * `ISessionRepository.findByToken` existed and **nothing called it**. `CsrfGuard` was
 * the only class in the application implementing `CanActivate`, so "an authenticated
 * route" was a phrase with no mechanism behind it: a route carrying no `@Public` was
 * not protected, it was simply unprotected, and nothing said so.
 *
 * ## Why `@Public` is the exemption marker, and there is no second one
 *
 * `AGENTS.md` 2.3 already names `@Public('<reason>')` as *the only* exemption from
 * `@RequirePermission`, and already requires every use to be listed in
 * `route-guards.allowlist.json` with a justification. Introducing a second marker —
 * `@Anonymous`, `@SkipSession`, a `skipAuth` boolean — would give the repository two
 * conventions for one idea, and the one nobody checked the allowlist for is the one
 * that ships.
 *
 * So there is one marker, one allowlist, and one reviewable list of every exemption
 * from authentication. `check-route-guards` reconciles it in both directions, so a
 * marker cannot be added without a justification or a justification can outlive its
 * route.
 *
 * ## Why it is registered globally, and what that costs
 *
 * `APP_GUARD`, no per-controller opt-in, exactly as `D53` settled for `CsrfGuard`.
 * Opt-in registration is the failure mode this repository has already paid for twice:
 * a control that exists, is not wired, and reads exactly like a working one.
 *
 * The cost is the interaction this file's tests exist for. `CsrfGuard` is already
 * global, so this guard runs *after* it on every route, and `@Public` has to be
 * honoured here or `GET /auth/oidc/redirect` — the only route a browser can reach
 * before a session exists — would answer 401 and sign-in would be impossible. There
 * is no way to test that by reading either guard; it is asserted over a real socket
 * in `oidc-redirect-over-http.spec.ts` and here.
 *
 * ## Why it FAILS CLOSED
 *
 * Absent cookie, malformed cookie, unknown token, expired token, and no repository
 * wired at all: every one is a refusal, never a fall-through to "anonymous".
 *
 * A guard that let a request through without a principal would make the *absence* of
 * a working authentication path look like a working application, and every protected
 * handler would then be written to cope with a caller that may not exist. Failing
 * closed puts that defect at the first request instead.
 */

/**
 * Who is making this request.
 *
 * Deliberately two identifiers and nothing else: no role, no permission set, no
 * licence. `AGENTS.md` 2.3 makes permission the only thing that gates a route, and a
 * principal that carried roles would invite a handler to read one — which is the
 * `PLT-201` engine's job, not this guard's. The two fields here are what
 * authentication can honestly answer, and nothing more.
 */
export interface SessionPrincipal {
  /** The server-side session. Revocable; the cookie is only a handle on it. */
  readonly sessionId: string;
  /** The local account. The one thing every downstream decision keys on. */
  readonly userId: string;
}

/**
 * The slice of a request this guard writes to.
 *
 * `express` is a transitive dependency and is deliberately not imported; structural
 * typing lets the real `Request` satisfy this without a cast or an `any`.
 */
export interface PrincipalCarrier {
  principal?: SessionPrincipal;
}

/**
 * Is this route exempt from authentication?
 *
 * A pure function of the metadata rather than a method, so the rule is testable
 * without an application context — the same arrangement `CsrfGuard` uses for
 * `isCsrfRequestAcceptable`.
 *
 * **Handler first, then class.** `getAllAndOverride` is given `[handler, class]` and
 * that order matters: it is what stops one public method from exempting its whole
 * controller, and the spec asserts that case directly.
 */
export function isPublicRoute(reflector: Reflector, targets: readonly unknown[]): boolean {
  // Narrowed with a predicate rather than declared in the signature, because Nest's
  // own `ExecutionContext.getHandler()` returns the bare `Function` type and this
  // repository bans writing it. `typeof === 'function'` is the same test Nest's own
  // injector performs, and a target that is not callable can carry no metadata, so
  // dropping it changes no answer.
  const metadata = reflector.getAllAndOverride<PublicRouteMetadata | undefined>(
    PUBLIC_ROUTE_KEY,
    targets.filter((target): target is MetadataTarget => typeof target === 'function'),
  );

  return metadata !== undefined;
}

/**
 * Read one cookie out of a `Cookie` request header.
 *
 * ## Why this exists rather than `req.cookies`
 *
 * `cookie-parser` is not a dependency of this package, and adding one to read a
 * header Node has already parsed into a string would be a dependency for four lines.
 * More importantly `ISessionCookieDelivery` is **write-only** by design — it puts a
 * cookie on a response and never reads one — so this is the request-side counterpart
 * and it belongs with the guard that needs it. See `session-cookie.ts` for why the
 * two were not merged into one class.
 *
 * ## The cases that are easy to get wrong, and are tested
 *
 * - **Name matching is exact.** A `startsWith` scan would accept
 *   `eduflow_session_forge=…`, which is a forgeable name.
 * - **First match wins**, as browsers do. Two `Set-Cookie` headers for one name is a
 *   real state (a second deployment on the same origin, or a proxy), and picking the
 *   second would be picking by attacker preference.
 * - **Split on the FIRST `=` only.** A malformed token containing `=` must reach
 *   `findByToken` intact rather than truncated.
 * - **Unquote.** RFC 6265 permits a DQUOTE-wrapped value and some clients send one.
 *
 * A duplicated header arrives from Node as an array; the values are joined with the
 * `; ` the RFC specifies rather than one being picked.
 */
export function readCookieHeader(
  header: string | string[] | undefined,
  name: string,
): string | null {
  if (header === undefined) return null;

  const combined = Array.isArray(header) ? header.join('; ') : header;
  if (combined.length === 0) return null;

  for (const part of combined.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;

    if (part.slice(0, separator).trim() !== name) continue;

    const raw = part.slice(separator + 1).trim();
    const unquoted =
      raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;

    return unquoted.length > 0 ? unquoted : null;
  }

  return null;
}

/**
 * Put a principal on the request.
 *
 * Separate from the guard so a controller and its test can both reach it without
 * either importing the guard CLASS. A controller that had to import `SessionGuard`
 * would be depending on a control rather than on the data the control produced.
 */
export function attachPrincipal(carrier: PrincipalCarrier, principal: SessionPrincipal): void {
  carrier.principal = principal;
}

/**
 * Read the principal the guard attached, or fail loudly.
 *
 * Throws rather than returning `null`. A protected route whose handler found no
 * principal is a **wiring** fault — the guard was skipped, or the handler was mounted
 * on the wrong controller — and reporting that to a user as though it were their
 * request would send an operator looking in the wrong file.
 */
export function requirePrincipal(carrier: unknown): SessionPrincipal {
  const principal = (carrier as PrincipalCarrier | null)?.principal;

  if (principal === undefined || principal === null) {
    throw new Error(
      'No principal on this request. A route reached requirePrincipal without SessionGuard ' +
        'attaching one, so the route is either not guarded or is not registered behind ' +
        'APP_GUARD. This is a wiring fault, not a user error.',
    );
  }

  return principal;
}

/**
 * The refusal body, as ONE frozen constant.
 *
 * Every failure below — no cookie, malformed, unknown, expired, no repository — uses
 * it, and the spec asserts the three wire-visible failures produce byte-identical
 * bodies. A guard that distinguished them would be an enumeration oracle about which
 * cookies are real (`AGENTS.md` 2.13).
 */
const REFUSED = Object.freeze({
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Authentication is required for this route.',
});

/**
 * The refusal, and the operator-facing warning that says why without saying what.
 *
 * Declared `never`-returning **on purpose**. TypeScript treats a call to a
 * `never`-returning function declaration as unreachable for control-flow purposes,
 * which is what lets `canActivate` go on to use `this.sessions` and `token` after
 * calling it without a cast. An arrow-function const would not get that treatment —
 * the rule needs a declared symbol, not an inferred one — and this file would then
 * need `!` assertions in three places where the guarantee is already proved.
 */
function refuse(reason: string): never {
  // `console.warn` is on the base config's `no-console` allow-list. This moves to the
  // `AGENTS.md` 2.15 structured logger once one exists. The cookie NAME appears and
  // the cookie VALUE does not: a refusal log is the last place a live credential
  // should be written down.
  console.warn(`SessionGuard refused a request: ${reason} (cookie ${SESSION_COOKIE_NAME}).`);

  throw new UnauthorizedException(REFUSED);
}

@Injectable()
export class SessionGuard implements CanActivate {
  /**
   * `@Optional()` is deliberate, and it is not "be lenient".
   *
   * `AuthModule` registers no repository when `DATABASE_URL` is absent, and that is a
   * supported three-state configuration (`auth.module.ts`). Requiring the token would
   * make a Google-only deployment fail to BOOT for a route it does not register.
   *
   * So the dependency is genuinely optional, and the guard's answer when it is missing
   * is to **refuse every authenticated route**. See `canActivate`.
   */
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional()
    @Inject(I_SESSION_REPOSITORY)
    private readonly sessions?: ISessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, [context.getHandler(), context.getClass()])) return true;

    if (this.sessions === undefined) {
      refuse(
        `no session repository is registered, so no caller can be established for ` +
          `${I_SESSION_REPOSITORY.description}. Refusing rather than treating the request as ` +
          `anonymous.`,
      );
    }

    const request = context.switchToHttp().getRequest<
      PrincipalCarrier & {
        readonly headers?: Record<string, string | string[] | undefined> | undefined;
      }
    >();

    const token = readCookieHeader(request?.headers?.cookie, SESSION_COOKIE_NAME);
    if (token === null) refuse(`no usable ${SESSION_COOKIE_NAME} cookie was presented`);

    const found = await this.sessions.findByToken(token);

    // One branch for unknown, revoked and expired. `findByToken` resolves all three to
    // `null` — proved against a real database in
    // `prisma-session-repository.integration.spec.ts` — and the guard must not try to
    // tell them apart, because a caller who could would learn which cookies are real.
    if (found === null) refuse(`the ${SESSION_COOKIE_NAME} cookie resolved to no live session`);

    attachPrincipal(request, { sessionId: found.sessionId, userId: found.userId });

    return true;
  }
}
