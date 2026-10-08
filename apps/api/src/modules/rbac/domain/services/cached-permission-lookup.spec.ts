import { describe, expect, it, vi } from 'vitest';
import {
  resolvePermissionWithCache,
  type CacheOutcome,
  type PermissionCacheFacts,
} from './cached-permission-lookup.js';

/**
 * The cache lookup, as a rule — `PLT-202` acceptance criterion 2.
 *
 * > "Permission checks add negligible latency (<5ms) — cache role→permission resolution in
 * > Redis with invalidation on role change."
 *
 * ## The one property this file exists to guarantee
 *
 * **The cache can change how long an answer takes. It can never change what the answer is.**
 *
 * That is the whole security requirement of putting a cache in front of an authorization
 * decision, and it is worth spelling out as a table because every row is a way it breaks:
 *
 * | situation | correct answer | the bug this prevents |
 * |---|---|---|
 * | cache hit | the cached boolean | trusting a value belonging to another user or key |
 * | cache miss | ask the database | reading "not cached" as "not granted" |
 * | cache throws | ask the database | turning a Redis outage into an authorization denial |
 * | write-back throws | the database's answer | failing a request because a cache is full |
 * | no cache at all | ask the database | requiring Redis in order to boot |
 *
 * Row 3 is the one people get wrong. The intuitive design — "we cannot evaluate this
 * request" — refuses, and refuses *safely*, but it makes a performance dependency into an
 * availability dependency: Redis going down takes authorization down with it. `REDIS_URL` is
 * optional in `env.ts` precisely because Redis has no official Windows build, so the
 * database fallback is not an optimisation. **It is the default.**
 */

const USER = 'user-1';
const KEY = 'FINANCE_INVOICE_REVERSE';

function facts(overrides: {
  readonly cache?: PermissionCacheFacts['cache'];
  readonly isGranted?: () => Promise<boolean>;
}): PermissionCacheFacts {
  return {
    userId: USER,
    permissionKey: KEY,
    cache: overrides.cache,
    isGranted: overrides.isGranted ?? (() => Promise.resolve(true)),
  };
}

/**
 * The boolean the rule resolved, unwrapped from the outcome envelope.
 *
 * The rule returns `{ granted, outcome }` rather than a bare boolean on purpose: the guard
 * needs the answer, and an operator needs to know whether it came from the cache or the
 * database. Most tests here are about the ANSWER, so they read the answer through this
 * helper and the outcome tests at the bottom read the envelope directly.
 */
async function granted(facts: PermissionCacheFacts): Promise<boolean> {
  return (await resolvePermissionWithCache(facts)).granted;
}

/** A cache that always misses, for the tests that only care about the read path. */
function missingCache() {
  return { read: vi.fn(() => Promise.resolve(undefined)), write: vi.fn(), invalidateUser: vi.fn() };
}

