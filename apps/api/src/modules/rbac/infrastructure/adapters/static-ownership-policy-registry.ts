import {
  type IOwnershipPolicy,
  type IOwnershipPolicyRegistry,
  type OwnershipEntityType,
} from '../../domain/ports/ownership-policy.js';

/**
 * `StaticOwnershipPolicyRegistry` — the registry `PermissionGuard` resolves against.
 *
 * ## Why a map, and why built from a list at wiring time
 *
 * `PLT-203`'s second acceptance criterion is *"Ownership policies are pluggable — adding a
 * new entity type's ownership rule doesn't require touching the core guard."* A map keyed by
 * `entityType` satisfies that literally: a domain ships its `IOwnershipPolicy`, its module
 * adds it to the list it passes to `forRoot`, and no file in `common/guards/` changes.
 *
 * The alternative — the guard importing each policy directly — is the failure this design
 * exists to prevent, and it is the reason `IPermissionGrantReader` is a port at all.
 *
 * ## Lookup is EXACT and case-sensitive, on purpose
 *
 * `'Student'`, `'student'` and `'STUDENT'` are three different keys and at most one of them
 * is registered. That is not a sharp edge to be smoothed over: a policy registered under a
 * spelling the route does not use resolves to nothing, and nothing resolves to
 * `NO_POLICY_FOR_ENTITY`, which is a **refusal**. A silently case-folding lookup would turn
 * a typo into a successful check against the wrong rule, which is the one outcome a
 * security control must never produce by accident.
 *
 * ## It holds no state and touches no database
 *
 * There is nothing here to cache, invalidate or fail at runtime. `PLT-202`'s Redis
 * requirement is on *permission* resolution, which is a join across three tables; ownership
 * resolution is a lookup in a list this process was given at boot. When a policy needs a
 * query, the policy owns the query — behind its own port — and that is where caching
 * belongs.
 *
 * ## Duplicate registration is refused at construction, not at first use
 *
 * Two policies claiming `student` means one of them is unreachable and nobody will find out
 * which. Detecting it here turns a silent shadowing bug into a boot failure, which is the
 * whole difference between a wiring mistake and an incident.
 */
export class StaticOwnershipPolicyRegistry implements IOwnershipPolicyRegistry {
  private readonly byEntityType: ReadonlyMap<OwnershipEntityType, IOwnershipPolicy>;

  constructor(policies: readonly IOwnershipPolicy[]) {
    const byEntityType = new Map<OwnershipEntityType, IOwnershipPolicy>();

    for (const policy of policies) {
      const claimed = byEntityType.get(policy.entityType);

      if (claimed !== undefined) {
        // Both constructors are named, because "one of these two is unreachable" is only
        // actionable if you know which pair.
        throw new Error(
          `Two IOwnershipPolicy implementations both claim entityType '${policy.entityType}' ` +
            `(${claimed.constructor.name} and ${policy.constructor.name}). Exactly one may ` +
            'own a type; the other would be unreachable and the shadowing would not be ' +
            'visible until an ownership check silently stopped being performed.',
        );
      }

      byEntityType.set(policy.entityType, policy);
    }

    // Frozen by construction: `Object.freeze` on a Map does not prevent `set`, so the map is
    // held in a `readonly` field and never handed out. Nothing mutates it after this line.
    this.byEntityType = byEntityType;
  }

  async find(entityType: OwnershipEntityType): Promise<IOwnershipPolicy | undefined> {
    return this.byEntityType.get(entityType);
  }

  /**
   * The registered entity types.
   *
   * Exists so the boot warning can name what IS registered, which turns "ownership is not
   * configured" from a shrug into a list somebody can compare against a route they are
   * about to write.
   */
  registeredEntityTypes(): readonly OwnershipEntityType[] {
    return [...this.byEntityType.keys()].sort();
  }
}
