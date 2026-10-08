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
  IPERMISSION_CACHE,
  type IPermissionCache,
} from '../../modules/rbac/domain/ports/permission-cache.js';
import {
  IOWNERSHIP_POLICY_REGISTRY,
  type IOwnershipPolicyRegistry,
} from '../../modules/rbac/domain/ports/ownership-policy.js';
import {
  decidePermissionAccess,
  type PermissionDenialReason,
  type PermissionRequirement,
} from '../../modules/rbac/domain/services/decide-permission.js';
import {
  resolvePermissionWithCache,
  type CacheOutcome,
} from '../../modules/rbac/domain/services/cached-permission-lookup.js';
import {
  decideOwnershipAccess,
  type OwnershipDenialReason,
  type OwnershipRequirement,
} from '../../modules/rbac/domain/services/decide-ownership.js';
import { OWNS_RESOURCE_KEY } from './owns-resource.decorator.js';
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
 * ## It ALSO enforces `@OwnsResource` — `PLT-203`, second question, same pipeline
 *
 * A permission says may this ROLE; ownership says may this USER touch THIS RECORD. Both are
 * required by `AGENTS.md` 2.3, and they are not substitutes: a teacher holding
 * `GRADE_ENTER` satisfies the first and is still not allowed to edit another teacher's
 * grades.
 *
 * Order is load-bearing and is the pipeline `PLT-203` specifies — **role, then scope**:
 *
 *   1. `@Public`            → allowed outright; neither question is asked
 *   2. unmarked route       → refused (`NO_PERMISSION_REQUIRED`)
 *   3. no principal         → refused by `SessionGuard` before this guard runs
 *   4. permission granted?  → refused (`NOT_GRANTED`) if not
 *   5. ownership confirmed? → refused if not
 *
 * Role before scope, so a caller who lacks the role is never told whether they would also
 * have failed the scope check — answering that would turn a permission probe into a map of
 * the ownership graph.
 *
 * **The wire answer is the SAME frozen 403 for both questions.** A caller learns that they
 * may not do the thing and nothing else. The distinction `PLT-203` requires — role-denial
 * versus ownership-denial, "distinguishable in logs" — therefore lives in the operator log
 * and nowhere else, for the same reason `REFUSED` is one constant.

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
 * What the route's metadata asks about ownership.
 *
 * Split out of `canActivate` for the reason `resolvePermissionRequirement` is split out:
 * the metadata rules are testable without an application context.
 *
 * **Handler first, then class**, the same order and for the same reason — it is what stops
 * one method's `@OwnsResource` being read as another method's on the same controller.
 */
export function resolveOwnershipRequirement(
  reflector: Reflector,
  targets: readonly unknown[],
): OwnershipRequirement {
  const readable = targets.filter(
    (target): target is MetadataTarget => typeof target === 'function',
  );

  // `@Public` wins, and is asked FIRST, for the same reason it does in
  // `resolvePermissionRequirement`: a public route is reachable before a principal exists,
  // so asking it to name an owned record would make sign-in impossible.
  if (isPublicRoute(reflector, readable)) return { kind: 'unscoped' };

  const entityType: unknown = reflector.getAllAndOverride(OWNS_RESOURCE_KEY, readable);

  // Absent metadata means the route owns no record, which is the ordinary case and is
  // allowed. A non-string is treated as absent rather than guessed at: `@OwnsResource`
  // throws on a blank type at the call site, so anything non-string here is metadata set by
  // other means, and inventing a type for it would scope the request against nothing.
  if (typeof entityType !== 'string') return { kind: 'unscoped' };

  // Untrimmed, exactly as the permission key is. One decision, one owner.
  return { kind: 'resource', entityType };
}

/**
 * Build the resolver `decideOwnershipAccess` calls.
 *
 * ## Why this is a closure and not a value the rule reads
 *
 * The same reasoning `decidePermissionAccess` is given, and the same reason it matters
 * more here: the rule must decide *when* ownership is consulted. A `@Public` route, an
 * unmarked route, a route owning no record and a request with no principal must all reach
 * the registry **never at all** — otherwise every request in the application carries a
 * policy lookup it does not need, and the first thing that breaks under that load is the
 * sign-in path.
 *
 * ## Why the record is described opaquely
 *
 * `attributes` carries the request's params, body and query as plain records, and the
 * policy reads whichever its own domain put there. The core cannot know whether a student
 * arrives as `params.studentId`, `body.studentId` or `query.studentId`, and hard-coding one
 * of those shapes would make the core a place where every module's URL convention has to be
 * registered.
 */
