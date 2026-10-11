import type { IReasonPolicy } from '../ports/reason-policy.js';

/**
 * Which `@Audited('<ACTION>')` keys demand a `reason`, and the default policy
 * the module supplies (`PLT-402` T2, `AGENTS.md` 2.6).
 *
 * ## The rule, stated once
 *
 * An action whose audit record must answer "why" cannot be satisfied by a
 * stored null. So the request carrying no reason is refused with 400 **before
 * the transaction opens** — the shape `ADR-013` names for the same decision
 * from the other side.
 *
 * ## Why a set, and why it is frozen
 *
 * A reason requirement is a policy, and a policy that can be widened at
 * runtime by a caller is a policy that exists until someone inconvenient
 * needs it gone. `Object.freeze` at module load makes the widening a code
 * change, which is a reviewable one. When `FR-FIN`'s reversal route ships it
 * adds `FINANCE_INVOICE_REVERSE` here and `permission-catalogue.spec.ts`
 * keeps it honest.
 *
 * ## What an empty set does, and the direction it fails
 *
 * Nothing. No action is refused for a missing reason, and no record gains a
 * reason nobody wrote. That is the safe direction: an action demanding a
 * reason it never received produces a row an auditor cannot act on, and an
 * action NOT demanding one costs nothing until it exists.
 *
 * The cost is stated rather than hidden: while the set is empty, every action
 * in the system records `reason: null`, and `PLT-602` T3's "settings changes
 * are audit-logged with a reason" will be the first caller of this set.
 */

/** The port, re-exported so import sites read the same as every other port here. */
export type { IReasonPolicy } from '../ports/reason-policy.js';

/**
 * The actions whose record must say why.
 *
 * **Empty.** See the header: no module in this repository can currently
 * demand a reason, and inventing an entry here would put a mandatory field
 * in front of an action no corpus document requires one for. The first entry
 * arrives with the module that needs it, not before.
 */
export const REASON_REQUIRED_ACTIONS: ReadonlySet<string> = Object.freeze(new Set<string>());

/** The pure predicate the frozen set is read through. */
export function isReasonRequired(action: string): boolean {
  return REASON_REQUIRED_ACTIONS.has(action);
}

/** The default policy: the frozen set, and nothing else. */
export class FrozenReasonPolicy implements IReasonPolicy {
  isReasonRequired(action: string): boolean {
    return isReasonRequired(action);
  }
}
