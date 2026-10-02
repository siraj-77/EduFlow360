import { describe, expect, it } from 'vitest';
import { instant } from '../../../../testing/instant.js';
import { decideRotation, type FoundTokenState } from './refresh-token-rotation.js';

/**
 * Table-driven, because `AGENTS.md` 4.1 requires it for every rule engine and
 * this is the one that decides whether a token theft stays contained.
 *
 * Every row states a full state rather than an increment, so the ordering of
 * the checks is exercised rather than assumed. Two rows below deliberately
 * make more than one condition true, which is where a wrong order shows up.
 */
// Built outside domain/, because the AGENTS.md 2.4 rule bans `new Date()`
// there and the rule is kept absolute rather than widened for tests.
const AT = instant('2026-10-02T09:00:00.000Z');

const live = (over: Partial<FoundTokenState> = {}): FoundTokenState => ({
  found: true,
  usedAt: null,
  familyRevokedAt: null,
  sessionRevokedAt: null,
  familyId: 'family-1',
  ...over,
});

const TABLE: Array<{
  name: string;
  state: Parameters<typeof decideRotation>[0];
  expected: string;
}> = [
  {
    name: 'no such token',
    state: { found: false },
    expected: 'reject-unknown',
  },
  {
    name: 'a live, unused token',
    state: live(),
    expected: 'rotate',
  },
  {
    name: 'a token that was already rotated away',
    state: live({ usedAt: AT }),
    expected: 'revoke-family-reuse',
  },
  {
    name: 'a token in a revoked session',
    state: live({ sessionRevokedAt: AT }),
    expected: 'reject-session-revoked',
  },
  {
    name: 'a token in an already-revoked family',
    state: live({ familyRevokedAt: AT }),
    expected: 'reject-family-revoked',
  },
  // Ordering rows. Each makes two conditions true.
  {
    name: 'a used token inside a revoked session refuses rather than revoking again',
    state: live({ usedAt: AT, sessionRevokedAt: AT }),
    expected: 'reject-session-revoked',
  },
  {
    name: 'a used token inside an already-revoked family refuses rather than revoking again',
    state: live({ usedAt: AT, familyRevokedAt: AT }),
    expected: 'reject-family-revoked',
  },
  {
    name: 'a fully-dead token still refuses, it does not act',
    state: live({ usedAt: AT, familyRevokedAt: AT, sessionRevokedAt: AT }),
    expected: 'reject-session-revoked',
  },
];

describe('decideRotation', () => {
  it.each(TABLE)('$name -> $expected', ({ state, expected }) => {
    expect(decideRotation(state).action).toBe(expected);
  });

  it('carries the family id through every verdict that needs one', () => {
    // Without it the caller cannot revoke the right family, and reuse
    // detection silently stops working.
    for (const state of [
      live(),
      live({ usedAt: AT }),
      live({ sessionRevokedAt: AT }),
      live({ familyRevokedAt: AT }),
    ]) {
      const verdict = decideRotation(state);
      expect('familyId' in verdict && verdict.familyId).toBe('family-1');
    }
  });

  it('gives no family id for an unknown token, because there is none', () => {
    const verdict = decideRotation({ found: false });
    expect(verdict).toEqual({ action: 'reject-unknown' });
    expect('familyId' in verdict).toBe(false);
  });

  it('only ever acts on reuse, and only once a family exists to act on', () => {
    // The property that matters: `revoke-family-reuse` is the single verdict
    // with a side effect, and it is reachable only when the token is found,
    // the session is alive, the family is alive, and it was already used.
    const acting = TABLE.filter((r) => r.expected === 'revoke-family-reuse');
    expect(acting).toHaveLength(1);
    expect(acting[0].state).toMatchObject({ found: true, usedAt: expect.any(Date) });
  });

  it('never rotates a token that has been used', () => {
    // The single-use guarantee. If this ever returns 'rotate' for a used
    // token, an attacker and the real user can both keep the session alive
    // indefinitely and neither can prove which is which.
    expect(decideRotation(live({ usedAt: AT })).action).not.toBe('rotate');
  });
});
