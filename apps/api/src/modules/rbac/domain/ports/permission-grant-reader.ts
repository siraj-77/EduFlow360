/**
 * The port the permission guard asks, and the DI token that makes it injectable.
 *
 * ## Declared here rather than in `rbac.module.ts`, for a structural reason
 *
 * Exactly the reason `I_SESSION_REPOSITORY` is declared in its port file:
 * `PermissionGuard` lives in `common/guards/`, because it guards every route in the
 * application rather than one module. If the token were declared in `rbac.module.ts`,
 * that guard would have to import the whole module graph — reaching `@prisma/client`
 * and every controller — to read one symbol. Declared here, `common/` depends on a
 * port and nothing else. `rbac.module.ts` re-exports it, so import sites are unaffected.
 *
 * ## What the schema actually gives us to evaluate
 *
 * Read before this interface was written, because the temptation with a permission
 * engine is to invent a model and then find a place to hang it on. The shipped
 * `prisma/schema.prisma` already answers the question, and the answer is a relation
 * and not a string-keyed map:
 *
 *   User ──< UserRole >── Role ──< RolePermission >── Permission
 *
 * - `UserRole` is a **join**, not a single foreign key (`D-4.1`, owner-confirmed
 *   2026-09-30), so a teacher who is also a parent holds both roles.
 * - `Permission.key` is the `MODULE_ACTION` key `ADR-012` asks for —
 *   `FINANCE_INVOICE_REVERSE`, `AUTH_LINK_EXTERNAL_IDENTITY` — and is populated by a
 *   deploy-time sync, never hand-typed into a role.
 * - `RolePermission` has a composite primary key, so the same grant cannot be
 *   inserted twice.
 * - **There is no primary-role flag and no validity window, both deliberate.** A user
 *   with three roles holds the **UNION** of their permissions, because `AGENTS.md` 2.3
 *   makes the permission the only thing that gates a route and a second source of
 *   truth for "what can this user do" would disagree with the first one an admin
 *   reordered anything.
 *
 * So the evaluation is an **existence question**, not a computation: does a grant row
 * exist joining this user's roles to a `Permission` with this key? That is why this
 * port has one method and no arithmetic — there is no deny-rule, no wildcard and no
 * inheritance to evaluate, and a port offering any of those would be inviting a
 * permission model that the schema does not have.
 *
 * The same existence query answers the second question the guard asks — "is this key
 * real?" — for free. A key no `Permission` row carries has no grant row either, so a
 * typo or an unsynced catalogue entry refuses rather than passing. That is why there
 * is no separate `isKnownPermission` method: it would be a second round trip
 * answering a question the first one already answered.
 *
 * ## Ownership is NOT here, and that is a recorded gap rather than an omission
 *
 * `AGENTS.md` 2.3 also requires **ownership policies** (`IOwnershipPolicy`): teacher
 * to own classes, parent to own children, vendor to own own outlet, with role-denial
 * and ownership-denial distinguishable in logs.
 *
 * Those cannot be built yet, and the schema says so in its own words — the `User`
 * model comment reads: "A user holds NO student/teacher/parent data here: `PLT-203`
 * resolves ownership through abstract ports, and the domains that would own those
 * relationships do not exist yet."
 *
 * There is no class table, no guardian link, no parent-child edge, no outlet table and
 * no `IOwnershipPolicy` port in this repository. A teacher-to-own-classes check
 * therefore has nothing to check against, and writing one would mean inventing the
 * relationships — which is `AGENTS.md` 6's named failure: "a gap is recorded, never
 * filled with an invented threshold."
 *
 * So ownership is **out of scope for this port and recorded as `PLT-203`**. It is
 * deliberately not a stub either: a method that returned `true`, or an empty policy
 * list that read like a configured one, would be worse than an absent method, because
 * the next developer would wire a controller to it.
 */

/** DI token. A symbol because an `interface` has no runtime value to resolve against. */
export const IPERMISSION_GRANT_READER = Symbol('IPermissionGrantReader');

/**
 * Answers one question about one user and one permission key.
 *
 * ## The contract an implementation must honour
 *
 * - **True only on a real grant.** Not on a wildcard, not on "the role is a system
 *   role", not on "the user is an administrator". `isSystemRole` marks a role
 *   immutable (`ADR-012`); it grants nothing by itself.
 * - **False for a key no `Permission` row carries.** An unsynced or misspelled
 *   catalogue entry is not a grant.
 * - **False for a user holding no role at all.** That is the fail-closed reading and
 *   it is the one `decidePermissionAccess` relies on.
 * - **The UNION of every role the user holds.** Never the "primary" one, because the
 *   schema has no primary role.
 *
 * ## Errors are not answers
 *
 * An implementation that throws is not returning `false`. The guard lets the failure
 * propagate so it surfaces as a 500 rather than a 403: a database outage is not a
 * permission decision, and turning one into the other would hide an outage behind a
 * refusal that reads like policy.
 */
export interface IPermissionGrantReader {
  isGranted(params: { readonly userId: string; readonly permissionKey: string }): Promise<boolean>;
}
