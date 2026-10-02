import type { IClock } from '../../modules/auth/domain/ports/clock.js';

/**
 * A fixed-window request throttle, held in this process's memory.
 *
 * ## Why in-process, and why that is the right answer HERE
 *
 * `AGENTS.md` 2.1: **one application deployment per school.** There is no load
 * balancer in front of N copies of this API, so an in-process counter sees every
 * request and no request twice. A shared store would buy nothing on this
 * topology and would add a dependency to the two routes that must work when
 * everything else is down.
 *
 * `AGENTS.md` 2.2 notes SMS and WhatsApp are per-message billed, so *those*
 * channels need shared rate limiting with digesting. This is not that: it is a
 * CPU-shaped control in front of an argon2id hash, and argon2 runs in this
 * process. Stated here because "we did rate limiting, why not Redis?" is the
 * obvious next question and the answer is the deployment topology.
 *
 * The honest limit: a restart empties the table, so the throttle is weaker across
 * a crash than across a steady state. That is acceptable — it is a brake on a
 * guess rate, not a lock, and the account lockout in `users.failed_login_attempts`
 * is the durable control behind it.
 *
 * ## Why a FIXED window and not a sliding one
 *
 * A sliding window is the better algorithm and is not used here. A fixed window
 * admits a burst of `2 * limit` across a boundary, which for a 10-attempt
 * throttle means 20. On an argon2id route that is ~0.8 seconds of extra work and
 * nothing else; the complexity of a sliding log per source is not worth that, and
 * a throttle whose correctness depends on a per-key array is a throttle that will
 * be misread later.
 *
 * ## Why windows are anchored to the epoch
 *
 * `floor(now / windowMs)`. Anchoring to the first request a key is seen would make
 * the effective window anywhere between `windowMs` and `2 * windowMs` depending on
 * when the caller arrived — a throttle whose strength the caller chooses. The
 * rows in `fixed-window-throttle.spec.ts` hold this in place.
 *
 * ## Why the key space is swept
 *
 * The key is derived from attacker-controlled input, so it is unbounded. Without
 * a sweep, one remote caller could grow this map by sending one request per
 * distinct address, which turns a security control into a memory-exhaustion
 * vector. The sweep runs when the table crosses a threshold, not on every call, so
 * the common case costs nothing.
 */

/** How many attempts, over what window. From configuration, never a constant. */
export interface ThrottlePolicy {
  readonly limit: number;
  readonly windowMs: number;
}

export type ThrottleDecision =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterMs: number };

/**
 * How many distinct keys may be held before a sweep is considered.
 *
 * 4096. Chosen because a school's whole user population is smaller than that, so
 * in normal operation the sweep never runs; and because a sweep is O(n), so a
 * lower threshold would make it run constantly under a distributed attack.
 *
 * This is also the map's CEILING: a caller may grow the table to this size and no
 * further, because reaching it triggers a sweep that discards every entry whose
 * window has closed. That bound is the memory-exhaustion property, so it is
 * exported and asserted rather than being a private detail.
 */
export const SWEEP_THRESHOLD = 4096;

interface Window {
  /** Which epoch-anchored window this counter belongs to. */
  readonly index: number;
  count: number;
}

export class FixedWindowThrottle {
  private readonly windows = new Map<string, Window>();

  /**
   * The last window a sweep ran in, so a sweep costs O(n) at most ONCE per
   * window rather than on every request.
   *
   * Added after a test measured 12.5 seconds for 40 960 requests. The first
   * version swept whenever the table was at the threshold, which — since the
   * threshold is the steady-state size — meant sweeping on every request
   * thereafter. A throttle that costs more the harder it is being attacked is a
   * throttle that turns a distributed attack into a denial of service.
   */
  private lastSweptIndex = -1;

  constructor(private readonly clock: IClock) {}

