import { describe, expect, it } from 'vitest';
import { type IClock } from '../modules/auth/domain/ports/clock.js';
import { FakeClock } from './fake-clock.js';

/**
 * The fake is the half of `IClock` that carries the contract, so it is the
 * half worth testing.
 *
 * The port itself is a type: it has no behaviour to assert. Its proof is
 * that a use-case compiles against it and that this fake satisfies it — the
 * typed assignment below is that proof, and `pnpm typecheck` is the gate.
 *
 * The property that actually matters downstream is that `now()` returns a
 * **copy**. A clock that hands back its own instance can be moved by any
 * caller who mutates what it received, and the next reader silently gets the
 * wrong time — which, in an expiry check, is a session that outlives its TTL.
 */
describe('IClock, through its fake', () => {
  it('satisfies the port', () => {
    // A compile-time assertion. If IClock gains a method, this fails to
    // typecheck, which is exactly the moment the double should be updated.
    const clock: IClock = new FakeClock('2026-10-02T09:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });

  it('returns the instant it was constructed with', () => {
    expect(new FakeClock(new Date('2026-10-02T09:00:00.000Z')).now().toISOString()).toBe(
      '2026-10-02T09:00:00.000Z',
    );
  });

  it('hands back a copy, so a caller cannot move the clock by mutating it', () => {
    const clock = new FakeClock('2026-10-02T09:00:00.000Z');
    const stolen = clock.now();
    stolen.setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });

  it('returns a distinct object on every call', () => {
    const clock = new FakeClock('2026-10-02T09:00:00.000Z');
    expect(clock.now()).not.toBe(clock.now());
  });

  it('advances forward by a millisecond count, deterministically', () => {
    const clock = new FakeClock('2026-10-02T09:00:00.000Z');
    clock.advance(15 * 60 * 1000);
    expect(clock.now().toISOString()).toBe('2026-10-02T09:15:00.000Z');
  });

  it('advances backwards, because expiry tests cross the boundary in both directions', () => {
    const clock = new FakeClock('2026-10-02T09:00:00.000Z');
    clock.advance(-60 * 1000);
    expect(clock.now().toISOString()).toBe('2026-10-02T08:59:00.000Z');
  });

  it('jumps to an absolute instant, so a test can state its starting time', () => {
    const clock = new FakeClock('2020-01-01T00:00:00.000Z');
    clock.set('2026-10-02T09:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });

  it('does not alias a Date handed to its constructor', () => {
    const original = new Date('2026-10-02T09:00:00.000Z');
    const clock = new FakeClock(original);
    original.setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });
});