describe('resolvePermissionWithCache', () => {
  describe("the answer is never the cache's to change", () => {
    it('asks the DATABASE on a miss, and returns what it said', async () => {
      // The miss case matters most: "not in the cache" must never be read as "not granted",
      // because that would deny every permission the first time it was requested after a
      // deploy.
      const isGranted = vi.fn(() => Promise.resolve(true));
      const cache = missingCache();

      expect(await granted(facts({ cache, isGranted }))).toBe(true);
      expect(isGranted).toHaveBeenCalledOnce();
    });

    it('asks the DATABASE and honours a FALSE grant — no caching of a denial', async () => {
      const isGranted = vi.fn(() => Promise.resolve(false));
      const cache = missingCache();

      expect(await granted(facts({ cache, isGranted }))).toBe(false);
      // Denials are deliberately NOT cached. A stale "false" after a role grant locks a
      // real user out of something they are entitled to, and the report is always the same:
      // "I was added to the role and it did not work".
      expect(cache.write).not.toHaveBeenCalled();
    });

    it('returns the CACHE on a hit and never touches the database', async () => {
      // The <5ms criterion. One round trip, and the Prisma pool is not consulted at all.
      const isGranted = vi.fn(() => Promise.resolve(false));
      const cache = {
        read: vi.fn(() => Promise.resolve(true)),
        write: vi.fn(),
        invalidateUser: vi.fn(),
      };

      expect(await granted(facts({ cache, isGranted }))).toBe(true);
      expect(isGranted).not.toHaveBeenCalled();
      expect(cache.write).not.toHaveBeenCalled();
    });

    it('propagates a DATABASE failure — an outage is not a permission decision', async () => {
      // Mirrors `decidePermissionAccess` and `decideOwnershipAccess`: both deliberately
      // refuse to catch, so an outage surfaces as a 500 rather than a 403 that reads like
      // policy and sends an operator to a role table.
      await expect(
        granted(
          facts({
            cache: missingCache(),
            isGranted: () => Promise.reject(new Error('pool exhausted')),
          }),
        ),
      ).rejects.toThrow('pool exhausted');
    });
  });

  describe('cache failure degrades latency, never authorization', () => {
    it('falls back to the DATABASE when the read throws', async () => {
      const isGranted = vi.fn(() => Promise.resolve(true));
      const cache = {
        read: vi.fn(() => Promise.reject(new Error('ECONNREFUSED 6379'))),
        write: vi.fn(),
        invalidateUser: vi.fn(),
      };

      expect(await granted(facts({ cache, isGranted }))).toBe(true);
      expect(isGranted).toHaveBeenCalledOnce();
    });

    it('returns the DATABASE answer even when the WRITE-BACK throws', async () => {
      const isGranted = vi.fn(() => Promise.resolve(true));
      const cache = {
        read: vi.fn(() => Promise.resolve(undefined)),
        write: vi.fn(() => Promise.reject(new Error('OOM command not allowed'))),
        invalidateUser: vi.fn(),
      };

      expect(await granted(facts({ cache, isGranted }))).toBe(true);
    });

    it('never lets a cache failure reach the caller as an error', async () => {
      // The blanket property, asserted once so a future edit cannot quietly reintroduce a
      // throw path.
      const cache = {
        read: vi.fn(() => Promise.reject(new Error('down'))),
        write: vi.fn(() => Promise.reject(new Error('down'))),
        invalidateUser: vi.fn(() => Promise.reject(new Error('down'))),
      };

      await expect(granted(facts({ cache, isGranted: () => Promise.resolve(true) }))).resolves.toBe(
        true,
      );
    });

    it('does not attempt a write-back after a degraded read', async () => {
      // The store was unreachable a moment ago; writing to it immediately is a second
      // round trip to a host that just refused us. The next request will try again.
      const cache = {
        read: vi.fn(() => Promise.reject(new Error('down'))),
        write: vi.fn(),
        invalidateUser: vi.fn(),
      };

      await granted(facts({ cache, isGranted: () => Promise.resolve(true) }));

      expect(cache.write).not.toHaveBeenCalled();
    });
  });

  describe('no cache at all is the normal deployment', () => {
    it('works with `cache` absent, which is every school with no REDIS_URL', async () => {
      const isGranted = vi.fn(() => Promise.resolve(true));

      expect(await granted(facts({ isGranted }))).toBe(true);
      expect(isGranted).toHaveBeenCalledOnce();
    });

    it('reads the DATABASE on every call when there is no cache', async () => {
      const isGranted = vi.fn(() => Promise.resolve(true));
      const subject = facts({ isGranted });

      await granted(subject);
      await granted(subject);

      // No memoisation anywhere in this repository outside a cache. A process-local Map
      // would be a third source of truth with no invalidation path at all.
      expect(isGranted).toHaveBeenCalledTimes(2);
    });
  });

  describe('it only ever accepts a real boolean from the cache', () => {
    it.each([
      ['a string', 'true'],
      ['a number', 1],
      ['an object', { granted: true }],
      ['null', null],
      ['an empty string', ''],
    ])('treats %s as a MISS, not as a grant', async (_label, bogus) => {
      // A cache is an external store. A value it returns that is not exactly `true` must
      // not open a route — the same rule `decidePermissionAccess` applies to a grant
      // reader answering anything but boolean `true`.
      const isGranted = vi.fn(() => Promise.resolve(true));
      const cache = {
        read: vi.fn(() => Promise.resolve(bogus)),
        write: vi.fn(),
        invalidateUser: vi.fn(),
      };

      expect(await granted(facts({ cache, isGranted }))).toBe(true);
      expect(isGranted).toHaveBeenCalledOnce();
    });

    it('honours an exact boolean false from the cache', async () => {
      // `false` is a real answer and is served without a database round trip. Nothing
      // writes one today — denials are not cached — but the port permits it and a
      // deployment may seed the cache itself.
      const isGranted = vi.fn(() => Promise.resolve(true));
      const cache = {
        read: vi.fn(() => Promise.resolve(false)),
        write: vi.fn(),
        invalidateUser: vi.fn(),
      };

      expect(await granted(facts({ cache, isGranted }))).toBe(false);
      expect(isGranted).not.toHaveBeenCalled();
    });
  });

  describe('the outcome, for the operator log', () => {
    it('reports HIT, MISS or BYPASS so a slow route can be explained', async () => {
      const hit = await resolvePermissionWithCache(
        facts({
          cache: {
            read: vi.fn(() => Promise.resolve(true)),
            write: vi.fn(),
            invalidateUser: vi.fn(),
          },
        }),
      );
      const miss = await resolvePermissionWithCache(facts({ cache: missingCache() }));
      const bypass = await resolvePermissionWithCache(facts({}));

      expect([hit.outcome, miss.outcome, bypass.outcome]).toEqual(['HIT', 'MISS', 'BYPASS']);
      expect([hit.granted, miss.granted, bypass.granted]).toEqual([true, true, true]);
    });

    it('reports DEGRADED when the cache failed, so an outage is visible', async () => {
      // Otherwise a Redis outage is invisible: every request still succeeds, at database
      // latency, and nobody connects the two.
      const cache = {
        read: vi.fn(() => Promise.reject(new Error('down'))),
        write: vi.fn(),
        invalidateUser: vi.fn(),
      };

      const outcome = await resolvePermissionWithCache(facts({ cache }));

      expect(outcome.outcome satisfies CacheOutcome).toBe('DEGRADED');
      expect(outcome.granted).toBe(true);
    });
  });
});
