/**
 * The ownership decision, as a rule with no framework in it.
 *
 * ## Why a rule and not a lookup helper
 *
 * The same reason `decide-permission.ts` gives, and the same shape: a security decision
 * buried in plumbing is a security decision that will be wrong. `CsrfGuard` splits its rule
 * into `isCsrfRequestAcceptable` and `SessionGuard` into `isPublicRoute`; this is the third
 * such split, and it lives under `domain/` because it imports nothing — no NestJS, no ORM,
 * no clock (`AGENTS.md` 2.2, 2.4).
 *
 * ## What it decides
 *
 * One question: **may this caller touch this record?**
 *
 * A permission answers "may this ROLE do this?" and ownership answers "may this USER touch
 * THIS RECORD?". They are not substitutes. `@RequirePermission('GRADE_ENTER')` is
 * satisfied by every teacher holding that key, which is exactly why it cannot stop teacher
 * A from editing teacher B's grades — the case `PLT-203` exists to close, and the reason
 * `AGENTS.md` 2.3 requires both.
 *
 * ## The property this file exists to guarantee: it fails CLOSED
 *
 * Outside the unscoped case there is exactly one way to be allowed — a policy was found
 * for the named entity type and it positively said `OWNED`. Every other outcome is a
 * refusal, and each refusal is a way the answer could have become "allowed" by accident:
 *
 * - no principal (`SessionGuard` did not resolve one — a wiring fault);
 * - no policy registry wired (a deployment that cannot evaluate ownership);
 * - a blank entity type (metadata set by other means);
 * - **no policy registered for the named type** — see below;
 * - the policy answered anything other than the exact string `'OWNED'`.
 *
 * ## NO_POLICY_FOR_ENTITY is the decision this file is really about
 *
 * A route declares `@OwnsResource('student')` and no module registered a student policy.
 * Three answers are available and two of them are wrong:
 *
 * | answer | verdict |
 * |---|---|
 * | allow, because no policy means no restriction | **authentication bypass.** The route announced it was ownership-scoped and the engine silently declined to scope it. |
 * | allow, because no policy means nothing to check | the same bypass, better dressed. |
 * | **refuse, as a wiring fault** | **correct.** |
 *
 * The second one is the trap, because it is what a guard does when a feature is simply
 * absent, and it is indistinguishable — on the wire and in the log — from a working
 * installation that checked and found the caller does not own the record. So a missing
 * policy is refused *and* classed as a wiring fault, which sends an operator to
 * `rbac.module.ts` rather than to a relationship table.
 *
 * The cost of this choice is that adding `@OwnsResource` to a route before its domain
 * exists breaks that route. That is the intended direction of failure: a visibly broken
 * route is recoverable, a quietly unscoped one is a data breach.
 *
 * ## Why the rule OWNS the resolution, for the reason decidePermissionAccess does
 *
 * The resolver arrives as a **function this rule calls**, not a value it reads. Otherwise a
 * caller could consult ownership before the cheap preconditions, putting a lookup in front
 * of every route in the application — including the ones that declare no resource at all and
 * therefore need none. Two properties then hold structurally rather than by convention:
 *
 * - the ownership layer cannot be consulted until every precondition has passed, and
 * - it cannot be consulted twice, or not at all when it must be.
 *
 * `decide-ownership.spec.ts` asserts both by counting invocations, which is the only honest
 * way to test whether the store was touched.
 */

/**
 * What the route's metadata asks for.
 *
 * Resolved from `Reflector` in `common/guards/permission.guard.ts`, because `Reflector` is a
 * NestJS type and `domain/` may not import one (`AGENTS.md` 2.2). Reading metadata is
 * framework work; deciding what it means is not.
 */
export type OwnershipRequirement =
  /** `@OwnsResource('<entity_type>')`. The type arrives untrimmed; trimming is decided here. */
  | { readonly kind: 'resource'; readonly entityType: string }
  /**
   * The route declares no resource.
   *
   * **Allowed, and it is the only allowed row that is not a positive confirmation.** There
   * is nothing to scope, so there is nothing to refuse — a route that lists classes is not
   * a route that half-authorises a class it does not list. The guard still reaches this rule
   * so the "no resource" case is decided in one place instead of being an implicit skip.
   */
  | { readonly kind: 'unscoped' };

/**
 * Why an ownership check was refused.
 *
 * Enumerated rather than a bare `false` because `PLT-203`'s first acceptance criterion
 * requires the denial reason to be **distinguishable in logs**, and because an operator
 * sent to a role table when the fault is a missing module registration loses the only hour
 * that would have found it. The wire answer stays one identical 403 — see
 * `permission.guard.ts`, whose `REFUSED` body this shares.
 */
