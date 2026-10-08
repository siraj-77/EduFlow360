/**
 * The ownership port, and the DI tokens that make it injectable.
 *
 * ## Declared here for the same structural reason as `IPERMISSION_GRANT_READER`
 *
 * `PermissionGuard` lives in `common/guards/` because it guards every route in the
 * application. If these tokens were declared in `rbac.module.ts` that guard would have to
 * import the module graph to read one symbol. Declared here, `common/` depends on a port
 * and nothing else. `rbac.module.ts` re-exports them.
 *
 * ## What `PLT-203` is, and what it deliberately is not
 *
 * `AGENTS.md` 2.3 requires ownership policies — teacher to own classes, parent to own
 * children, vendor to own own outlet — and requires role-denial and ownership-denial to be
 * **distinguishable in logs**. That is this file's whole job.
 *
 * What it is not is a set of concrete teacher/parent/vendor policies. **Those cannot be
 * written yet, and the shipped schema says so in its own words.** The `User` model comment
 * in `prisma/schema.prisma` reads:
 *
 * > "A user holds NO student/teacher/parent data here: `PLT-203` resolves ownership through
 * > abstract ports, and the domains that would own those relationships do not exist yet."
 *
 * There is no class table, no section, no guardian link, no parent-child edge and no outlet
 * table in this repository. A teacher-to-own-classes check has nothing to check against.
 * Writing one would mean inventing those relationships, which is `AGENTS.md` 6's named
 * failure: *"A gap is recorded, never filled with an invented threshold."*
 *
 * So this port is the **seam**, and the academic, retail and family domains fill it in when
 * they land. That is what `PLT-203`'s second acceptance criterion asks for — *"Ownership
 * policies are pluggable — adding a new entity type's ownership rule doesn't require touching
 * the core guard"* — and it is why the registry is looked up **by entity type** rather than
 * being a fixed list inside `PermissionGuard`.
 *
 * ## Why this is deliberately NOT a stub
 *
 * The alternative shapes were all worse:
 *
 * - a method returning `true` — the next developer wires a controller to it and a
 *   cross-family data leak ships;
 * - an empty policy list that reads like a configured one — indistinguishable from "we
 *   checked and nobody owns this";
 * - `NO_OWNERSHIP_POLICY_FOUND` mapped to *allow* — an authentication bypass with a
 *   reassuring name.
 *
 * Instead the absence of a policy is a **refusal** (`NO_POLICY_FOR_ENTITY`), which
 * `decide-ownership.ts` owns. See its header for why that is the load-bearing decision.
 */

/**
 * DI token for the registry the guard resolves entity types against.
 *
 * ## Why there is NO `IOwnership_POLICY` per-policy token
 *
 * A per-policy DI token was declared here first and removed. Policies are contributed by a
 * domain **calling `RbacModule.forRoot(config, [myPolicy])`**, so a token nothing resolves
 * would be a second registration path — and two ways to register the same thing is how a
 * deployment ends up with one policy registered twice or, worse, believing it registered a
 * policy that DI silently discarded.
 *
 * If a domain ever genuinely needs Nest to *construct* its policy, the token comes back with
 * that domain and with a caller for it. Until then there is one mechanism, not two.
 */
export const IOWNERSHIP_POLICY_REGISTRY = Symbol('IOwnershipPolicyRegistry');

/**
 * A resource type, as `@OwnsResource('<entity_type>')` spells it.
 *
 * `snake_case`, lowercase, no module prefix — deliberately unlike the permission keys'
 * `MODULE_ACTION` (`ADR-012`), because a reader looking at a decorated route must be able
 * to tell from the argument which gate fired.
 *
 * Branded as a plain `string` rather than a template-literal union, because the set of
 * entity types is owned by domains that do not exist yet. Inventing the union now would be
 * the same fabrication as inventing the tables.
 */
export type OwnershipEntityType = string;

/**
 * What a policy is asked about.
 *
 * `attributes` is deliberately **opaque and uninterpreted**. Only the policy knows whether
 * its identifier arrives as a route param (`params.classId`), a body field
 * (`body.studentId`) or a query parameter, so the core cannot build a path it would then
 * have to keep in step with every module's URL shape.
 *
 * It is a `Readonly<Record<string, unknown>>` rather than an Express `Request` on purpose:
 * `AGENTS.md` 2.2 keeps `domain/` free of framework types, and structural typing lets the
 * real request satisfy this without a cast or an `any`.
 */
export interface OwnershipSubject {
  /** The authenticated local account. The only identity a policy may key on. */
  readonly userId: string;
  /** The type of record being touched, as declared by `@OwnsResource`. */
  readonly entityType: OwnershipEntityType;
  /** Request data for the policy to read. Never interpreted by the core. */
  readonly attributes: Readonly<Record<string, unknown>>;
}

/**
 * The only two answers.
 *
 * There is deliberately no `NOT_APPLICABLE`. A policy is looked up **by** the entity type
 * it declares, so a registered policy answering "not applicable" about its own type is a
 * contradiction — a bug that would otherwise open a route. Making the state unrepresentable
 * is cheaper than defending against it.
 *
 * `NOT_OWNED` is an ordinary denial. It must never be conflated with a wiring fault: an
 * administrator responds to the first by checking a relationship, and to the second by
 * checking a module registration.
 */
export type OwnershipVerdict = 'OWNED' | 'NOT_OWNED';

/**
 * One entity type's ownership rule.
 *
 * ## The contract an implementation must honour
 *
 * - **`OWNED` only on a real relationship.** Not on "the caller holds a role that usually
 *   implies it", not on "the record is not sensitive", not on an empty result set read as
 *   vacuously true. `PLT-203`'s own acceptance test is that a teacher holding
 *   `GRADE_ENTER` still cannot touch another teacher's class — the permission is granted,
 *   the ownership is not.
 * - **`NOT_OWNED` on absence, including absence caused by a lookup that found nothing.**
 *   This is the fail-closed direction and it is the whole point.
 * - **Never throw for a caller who simply does not own the record.** Throw for an outage;
 *   `decideOwnershipAccess` deliberately does not catch, so an outage surfaces as a 500
 *   rather than a 403 that reads like policy. Conflating the two hides an incident behind
 *   an authorization message.
 * - **Read only `subject.attributes`.** A policy that queries "who currently owns X" is
 *   correct; a policy that *grants* ownership is not an ownership policy.
 */
export interface IOwnershipPolicy {
  /** The type this policy answers for. Matched exactly, case-sensitively. */
  readonly entityType: OwnershipEntityType;

  /** Answer whether `subject.userId` may act on the record described. */
  assertOwnership(subject: OwnershipSubject): Promise<OwnershipVerdict>;
}

/**
 * Resolves an entity type to its policy, or to nothing.
 *
 * A registry rather than an array injected into the guard, for the reason the acceptance
 * criterion names: adding a new entity type's rule is a **registration**, and the core
 * guard is not edited to accommodate it.
 *
 * `find` returns `undefined` rather than a default-deny policy on purpose. The refusal is
 * `decideOwnershipAccess`'s to make, so that "nobody registered this" is logged as the
 * wiring fault it is instead of arriving pre-decided and indistinguishable from a real
 * policy saying no.
 */
export interface IOwnershipPolicyRegistry {
  find(entityType: OwnershipEntityType): Promise<IOwnershipPolicy | undefined>;
}
