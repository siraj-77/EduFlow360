import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IPERMISSION_GRANT_READER,
  type IPermissionGrantReader,
} from '../../modules/rbac/domain/ports/permission-grant-reader.js';
import {
  decidePermissionAccess,
  type PermissionDenialReason,
  type PermissionRequirement,
} from '../../modules/rbac/domain/services/decide-permission.js';
import { PERMISSION_KEY } from './route-guards.decorator.js';
import { isPublicRoute, type MetadataTarget, type PrincipalCarrier } from './session.guard.js';

/**
 * `PermissionGuard` — the control that turns a principal into an answer.
 *
 * ## What was missing before this file existed
 *
 * `@RequirePermission`, `@RequireEntitlement` and `@Audited` wrote metadata and
 * **nothing read it**. The only controls in this repository that stopped anything were
 * `CsrfGuard` and `SessionGuard`. `check-route-guards` proves a decorator is
 * *present*; it cannot prove anything is *obeyed* — which is the same shape as the
 * defect where the shipped application could not boot: nine green gates, no
 * enforcement.
 *
 * So `GET /auth/oidc/link` was authenticated and otherwise ungated, while carrying a
 * `@RequirePermission` that read exactly like a working control.
 *
 * ## It enforces ONE of the three `AGENTS.md` 2.3 guards
 *
 * | guard | enforced here? |
 * |---|---|
 * | `@RequirePermission` | **yes** — this file |
 * | `@RequireEntitlement` | **no** — Epic 03. The metadata is read by nothing. |
 * | `@Audited` | **no** — `PLT-402`. `@Audited` **still writes nothing.** |
 *
 * Stated at the top of the file because a `@Audited` decorator on a route reads like
 * a record of that action being kept, and today not one row is written by any of
 * them. Nothing in this file may be read as implying otherwise.
 *
 * ## How the three global guards COMPOSE, and why the order is load-bearing
 *
 * `app.module.ts` registers, in this order:
 *
 *   1. `CsrfGuard`    — answerable from the request alone, so it is asked first and is
 *                       the cheapest question.
 *   2. `SessionGuard` — resolves the cookie into a principal and **attaches it to the
 *                       request**.
 *   3. `PermissionGuard` — *this file*. Reads the principal `SessionGuard` attached.
 *
 * **This guard must not read the cookie.** It reuses the principal rather than
 * re-deriving it, for two reasons that are really one: a second read is a second
 * database round trip on every request, and — worse — two places that independently
 * decide who the caller is will eventually disagree, and the disagreement is an
 * authentication bypass rather than an outage. Nest runs `APP_GUARD` providers in
 * registration order, so registering this one third is the whole composition.
 *
 * **Registered the other way round it would still refuse, and that is the trap.** With
 * `PermissionGuard` first, every unauthenticated request would be refused here with
 * `NO_PRINCIPAL` — a refusal that looks like policy but is a wiring fault, logged on
 * every 401 in the system. `SessionGuard` must get to run first so that its 401 is the
 * answer to a missing session and this guard's 403 is the answer to a missing
 * permission. That the ordering is right is asserted over a real socket in
 * `permission-guards-over-http.spec.ts`, not by reading this comment.
 *
 * ## `@Public` is the exemption, and it is the SAME marker
 *
 * `@Public('<reason>')` exempts this guard through `PUBLIC_ROUTE_KEY` — the marker
 * `SessionGuard` already honours and the one reconciled against
 * `route-guards.allowlist.json`. A second marker would be a second convention for one
 * idea, and the one nobody checks the allowlist for is the one that ships.
 *
 * ## Why it FAILS CLOSED
 *
 * No principal, no reader wired, an unmarked route, a blank key, a role that does not
 * grant the key, a key no `Permission` row carries: every one is a refusal. There is
 * no branch that reaches `true` without a positively-confirmed grant from the reader.
 *
 * The one thing that is NOT caught here is a reader that **throws**. That propagates,
 * so the request surfaces as a 500 rather than a 403 — a database outage is not a
 * permission decision, and turning one into the other would hide an outage behind a
 * refusal that reads like policy.
 */

/**
 * The refusal body, as ONE frozen constant.
 *
 * Every denial — role, wiring fault, unknown key — uses it, and the spec asserts the
 * four wire-visible failures produce byte-identical bodies. A guard that distinguished
 * them would be an enumeration oracle about which permissions exist and which roles
 * hold them (`AGENTS.md` 2.13).
 */
const REFUSED = Object.freeze({
  statusCode: 403,
  error: 'Forbidden',
  message: 'You do not have permission to perform this action.',
});

/**
 * What the route's metadata asks for.
 *
 * Split out of `canActivate` so the metadata rules are testable without an application
 * context — the same arrangement `isPublicRoute` and `isCsrfRequestAcceptable` use.
 *
 * **Handler first, then class**, and that order matters: it is what stops one method's
 * `@RequirePermission` from being read as another method's. The spec asserts that case
 * directly, because a class-level lookup here would silently open an unmarked route on
 * a controller that has any gated route at all.
 */