export type OwnershipDenialReason =
  /** No principal: `SessionGuard` did not resolve one. A wiring fault. */
  | 'NO_PRINCIPAL'
  /** The route names an entity type, but the string is empty or whitespace. */
  | 'BLANK_ENTITY_TYPE'
  /** No registry is registered, so no policy can be resolved. */
  | 'NO_POLICY_REGISTRY'
  /**
   * A policy is required for this entity type and none is registered.
   *
   * The load-bearing refusal. See the file header.
   */
  | 'NO_POLICY_FOR_ENTITY'
  /** A policy was found and it does not consider the caller the owner. An ordinary denial. */
  | 'RESOURCE_NOT_OWNED';

export type OwnershipDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: OwnershipDenialReason };

/**
 * What resolving an entity type produced.
 *
 * `undefined` means **no policy is registered for that type**, which is a different thing
 * from a policy that answered "no" — and the rule keeps them apart so the log can.
 */
export type OwnershipResolution = { readonly verdict: 'OWNED' | 'NOT_OWNED' } | undefined;

/** The facts the rule needs. */
export interface OwnershipFacts {
  readonly requirement: OwnershipRequirement;
  /** Whether `SessionGuard` attached a principal to this request. */
  readonly hasPrincipal: boolean;
  /**
   * Resolves the named entity type to a verdict.
   *
   * Absent means no registry is wired. Called **at most once**, and only after every other
   * precondition has passed — which is the whole reason it is a function.
   */
  readonly resolve?: ((entityType: string) => Promise<OwnershipResolution>) | undefined;
}

/**
 * Decide whether a caller may act on the record a route names.
 *
 * The order is load-bearing and is asserted by name in the spec: each refusal names the
 * *first* thing wrong.
 *
 * @throws whatever `resolve` throws. A policy-store failure is not an ownership decision,
 *   so it is not caught here and not folded into a refusal — the guard lets it become a
 *   500, which says what it is, rather than a 403 that reads like policy.
 */
export async function decideOwnershipAccess(facts: OwnershipFacts): Promise<OwnershipDecision> {
  const { requirement } = facts;

  // A route with no resource is allowed, and is asked FIRST so that no principal and no
  // registry are needed to serve it. Ownership must never make a non-scoped route
  // unreachable — that would put authentication in front of every list screen in the
  // application for no security benefit.
  if (requirement.kind === 'unscoped') return { allowed: true };

  // A blank type is refused rather than resolved. `@OwnsResource` already throws on one at
  // the call site, so this is belt-and-braces against metadata set by other means — and
  // the direction matters: an empty string will never match a registered policy, so
  // resolving it would fall through to `NO_POLICY_FOR_ENTITY` and report the wrong fault.
  if (requirement.entityType.trim().length === 0) {
    return { allowed: false, reason: 'BLANK_ENTITY_TYPE' };
  }

  // Unreachable in a correctly wired application, because `SessionGuard` runs first and
  // refuses before this guard is consulted. Refusing keeps it that way if the registration
  // order in `app.module.ts` ever changes.
  if (!facts.hasPrincipal) return { allowed: false, reason: 'NO_PRINCIPAL' };

  // A deployment that cannot evaluate ownership registers no registry. "We cannot answer"
  // is neither "yes" nor "no", and answering either would let a missing dependency read as
  // a working installation — the same reasoning that gives `NO_GRANT_READER` in
  // `decidePermissionAccess`.
  const { resolve } = facts;
  if (resolve === undefined) return { allowed: false, reason: 'NO_POLICY_REGISTRY' };

  // Not wrapped in a try/catch — see the `@throws` note above.
  const resolution = await resolve(requirement.entityType.trim());

  // No policy for this type. Refused, and refused as a wiring fault rather than as an
  // ordinary denial: the route said it was ownership-scoped and the engine has nothing to
  // scope it with. See the file header for why allowing here is an authentication bypass.
  if (resolution === undefined) {
    return { allowed: false, reason: 'NO_POLICY_FOR_ENTITY' };
  }

  // `=== 'OWNED'`, not a truthiness test. A policy is third-party code from the guard's
  // point of view, and one returning `'OWNED'`, `{ owned: true }`, `1` or `undefined`
  // through a broken adapter must not open a record.
  return resolution.verdict === 'OWNED'
    ? { allowed: true }
    : { allowed: false, reason: 'RESOURCE_NOT_OWNED' };
}
