import { describe, expect, it } from 'vitest';
import { SystemClock } from './system-clock.js';

/**
 * The one place the API is allowed to read ambient time.
 *
 * Trivial in isolation, so the tests are about the promise the port makes
 * rather than about `Date`. The two properties that matter downstream are:
 * it moves forward, and it hands back a fresh object every call.
 */
describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const actual = new SystemClock().now().getTime();
    const after = Date.now();

    expect(actual).toBeGreaterThanOrEqual(before);
    expect(actual).toBeLessThanOrEqual(after);
  });

  it('hands back a distinct object each call', () => {
    // If it cached and returned one instance, a caller could move the clock for
    // everyone. This is the contract the port states in prose; this asserts it.
    const clock = new SystemClock();
    expect(clock.now()).not.toBe(clock.now());
  });

  it('does not let a caller mutate the clock by mutating what it returned', () => {
    const clock = new SystemClock();
    const stolen = clock.now();
    const real = clock.now().getTime();

    stolen.setUTCFullYear(1970);

    expect(clock.now().getTime()).toBeGreaterThan(real - 60_000);
  });

  it('advances, which is what makes expiry observable', () => {
    const clock = new SystemClock();
    const first = clock.now().getTime();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(clock.now().getTime()).toBeGreaterThanOrEqual(first);
        resolve();
      }, 5);
    });
  });
});