export function resolvePermissionRequirement(
  reflector: Reflector,
  targets: readonly unknown[],
): PermissionRequirement {
  // Narrowed with a predicate rather than declared in the signature, for the reason
  // `isPublicRoute` gives: Nest's own `getHandler()` returns the bare `Function` type
  // and this repository bans writing it.
  const readable = targets.filter(
    (target): target is MetadataTarget => typeof target === 'function',
  );

  // `@Public` wins over `@RequirePermission`, and it is asked FIRST. A route carrying
  // both is a route whose exemption was declared last and is therefore the one an
  // author meant — while a `@Public` handler on a `@RequirePermission` controller must
  // not inherit the class's key.
  if (isPublicRoute(reflector, readable)) return { kind: 'public' };

  // The key is returned UNTRIMMED. Whether a blank key is refused is one decision with
  // one owner — `decidePermissionAccess` — and trimming here as well would put a second
  // opinion on the same route.
  const key: unknown = reflector.getAllAndOverride(PERMISSION_KEY, readable);
  if (typeof key !== 'string') return { kind: 'unmarked' };

  return { kind: 'permission', key };
}

/**
 * The refusal, and the operator-facing explanation that says why without saying what.
 *
 * Two shapes of message, because two kinds of thing went wrong and they send an
 * administrator to opposite places. Both refusals are the same 403 on the wire; the
 * distinction is for the log, where an operator can act on it.
 *
 * - **A wiring fault** — the route is mis-decorated, or a dependency is missing. The
 *   author or the deployer has to fix something.
 * - **An ordinary denial** — the caller is who they say they are, and their roles do
 *   not grant this. Nothing is broken.
 *
 * Declared `never`-returning **on purpose**, for the reason `SessionGuard.refuse` gives:
 * TypeScript treats a call to a `never`-returning function declaration as unreachable
 * for control-flow purposes, which is what lets `canActivate` carry on without a cast.
 */
function refuse(reason: PermissionDenialReason, context: { userId?: string; key?: string }): never {
  // `console.warn` is on the base config's `no-console` allow-list. This moves to the
  // `AGENTS.md` 2.15 structured logger once one exists.
  //
  // What appears here and what does not: the userId and the permission KEY are both in,
  // because "who was denied what" is the entire value of the log and neither is a
  // credential. The sessionId is not, because it is the handle on a live session; nor is
  // any cookie or token value, which this function is never given.
  const subject =
    context.userId === undefined
      ? 'an unidentified caller'
      : `user ${context.userId}${context.key === undefined ? '' : ` for ${context.key}`}`;

  const wiringFault = reason !== 'NOT_GRANTED';

  console.warn(
    wiringFault
      ? `PermissionGuard WIRING FAULT (${reason}): refused ${subject}. ` +
          'A route or a dependency is wrong, not a permission. ' +
          'AGENTS.md 2.3 requires every route to carry @RequirePermission or @Public, and ' +
          `${String(IPERMISSION_GRANT_READER.description)} must be registered.`
      : `PermissionGuard denied ${subject} (${reason}): no role this user holds grants that ` +
          'permission. Roles UNION their permissions; the schema has no primary role.',
  );

  throw new ForbiddenException(REFUSED);
}

@Injectable()
export class PermissionGuard implements CanActivate {
  /**
   * `@Optional()` is deliberate and it is not "be lenient".
   *
   * `RbacModule` registers no reader when `DATABASE_URL` is absent, and that is a
   * supported configuration — a Google-only deployment has sign-in routes and no
   * permission-gated ones. Requiring the token would make such a deployment fail to
   * BOOT.
   *
   * So the dependency is genuinely optional, and this guard's answer when it is missing
   * is to **refuse every non-public route**. See `canActivate`.
   */
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional()
    @Inject(IPERMISSION_GRANT_READER)
    private readonly grants?: IPermissionGrantReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = resolvePermissionRequirement(this.reflector, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<PrincipalCarrier>();

    // Read, not `requirePrincipal`: that helper throws a wiring Error, and this guard
    // needs a *refusal* with a 403 and a diagnosis in the log rather than a 500. The
    // two disagree about nothing — both treat a missing principal as a fault — they
    // differ only in what the caller is told.
    //
    // Taken as a local `const` rather than through `this`, because TypeScript narrows a
    // local inside a closure and cannot narrow `this.grants`. That is the whole reason
    // there is no `as` assertion below: the narrowing is real rather than asserted.
    const grants = this.grants;
    const userId = request?.principal?.userId;

    const decision = await decidePermissionAccess({
      requirement,
      hasPrincipal: userId !== undefined,
      // Built here rather than passed as a value, so the RULE decides when to consult
      // it. A `@Public` route, an unmarked route and a missing principal all reach the
      // reader never at all.
      lookup:
        grants === undefined || userId === undefined
          ? undefined
          : (permissionKey) => grants.isGranted({ userId, permissionKey }),
    });

    if (decision.allowed) return true;

    refuse(decision.reason, {
      ...(userId === undefined ? {} : { userId }),
      ...(requirement.kind === 'permission' ? { key: requirement.key } : {}),
    });
  }
}
