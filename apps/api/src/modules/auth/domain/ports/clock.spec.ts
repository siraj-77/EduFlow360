import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../../testing/fake-clock.js';
import { CLOCK, type IClock } from './clock.js';

/**
 * The clock port, and the DI token that makes it injectable.
 *
 * ## Why a spec for a file with no behaviour
 *
 * Because `clock.ts` gained a runtime export — `CLOCK` — and `AGENTS.md` 4 makes
 * coverage tiers a gate rather than a report. Adding an uncovered statement to a file
 * that had held only an interface moved the API's domain-layer tier from passing to
 * 89.08% lines, and `pnpm --filter @eduflow/api test:coverage` said so.
 *
 * The alternative was to leave the statement uncovered, which is worse: a gate that
 * has been met by deleting a tier teaches nothing, and this one has already caught a
 * real problem.
 *
 * ## What is worth asserting about a token
 *
 * That it EXISTS, and that it is DISTINCT. Distinctness is the part that matters and
 * the part nothing else would catch: two ports accidentally sharing a symbol means one
 * silently receives the other's implementation, and the failure surfaces as a type
 * error in whichever module happens to inject it second — or as no error at all.
 */
describe('the IClock port', () => {
  it('is satisfied by the fake, which is the whole reason it is an interface', () => {
    // If this stopped compiling, every test that needs a settable clock would need a
    // cast, and the casts would spread.
    const clock: IClock = new FakeClock('2026-10-03T00:00:00.000Z');

    expect(clock.now().toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });

  it('hands out a fresh Date on every call, so a caller cannot move the clock', () => {
    // Stated in the port's own contract and not currently asserted anywhere in
    // production code: `FakeClock` copies, and a fake that returned a shared instance
    // would be the worst possible place for that violation to hide.
    const clock = new FakeClock('2026-10-03T00:00:00.000Z');

    const first = clock.now();
    const second = clock.now();
    first.setFullYear(1999);

    expect(second.getTime()).not.toBe(first.getTime());
    expect(clock.now().toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });
});

describe('the CLOCK token', () => {
  it('is a symbol, because an interface has no runtime value to resolve against', () => {
    expect(typeof CLOCK).toBe('symbol');
  });

  it('is named after the port it satisfies, so a DI error names something readable', () => {
    // The string is what appears in a Nest resolution failure. An anonymous or empty
    // description turns a wiring mistake into a puzzle.
    expect(CLOCK.description).toBe('IClock');
  });

  it('is distinct from every other provider token in the auth module', async () => {
    // Imported dynamically rather than at the top so this spec does not drag the whole
    // module graph — and Prisma — into a unit suite that has no database.
    const auth = await import('../../auth.module.js');

    const tokens = [
      CLOCK,
      auth.IOIDC_PROVIDER,
      auth.IOIDC_STATE_STORE,
      auth.AUTHORIZATION_ORIGIN,
      auth.PASSWORD_HASH_PARAMETERS,
      auth.DUMMY_PASSWORD_HASH,
      auth.I_PASSWORD_HASHER,
      auth.I_PASSWORD_HASH_PARAMETER_STORE,
      auth.I_SETUP_TOKEN_REPOSITORY,
      auth.I_BOOTSTRAP_CLAIM_REPOSITORY,
      auth.I_USER_CREDENTIAL_REPOSITORY,
      auth.I_SESSION_REPOSITORY,
    ];

    expect(new Set(tokens).size, 'two DI tokens share an identity').toBe(tokens.length);
  });
});