  /**
   * Count one attempt against `key`, and say whether it may proceed.
   *
   * Counting happens even when the attempt is REFUSED, so a caller that keeps
   * hammering cannot reset its own position by being told no — which is what a
   * "check, then record only on success" implementation would do.
   */
  check(key: string, policy: ThrottlePolicy): ThrottleDecision {
    if (!Number.isSafeInteger(policy.limit) || policy.limit < 1) {
      throw new Error(
        'FixedWindowThrottle: limit must be a whole number of at least 1. A limit of 0 refuses ' +
          'every request forever, which reads as an outage rather than as a throttle.',
      );
    }
    if (!Number.isSafeInteger(policy.windowMs) || policy.windowMs < 1) {
      throw new Error(
        'FixedWindowThrottle: windowMs must be a positive whole number of milliseconds. A ' +
          'fractional window cannot be floored into an epoch-anchored index.',
      );
    }

    const now = this.clock.now().getTime();
    const index = Math.floor(now / policy.windowMs);

    if (this.windows.size >= SWEEP_THRESHOLD) {
      // O(1), on every request at the cap. This is what holds the ceiling, and it
      // is cheap enough to run always.
      this.evictOldest();
      // O(n), at most once per window. This reclaims whole batches that eviction
      // alone would leave behind for the rest of the window.
      if (this.lastSweptIndex !== index) {
        this.lastSweptIndex = index;
        this.dropStale(index);
      }
    }

    const existing = this.windows.get(key);
    // A key seen in an older window starts again from zero. The entry is
    // REPLACED rather than deleted-then-set so the map never briefly holds two
    // entries for one key.
    const window: Window =
      existing === undefined || existing.index !== index ? { index, count: 0 } : existing;

    window.count += 1;
    this.windows.set(key, window);

    if (window.count > policy.limit) {
      // Milliseconds until the current window closes. At least 1, because
      // `retryAfterMs: 0` would invite an immediate retry that is certain to fail
      // and produces a `Retry-After: 0` no client can act on.
      const windowClosesAt = (index + 1) * policy.windowMs;
      return { allowed: false, retryAfterMs: Math.max(1, windowClosesAt - now) };
    }

    return { allowed: true, remaining: policy.limit - window.count };
  }

  /** Forget everything. Used at boot and by tests; a restart does this anyway. */
  reset(): void {
    this.windows.clear();
    this.lastSweptIndex = -1;
  }

  /**
   * How many keys are currently held.
   *
   * Public because the memory-exhaustion property is a security property and
   * therefore has to be observable. A private field with a test that reaches into
   * it would prove the same thing less honestly.
   */
  trackedKeys(): number {
    return this.windows.size;
  }

  /**
   * Bring the table back under the threshold. Two mechanisms, because one is not
   * enough, and a test caught the gap.
   *
   * **`evictOldest` (O(1), always).** A `Map` preserves insertion order, so
   * `keys().next()` is the oldest entry. This is what holds the CEILING, and it is
   * cheap enough to run on every request once the table is full.
   *
   * Without it, a caller sending thousands of distinct keys INSIDE one window
   * grows the table without bound: those entries are all still current, so a
   * stale-only sweep reclaims nothing until the window rolls over. Measured
   * before eviction existed: 40 960 keys held at once, from 40 960 requests.
   * A security control an attacker can grow the heap with is not a control.
   *
   * **`dropStale` (O(n), once per window).** Reclaims in batches, so a table that
   * filled up and then went quiet empties itself rather than sitting at the cap
   * until eviction trickles it down one entry per request.
   *
   * ## What eviction costs, stated rather than hidden
   *
   * An evicted key loses its counter, so a caller who rotates identifiers can
   * spend more than `limit` attempts. That is a real weakening and it is
   * unavoidable while the key is something the caller chooses — which it is,
   * because this route is unauthenticated and there is nothing else to key on.
   *
   * What it does not weaken is the durable control: `users.failed_login_attempts`
   * and `locked_until` live in the database, survive a restart, and are keyed on
   * the ACCOUNT rather than on a source. This throttle is a brake on a guess
   * rate; the lockout is the lock.
   */
  private evictOldest(): void {
    const oldest = this.windows.keys().next();
    if (oldest.done === true) return;
    this.windows.delete(oldest.value);
  }

  /** Drop every entry whose window has already closed. */
  private dropStale(currentIndex: number): void {
    for (const [key, window] of this.windows) {
      if (window.index < currentIndex) this.windows.delete(key);
    }
  }
}
