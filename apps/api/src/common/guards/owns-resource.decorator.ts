import { SetMetadata } from '@nestjs/common';

/**
 * `@OwnsResource('<entity_type>')` — `PLT-203`.
 *
 * ## Where this sits, and why it is not a fourth `@RequirePermission`
 *
 * `@RequirePermission` answers **"may this ROLE do this?"**. This answers **"may this USER
 * touch THIS RECORD?"**. They are not substitutes, and `AGENTS.md` 2.3 requires both:
 *
 * > "Ownership policies are enforced, not just roles (`IOwnershipPolicy`): teacher → own
 * > classes, parent → own children, vendor → own outlet."
 *
 * A teacher holding `GRADE_ENTER` satisfies the permission. That is exactly why the
 * permission cannot stop teacher A editing teacher B's grades — the grant is correct and
 * the scope is wrong, and only a second question distinguishes them.
 *
 * ## Its own file, for the reason `@Public` has one
 *
 * `route-guards.decorator.ts` holds the three `AGENTS.md` 2.3 guards, and that file's
 * vocabulary is deliberately closed: `check-route-guards.mjs` reconciles a route against
 * it, and a fourth name in that vocabulary would read as a fourth *mandatory* guard. This is
 * not mandatory on every route — most routes own no record — so keeping it out of that file
 * is what stops the checker and the next reader from treating it as one.
 *
 * It is read by `PermissionGuard` rather than by a guard of its own, because `PLT-203`
 * requires ownership to run *in the same pipeline* as the permission check: role first,
 * then scope, and a role failure must never be reported as a scope failure.
 *
 * ## It is metadata, exactly as the other three are
 *
 * Nothing here enforces anything. `PermissionGuard` reads this key, and the refusal happens
 * in `decideOwnershipAccess` — which fails CLOSED, so a route carrying `@OwnsResource`
 * whose entity type has no registered policy is **refused**, not allowed.
 *
 * ## The one thing to be careful about when using it
 *
 * Declaring `@OwnsResource('x')` before a policy for `x` exists **breaks that route**. That
 * is the intended direction of failure: a visibly broken route is recoverable, and a route
 * that silently ran unscoped is a data breach.
 */

export const OWNS_RESOURCE_KEY = 'eduflow:owns-resource';

/**
 * Declares that this route acts on one record, whose ownership must be confirmed.
 *
 * @param entityType `snake_case`, lowercase, no module prefix — the key
 *   `IOwnershipPolicyRegistry` resolves. Deliberately unlike a permission key's
 *   `MODULE_ACTION` (`ADR-012`), so a reader can tell from the decorator which gate fired.
 *
 * @throws at the call site on a blank type, for the reason `RequirePermission` throws on a
 *   blank key (`D52`): a decorator that silently accepts `''` produces a route that looks
 *   scoped and is not, and the mistake is invisible until an audit.
 */
export const OwnsResource = (entityType: string): MethodDecorator & ClassDecorator => {
  if (typeof entityType !== 'string' || entityType.trim().length === 0) {
    throw new Error(
      '@OwnsResource requires a non-empty entity type (AGENTS.md 2.3). ' +
        'A blank type can never match a registered policy, so the route would look ' +
        'ownership-scoped while nothing scoped it. Use @RequirePermission alone for a ' +
        'route that owns no record.',
    );
  }

  // Trimmed here and nowhere else. Whether a blank type is refused is one decision with
  // one owner — `decideOwnershipAccess` — and trimming in both places would put a second
  // opinion on the same route.
  return SetMetadata(OWNS_RESOURCE_KEY, entityType.trim());
};
