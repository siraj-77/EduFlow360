import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../testing/fake-clock.js';
import { instant } from '../../testing/instant.js';
import { FixedWindowThrottle, SWEEP_THRESHOLD } from './fixed-window-throttle.js';

/**
 * The in-process throttle on the two credential routes.
 *
 * ## Why this is a unit spec and not covered only over HTTP
 *
 * Because window boundaries are the whole behaviour, and a socket test cannot
 * place time exactly on one. `FakeClock` can, and the rows below put a request
 * one millisecond either side of the boundary.
 *
 * The end-to-end proof that a 429 actually reaches a caller is in
 * `setup-complete-over-http.integration.spec.ts` and
 * `login-over-http.integration.spec.ts`.
 */

const AT = instant('2026-10-03T10:00:00.000Z');
const FIVE_MINUTES = 300_000;

describe('counting within one window', () => {
  it('allows exactly `limit` requests and refuses the one after', () => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));
    const policy = { limit: 3, windowMs: FIVE_MINUTES };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(throttle.check('10.0.0.1', policy).allowed, `attempt ${attempt}`).toBe(true);
    }
    expect(throttle.check('10.0.0.1', policy).allowed).toBe(false);
  });

  it('counts keys separately, so one source cannot exhaust another', () => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));
    const policy = { limit: 1, windowMs: FIVE_MINUTES };

    expect(throttle.check('10.0.0.1', policy).allowed).toBe(true);
    expect(throttle.check('10.0.0.2', policy).allowed).toBe(true);
    expect(throttle.check('10.0.0.1', policy).allowed).toBe(false);
  });

  it('tells the caller how many are left, so a UI need not guess', () => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));
    const policy = { limit: 3, windowMs: FIVE_MINUTES };

    expect(throttle.check('10.0.0.1', policy)).toEqual({ allowed: true, remaining: 2 });
    throttle.check('10.0.0.1', policy);
    expect(throttle.check('10.0.0.1', policy)).toEqual({ allowed: true, remaining: 0 });
  });

  it('says how long to wait, so the response can carry Retry-After', () => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));
    const policy = { limit: 1, windowMs: FIVE_MINUTES };
    throttle.check('10.0.0.1', policy);

    expect(throttle.check('10.0.0.1', policy)).toEqual({
      allowed: false,
      retryAfterMs: FIVE_MINUTES,
    });
  });
});

describe('the window boundary', () => {
  it('still refuses one millisecond before the window ends', () => {
    const clock = new FakeClock(AT);
    const throttle = new FixedWindowThrottle(clock);
    const policy = { limit: 1, windowMs: FIVE_MINUTES };
    throttle.check('10.0.0.1', policy);

    clock.advance(FIVE_MINUTES - 1);

    expect(throttle.check('10.0.0.1', policy).allowed).toBe(false);
  });

  it('allows again the moment a new window opens', () => {
    const clock = new FakeClock(AT);
    const throttle = new FixedWindowThrottle(clock);
    const policy = { limit: 1, windowMs: FIVE_MINUTES };
    throttle.check('10.0.0.1', policy);

    clock.advance(FIVE_MINUTES);

    expect(throttle.check('10.0.0.1', policy).allowed).toBe(true);
  });

  it('anchors windows to the epoch, not to the first request seen', () => {
    // Anchoring to first-seen would make the effective window anywhere between
    // `windowMs` and `2 * windowMs` depending on when the attacker happened to
    // arrive, which is a throttle whose strength an attacker chooses.
    const clock = new FakeClock(AT);
    const throttle = new FixedWindowThrottle(clock);
    const policy = { limit: 1, windowMs: FIVE_MINUTES };

    expect(throttle.check('10.0.0.1', policy).allowed).toBe(true);
    clock.advance(FIVE_MINUTES + 1);
    expect(throttle.check('10.0.0.1', policy).allowed).toBe(true);
  });
});

describe('a policy that is not usable', () => {
  it('refuses a limit below one, rather than locking every caller out', () => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));

    // Throwing rather than defaulting: a limit of zero would make the route
    // answer 429 forever, which reads as an outage and is indistinguishable from
    // a misconfiguration. `env.ts` already refuses it at boot; this is the second
    // lock on the same door.
    expect(() => throttle.check('10.0.0.1', { limit: 0, windowMs: FIVE_MINUTES })).toThrow(
      /limit/i,
    );
  });

  it.each([0, -1, 1.5])('refuses a window of %s ms', (windowMs) => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));

    expect(() => throttle.check('10.0.0.1', { limit: 5, windowMs })).toThrow(/windowMs/i);
  });
});

describe('not growing without bound', () => {
  it('holds at most SWEEP_THRESHOLD keys however many distinct sources arrive', () => {
    const clock = new FakeClock(AT);
    const throttle = new FixedWindowThrottle(clock);
    const policy = { limit: 1, windowMs: FIVE_MINUTES };

    // The property under test: the key is derived from attacker-controlled input,
    // so the key space is unbounded and the map has to shed entries itself.
    // Without a sweep, a remote caller grows the heap with one request per
    // distinct address, which turns a security control into a memory-exhaustion
    // vector.
    //
    // Ten times the threshold, all inside ONE window, so nothing is eligible for
    // the sweep to discard. What is under test is the CEILING; the next row tests
    // that the sweep actually reclaims.
    for (let index = 0; index < SWEEP_THRESHOLD * 10; index += 1) {
      throttle.check(`10.0.0.${index}`, policy);
    }

    // Exactly the threshold. The sweep runs before the new key is inserted, and
    // nothing is stale inside one window, so eviction is what holds the line.
    expect(throttle.trackedKeys()).toBe(SWEEP_THRESHOLD);
  });

  it('discards expired windows when it does sweep', () => {
    const clock = new FakeClock(AT);
    const throttle = new FixedWindowThrottle(clock);
    const policy = { limit: 1, windowMs: FIVE_MINUTES };
    for (let index = 0; index < SWEEP_THRESHOLD; index += 1) {
      throttle.check(`10.0.0.${index}`, policy);
    }
    expect(throttle.trackedKeys()).toBe(SWEEP_THRESHOLD);

    // Three windows later every one of those entries is stale, so the next
    // request sweeps them away and the table ends up holding only itself.
    clock.advance(FIVE_MINUTES * 3);
    throttle.check('10.9.9.9', policy);

    expect(throttle.trackedKeys()).toBe(1);
  });

  it('reset clears everything, so a restart is not the only way to recover', () => {
    const throttle = new FixedWindowThrottle(new FakeClock(AT));
    const policy = { limit: 1, windowMs: FIVE_MINUTES };
    throttle.check('10.0.0.1', policy);
    expect(throttle.check('10.0.0.1', policy).allowed).toBe(false);

    throttle.reset();

    expect(throttle.check('10.0.0.1', policy).allowed).toBe(true);
  });
});
