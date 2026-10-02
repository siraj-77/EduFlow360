import { describe, expect, it } from 'vitest';
import { instant, instantAfter } from '../../../../testing/instant.js';
import {
  decideSetupToken,
  type PresentedSetupToken,
  type SetupTokenDeploymentState,
} from './setup-token.js';

/**
 * Table-driven, because `AGENTS.md` 4.1 requires it for every rule engine and
 * this is the one that decides whether an unauthenticated caller gets to become
 * the school's administrator.
 *
 * Two groups of rows here are the acceptance criteria of `PLT-107`:
 *
 *   - the boundary rows at `expiresAt === now` and `expiresAt === now + 1ms`,
 *     because an off-by-one on expiry is the difference between a token that
 *     lives one millisecond too long and one that dies a millisecond early;
 *   - the "expired and forged are indistinguishable" test, which is why the
 *     deployment state is a three-way enum rather than a boolean.
 */
const AT = instant('2026-10-02T09:00:00.000Z');
const USER_ID = 'user-under-test';

/**
 * Built outside `domain/`, because the `AGENTS.md` 2.4 rule bans `new Date()`
 * there and the rule is kept absolute rather than widened for tests.
 */
const shifted = (ms: number): Date => instantAfter(ms, AT);

const matching = (
  expiresAt: Date | null,
  deployment: SetupTokenDeploymentState = 'token-issued',
): PresentedSetupToken => ({ match: { userId: USER_ID, expiresAt }, deployment });

const unrecognised = (deployment: SetupTokenDeploymentState): PresentedSetupToken => ({
  match: null,
  deployment,
});

const TABLE: Array<{
  name: string;
  presented: PresentedSetupToken;
  expected: string;
}> = [
  {
    name: 'a live token with an hour left',
    presented: matching(shifted(3_600_000)),
    expected: 'accept',
  },
  {
    name: 'a token expiring one millisecond from now',
    presented: matching(shifted(1)),
    expected: 'accept',
  },
  {
    name: 'a token expiring exactly at now',
    presented: matching(AT),
    // `expiresAt > now` is the rule, so the boundary instant is already gone.
    // An inclusive comparison here would keep a token alive at the exact
    // millisecond it was due to die.
    expected: 'reject-invalid',
  },
  {
    name: 'a token that expired a millisecond ago',
    presented: matching(shifted(-1)),
    expected: 'reject-invalid',
  },
  {
    name: 'a token that expired last week',
    presented: matching(shifted(-604_800_000)),
    expected: 'reject-invalid',
  },
  {
    name: 'a token with a hash but no expiry',
    presented: matching(null),
    // Fail closed. A row carrying a hash and no window is a malformed row, and
    // the safe reading of a malformed credential is that it is not valid.
    expected: 'reject-invalid',
  },
  {
    name: 'an expired token on a deployment whose bootstrap is already claimed',
    presented: matching(shifted(-1), 'bootstrap-claimed'),
    // The deployment state must not leak into the expired case. If a replayed
    // expired token could be told apart from a live one by the deployment being
    // finished, the route would report which state the installation is in.
    expected: 'reject-invalid',
  },
  {
    name: 'a forged token while a token is issued',
    presented: unrecognised('token-issued'),
    expected: 'reject-invalid',
  },
  {
    name: 'a token on a deployment where nothing was ever issued',
    presented: unrecognised('no-token-issued'),
    // The story's unenrolled-deployment rule: 404, so a deployment that has
    // never been enrolled does not advertise that the endpoint exists.
    expected: 'reject-unclaimed',
  },
  {
    name: 'any token once the bootstrap has been claimed',
    presented: unrecognised('bootstrap-claimed'),
    // A replay, or the loser of a concurrent claim. 409 — too late, not wrong.
    expected: 'reject-consumed',
  },
];

describe('decideSetupToken — what a presented setup token gets', () => {
  it.each(TABLE)('$name → $expected', ({ presented, expected }) => {
    expect(decideSetupToken(presented, AT).action).toBe(expected);
  });

  it('names the user the accepted token belongs to, and nobody else', () => {
    // Only the accept branch may carry a userId. If a rejection ever leaked one,
    // the route would confirm which account a token targets.
    expect(decideSetupToken(matching(shifted(1)), AT)).toEqual({
      action: 'accept',
      userId: USER_ID,
    });

    for (const rejection of [
      decideSetupToken(matching(shifted(-1)), AT),
      decideSetupToken(unrecognised('token-issued'), AT),
      decideSetupToken(unrecognised('no-token-issued'), AT),
      decideSetupToken(unrecognised('bootstrap-claimed'), AT),
    ]) {
      expect(rejection, 'a rejection must not name a user').not.toHaveProperty('userId');
    }
  });

  it('makes an expired token indistinguishable from a forged one', () => {
    // THE acceptance criterion. Both are `reject-invalid`, and neither verdict
    // carries anything that says whether the presented token had ever been
    // issued: no user, no expiry, no flag. A caller that rendered these two
    // differently would turn the setup route into an oracle for guessing which
    // tokens exist.
    const expired = decideSetupToken(matching(shifted(-1)), AT);
    const forged = decideSetupToken(unrecognised('token-issued'), AT);

    expect(expired).toEqual(forged);
    expect(Object.keys(expired).sort()).toEqual(['action']);
  });

  it('does not let the decision depend on anything but the two arguments', () => {
    // Purity is what makes the table above exhaustive. If this ever starts
    // reading ambient state, the deterministic-expiry argument in
    // `AGENTS.md` 2.4 stops holding and the boundaries above become timing
    // dependent.
    const presented = matching(shifted(1));
    expect(decideSetupToken(presented, AT)).toEqual(decideSetupToken(presented, AT));
  });

  it('reads the boundary from the instant it is given, not from the clock', () => {
    const presented = matching(AT);
    expect(decideSetupToken(presented, shifted(-1)).action).toBe('accept');
    expect(decideSetupToken(presented, AT).action).toBe('reject-invalid');
    expect(decideSetupToken(presented, shifted(1)).action).toBe('reject-invalid');
  });
});