export function buildOwnershipResolver(params: {
  readonly registry: IOwnershipPolicyRegistry;
  readonly userId: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}): (entityType: string) => Promise<{ readonly verdict: 'OWNED' | 'NOT_OWNED' } | undefined> {
  return async (entityType) => {
    const policy = await params.registry.find(entityType);

    // No policy for this type. Returned as `undefined`, NOT as `{ verdict: 'NOT_OWNED' }`,
    // and that distinction is the whole point: `decideOwnershipAccess` reads `undefined`
    // as `NO_POLICY_FOR_ENTITY`, a wiring fault an administrator resolves by registering a
    // module. A synthesised "not owned" would be an ordinary denial, which sends them to a
    // relationship table that does not exist yet.
    if (policy === undefined) return undefined;

    return {
      verdict: await policy.assertOwnership({
        userId: params.userId,
        entityType,
        attributes: params.attributes,
      }),
    };
  };
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
/**
 * Report a cache outcome, and nothing else.
 *
 * ## Why only DEGRADED is reported
 *
 * `HIT` and `MISS` are the cache working. Logging every one of them would put a line on
 * stdout for every permission check on every request, which is how a log stops being read.
 *
 * `DEGRADED` is different: the database answered correctly, so nothing is broken and nothing
 * fails — but every check is paying full price and no `REDIS_URL` problem is visible
 * anywhere. Silence there is how a school runs for months on a cache that stopped working
 * the week it was installed.
 *
 * `BYPASS` is not reported either: no `REDIS_URL` is a configured deployment, and a line per
 * request saying so is noise.
 *
 * Moves to the `AGENTS.md` 2.15 structured logger with everything else in this file.
 */
function reportCacheOutcome(outcome: CacheOutcome, userId: string, permissionKey: string): void {
  if (outcome !== 'DEGRADED') return;

  console.warn(
    `PermissionGuard cache DEGRADED: no cache answer for user ${userId} on ${permissionKey}, ` +
      'so the database was consulted instead. The request was decided correctly and nothing ' +
      'is broken — but REDIS_URL is configured and unreachable, and every permission check ' +
      'is paying database latency. Check the Redis instance (PLT-202 AC-2).',
  );
}

/**
 * Which question refused, so the log can answer it and the wire cannot.
 *
 * `PLT-203`'s acceptance criterion requires role-denial and ownership-denial to be
 * **distinguishable in logs**. They are not distinguishable on the wire — both are the same
 * frozen 403 — and making them distinguishable on the wire would be a defect: a caller
 * probing permissions learns which records exist and which relationships hold.
 */
type DenialFamily = 'PERMISSION' | 'OWNERSHIP';

function refuse(
  reason: PermissionDenialReason | OwnershipDenialReason,
  context: { userId?: string; key?: string; entityType?: string },
): never {
  // `console.warn` is on the base config's `no-console` allow-list. This moves to the
  // `AGENTS.md` 2.15 structured logger once one exists.
  //
  // What appears here and what does not: the userId, the permission KEY and the entity type
  // are in, because "who was denied what, and on which kind of record" is the entire value
  // of the log and none of them is a credential. The sessionId is not, because it is the
  // handle on a live session; nor is any cookie or token value, which this function is
  // never given — and not any attribute of the record, which is exactly the data the
  // ownership check exists to protect.
  const subject =
    context.userId === undefined
      ? 'an unidentified caller'
      : `user ${context.userId}${context.key === undefined ? '' : ` for ${context.key}`}${
          context.entityType === undefined ? '' : ` on ${context.entityType}`
        }`;

  const family: DenialFamily = isOwnershipReason(reason) ? 'OWNERSHIP' : 'PERMISSION';

  // Only `NOT_GRANTED` and `RESOURCE_NOT_OWNED` are policy. Everything else is a wiring
  // fault, and the two send an administrator to opposite places: one to a role, one to
  // `rbac.module.ts`.
  const wiringFault = reason !== 'NOT_GRANTED' && reason !== 'RESOURCE_NOT_OWNED';

  console.warn(
    wiringFault
      ? `PermissionGuard WIRING FAULT (${family}/${reason}): refused ${subject}. ` +
          'A route or a dependency is wrong, not a permission. ' +
          'AGENTS.md 2.3 requires every route to carry @RequirePermission or @Public, and ' +
          `${String(IPERMISSION_GRANT_READER.description)} and ` +
          `${String(IOWNERSHIP_POLICY_REGISTRY.description)} must be registered. ` +
          (reason === 'NO_POLICY_FOR_ENTITY'
            ? 'No IOwnershipPolicy is registered for that entity type — the owning module ' +
              'has not shipped one (PLT-203). The route is refused rather than run unscoped.'
            : '')
      : `PermissionGuard denied ${subject} (${family}/${reason}): ${
          family === 'OWNERSHIP'
            ? 'a policy was found for that entity type and it does not consider this user the owner. ' +
              'Ownership is a relationship, not a role — holding the permission is not the same as owning the record.'
            : 'no role this user holds grants that permission. Roles UNION their permissions; ' +
              'the schema has no primary role.'
        }`,
  );

  throw new ForbiddenException(REFUSED);
}

/**
 * Is this denial reason an ownership one?
 *
 * A hand-written predicate rather than a `Set`, because the two families are separate
 * string unions from separate modules and TypeScript cannot narrow a union of two string
 * unions by anything but a runtime test. The leading `_` is excluded on purpose: it is a
 * permission reason, and an entity type of `_` would be refused by `BLANK_ENTITY_TYPE`
 * anyway — but attributing it to the wrong family in a log would be a lie.
 */
function isOwnershipReason(
  reason: PermissionDenialReason | OwnershipDenialReason,
): reason is OwnershipDenialReason {
  switch (reason) {
    case 'NO_PRINCIPAL':
    case 'RESOURCE_NOT_OWNED':
    case 'NO_POLICY_REGISTRY':
    case 'NO_POLICY_FOR_ENTITY':
    case 'BLANK_ENTITY_TYPE':
      return true;
    default:
      return false;
  }
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
    /**
     * `PLT-202` AC-2 — *"cache role→permission resolution in Redis with invalidation on role
     * change"*, at a target of under 5ms.
     *
     * `@Optional()` and **not** "be lenient": `REDIS_URL` is optional in `env.ts` because
     * Redis has no official Windows build, so a school with no Redis is an ordinary
     * deployment. Absent, every lookup goes to the database and the answers are identical —
     * the only difference is latency. Present but unreachable is also fine: the rule catches
     * the failure, falls back to the database, and reports `DEGRADED` so the outage is
     * visible rather than invisible.
     *
     * What the cache may never do is change an answer. See `cached-permission-lookup.ts`.
     */
    @Optional()
    @Inject(IPERMISSION_CACHE)
    private readonly cache?: IPermissionCache,
    /**
     * `@Optional()` for the same reason `IPermissionGrantReader` is optional, and it is
     * **not** "be lenient": a deployment with no registry refuses every route that names an
     * owned resource, via `NO_POLICY_REGISTRY`. Ownership is opt-in per route, so a
     * Google-only deployment with no ownership-scoped route is unaffected — while one that
     * adds `@OwnsResource` without shipping a policy gets a refusal, not a silent pass.
     */
    @Optional()
    @Inject(IOWNERSHIP_POLICY_REGISTRY)
    private readonly ownership?: IOwnershipPolicyRegistry,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    const requirement = resolvePermissionRequirement(this.reflector, targets);

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
    const ownership = this.ownership;
    const cache = this.cache;
    const userId = request?.principal?.userId;

    // The read-through closure. Built here, not passed as a value, so the RULE decides when
    // the database is consulted — a `@Public` route, an unmarked route and a request with no
    // principal all reach neither the cache nor the reader.
    //
    // The database stays the source of truth on every path that reaches it; the cache only
    // ever lets a confirmed grant be served without asking again.
    const lookup =
      grants === undefined || userId === undefined
        ? undefined
        : async (permissionKey: string): Promise<boolean> => {
            const resolved = await resolvePermissionWithCache({
              userId,
              permissionKey,
              cache,
              isGranted: () => grants.isGranted({ userId, permissionKey }),
            });

            reportCacheOutcome(resolved.outcome, userId, permissionKey);

            return resolved.granted;
          };

    const decision = await decidePermissionAccess({
      requirement,
      hasPrincipal: userId !== undefined,
      lookup,
    });

    if (!decision.allowed) {
      refuse(decision.reason, {
        ...(userId === undefined ? {} : { userId }),
        ...(requirement.kind === 'permission' ? { key: requirement.key } : {}),
      });
    }

    // ---- Second question: may this user touch THIS record? (`PLT-203`) ----
    //
    // Reached only because the role question allowed. Resolved AFTER the permission
    // decision so that a caller who lacks the role is never told whether they would also
    // have failed the scope check.
    const ownershipRequirement = resolveOwnershipRequirement(this.reflector, targets);

    const attributes = ownershipAttributes(request);

    const ownershipDecision = await decideOwnershipAccess({
      requirement: ownershipRequirement,
      hasPrincipal: userId !== undefined,
      resolve:
        ownership === undefined || userId === undefined
          ? undefined
          : buildOwnershipResolver({ registry: ownership, userId, attributes }),
    });

    if (ownershipDecision.allowed) return true;

    refuse(ownershipDecision.reason, {
      ...(userId === undefined ? {} : { userId }),
      ...(requirement.kind === 'permission' ? { key: requirement.key } : {}),
      ...(ownershipRequirement.kind === 'resource'
        ? { entityType: ownershipRequirement.entityType }
        : {}),
    });
  }
}

/**
 * Flatten a request into the opaque record a policy reads.
 *
 * Params, query and body, each under its own key, so a policy can tell them apart without
 * the core knowing anything about any module's URL or payload shape. `Object.create(null)`
 * avoids inheriting `constructor` and friends from a prototype — a request body is
 * attacker-controlled, and a policy testing `'constructor' in attributes` must not be
 * misled by the prototype chain.
 *
 * Every value is passed through as-is and never interpreted. That is the point: the policy
 * owns interpretation, so a new module cannot require the core to change.
 */
function ownershipAttributes(request: unknown): Readonly<Record<string, unknown>> {
  const carrier = asRecord(request);
  const attributes = Object.create(null) as Record<string, unknown>;

  // Copied defensively rather than aliased, so a policy cannot mutate the live request.
  for (const source of ['params', 'query', 'body'] as const) {
    const value = carrier[source];
    attributes[source] =
      value !== null && typeof value === 'object' ? { ...(value as object) } : value;
  }

  return attributes;
}

/** Narrow an unknown to an indexable record without a cast or an `any`. */
function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object'
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}
