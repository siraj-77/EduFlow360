import { describe, expect, it } from 'vitest';
import { FrozenReasonPolicy, REASON_REQUIRED_ACTIONS, isReasonRequired } from './reason-policy.js';

/**
 * Which `@Audited` actions demand a `reason`, and what happens when one is
 * sent without (`PLT-402` T2).
 *
 * ## The rule is a REFUSAL, and it fires before the action
 *
 * `AGENTS.md` 2.6: a manual journal entry requires a mandatory reason. The
 * generalisation is that an action whose record must answer "why" cannot be
 * satisfied by a row whose `reason` is null — so the request is rejected with
 * 400 BEFORE the transaction opens, not after, and not by storing null and
 * hoping. A reason demanded afterwards is a reason nobody gives.
 *
 * ## Why the set is EMPTY, and why that is the correct state
 *
 * Nothing in this repository can currently demand a reason: there is no fee
 * reversal, no grade change, no manual journal entry, and no settings write
 * (`AGENTS.md` 6 — a gap is recorded, never filled with an invented
 * threshold). The two examples the story names, `fee reversal` and `grade
 * change`, belong to modules that do not exist.
 *
 * So the set is empty in exactly the way `ownershipPoliciesFor()` is empty:
 * the mechanism is real and tested, and the domains that will fill it have
 * not shipped. An invented entry — say `LOGIN` — would make every sign-in
 * carry a mandatory field that no corpus document asks for.
 *
 * ## Why it is injectable rather than imported
 *
 * `StaticOwnershipPolicyRegistry` establishes the pattern and the reason: the
 * interceptor holds the port, the module supplies the default. When the
 * first high-sensitivity action ships, its module adds its key to the frozen
 * set (or supplies its own policy) without `common/interceptors/` changing —
 * which is the same Open/Closed rule `AGENTS.md` 2.2 states for adapters.
 */

describe('REASON_REQUIRED_ACTIONS — the frozen default set', () => {
  it('is empty, because no action in this repository can yet demand one', () => {
    // Asserted rather than assumed, so the day a module adds an entry this
    // test fails and forces the author to justify it here.
    expect([...REASON_REQUIRED_ACTIONS]).toEqual([]);
  });

  it('is frozen, so a policy cannot be widened at runtime by a caller', () => {
    // A reason requirement that can be removed without a deploy is a reason
    // requirement that exists until someone inconvenient needs it gone.
    expect(Object.isFrozen(REASON_REQUIRED_ACTIONS)).toBe(true);
  });
});

describe('isReasonRequired — the pure predicate', () => {
  it('answers false for every action while the set is empty', () => {
    expect(isReasonRequired('LOGIN')).toBe(false);
    expect(isReasonRequired('GRADE_MODIFIED')).toBe(false);
  });

  it('matches the injected policy, which is the thing the interceptor holds', () => {
    const policy = new FrozenReasonPolicy();

    expect(policy.isReasonRequired('LOGIN')).toBe(isReasonRequired('LOGIN'));
  });
});
