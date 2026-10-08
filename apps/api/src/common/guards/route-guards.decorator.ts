import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../modules/rbac/domain/permission-catalogue.js';

/**
 * The three guards `AGENTS.md` 2.3 requires on every route.
 *
 * > | Permission | `@RequirePermission('<PERMISSION_KEY>')` | The user's role grants this action |
 * > | Entitlement | `@RequireEntitlement('<feature_key>')` | The school's licence includes this feature |
 * > | Audit | `@Audited('<ACTION_KEY>')` | The action is recorded append-only |
 * > | Public | `@Public('<reason>')` | The only exemption from `@RequirePermission` |
 *
 * `@Public` lives in its own file because it carries the reason requirement and
 * the allowlist reconciliation; the other three are a key and nothing more.
 *
 * ## These are metadata, not enforcement
 *
 * That is the honest part. A decorator records an intention, and something has
 * to read it. The reader does not exist yet either: there is no global
 * `AuthGuard` registered in `app.module.ts`, because there is no permission
 * engine, no session resolution and no licence verification to enforce against.
 *
 * So these decorators are the *vocabulary*, not the *wall*, and shipping them
 * without that said plainly would be the worst outcome: a file full of
 * `@RequirePermission` reads exactly like an implemented control, and a
 * reviewer would reasonably believe the route was protected.
 *
 * `check-route-guards.mjs` is the part that IS enforced today, and it is
 * enforced for real - it fails the build. It cannot verify that the guard
 * *works*, only that it is *present*, which is the honest ceiling today.
 */

/**
 * A `MODULE_ACTION` key from the code catalogue (`ADR-012`).
 *
 * **The union, not `string`.** It was `string` until `PLT-205` T1, and the difference is the
 * whole point: `RequirePermission('ATTENDANCE_MARAK')` is now a **compile error** rather than
 * a route that returns 403 for every role in the system. A key absent from
 * `PERMISSION_CATALOGUE` is not a permission — it is a typo, and a typo should not compile.
 *
 * Re-exported from its own module so every import site reads the same as every other port
 * here. `permission-catalogue.spec.ts` is the other half: it reconciles the catalogue against
 * every key the real controllers declare, in **both** directions, so a key cannot enter the
 * union without either gating a route or stating why it does not yet.
 */
export type { PermissionKey } from '../../modules/rbac/domain/permission-catalogue.js';

/** A feature key from the signed licence certificate (`ADR-009`). */
export type EntitlementKey = string;

/** An `@Audited` action key, written to `audit_records` by `PLT-402`. */
export type AuditKey = string;

export const PERMISSION_KEY = 'eduflow:permission';
export const ENTITLEMENT_KEY = 'eduflow:entitlement';
export const AUDIT_KEY = 'eduflow:audit';

/** The user must hold a role granting this permission (`AGENTS.md` 2.3). */
export const RequirePermission = (permission: PermissionKey): MethodDecorator =>
  SetMetadata(PERMISSION_KEY, requireKey(permission, '@RequirePermission'));

/** The licence must include this feature. Stops a Basic school reaching Deluxe. */
export const RequireEntitlement = (feature: EntitlementKey): MethodDecorator =>
  SetMetadata(ENTITLEMENT_KEY, requireKey(feature, '@RequireEntitlement'));

/** The action is recorded append-only. Mandatory on the sensitive subset. */
export const Audited = (action: AuditKey): MethodDecorator =>
  SetMetadata(AUDIT_KEY, requireKey(action, '@Audited'));

/**
 * A blank key is the same failure as a blank `@Public` reason: it satisfies
 * the syntax the static check looks for while carrying no instruction. So it
 * is refused at the call site rather than at the first request.
 */
function requireKey(key: string, decorator: string): string {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error(
      `${decorator} requires a non-empty key (AGENTS.md 2.3). An empty key is a decorator ` +
        'that checks for nothing and looks identical on the route to one that does.',
    );
  }
  return key.trim();
}
