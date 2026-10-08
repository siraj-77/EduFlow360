import { describe, expect, it } from 'vitest';
import { RedisPermissionCache, type RedisLike } from './redis-permission-cache.js';

/**
 * `RedisPermissionCache` — `PLT-202` acceptance criterion 2.
 *
 * ## What is real here and what is doubled
 *
 * The command shapes are real: the key layout, the `PX` expiry, the index set, and the
 * multi-key delete on invalidation are exactly what goes over the wire. What is doubled is
 * the **client**, through the narrow `RedisLike` structural interface — so this suite
 * asserts "these commands, with these arguments" rather than asserting that a mock was
 * called.
 *
 * That distinction matters, because the two bugs this adapter is most likely to have are a
 * key that does not include the school, and an invalidation that forgets its own index.
 * Both are invisible to a test that only checks `mock.calledWith(true)`.
 *
 * ## Why there is a `RedisLike` interface and no `ioredis` import
 *
 * `AGENTS.md` 3.1 lists Redis + BullMQ for cache/queue, and the **first** real consumer of
 * Redis in this system is a queue, not this cache — so `ioredis` arrives with that story.
 * Until then this adapter is written against the five commands it actually uses, which
 * makes it complete and testable today. The moment `ioredis` lands, the factory passes it
 * in as a constructor argument: `ioredis` satisfies `RedisLike` structurally, so no line
 * of this file changes.
 */

const SCHOOL = 'school-a';
const USER = 'user-1';
const TTL_MS = 60_000;

/** The grant marker. One string, written and matched, so read and write cannot disagree. */
const MARKER = '1';

interface Recorded {
  readonly calls: ReadonlyArray<readonly [string, ...unknown[]]>;
}

/** A client that records commands and replays canned replies. */
function fakeRedis(replies: Record<string, unknown> = {}): RedisLike & Recorded {
  const calls: Array<readonly [string, ...unknown[]]> = [];

  const record =
    (name: string) =>
    (...args: unknown[]): Promise<unknown> => {
      calls.push([name, ...args] as const);
      return Promise.resolve(replies[name]);
    };

  return {
    calls,
    get: record('get'),
    set: record('set'),
    sadd: record('sadd'),
    smembers: record('smembers'),
    del: record('del'),
  } as never;
}

/** The key the cache used for a given command, or `undefined` if it never ran. */
function keyUsedBy(redis: RedisLike & Recorded, command: string): string | undefined {
  const call = redis.calls.find(([name]) => name === command);
  const key = call?.[1];
  return typeof key === 'string' ? key : undefined;
}

describe('RedisPermissionCache', () => {
  describe('key layout — the part a mock-based test usually skips', () => {
    it('namespaces the entry by school AND user AND permission key', async () => {
      // Single-tenant means one database per school, but Redis is a separate service an
      // operator may point several deployments at. Two schools sharing a Redis must not read
      // each other's entries, and this key is the only thing preventing it.
      const redis = fakeRedis({ get: MARKER });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).read({
        userId: USER,
        permissionKey: 'FINANCE_INVOICE_REVERSE',
      });

      const key = keyUsedBy(redis, 'get') ?? '';
      expect(key).toContain(SCHOOL);
      expect(key).toContain(USER);
      expect(key).toContain('FINANCE_INVOICE_REVERSE');
    });

    it('gives two schools different keys for the same user and permission', async () => {
      const a = fakeRedis({ get: MARKER });
      const b = fakeRedis({ get: MARKER });

      await new RedisPermissionCache(a, 'school-a', TTL_MS).read({
        userId: USER,
        permissionKey: 'X',
      });
      await new RedisPermissionCache(b, 'school-b', TTL_MS).read({
        userId: USER,
        permissionKey: 'X',
      });

      expect(keyUsedBy(a, 'get')).not.toBe(keyUsedBy(b, 'get'));
    });

    it('gives two users different keys for the same permission', async () => {
      const redis = fakeRedis({ get: MARKER });
      const cache = new RedisPermissionCache(redis, SCHOOL, TTL_MS);

      await cache.read({ userId: 'user-1', permissionKey: 'X' });
      await cache.read({ userId: 'user-2', permissionKey: 'X' });

      expect(keyUsedBy(redis, 'get')).toBeDefined();
      const keys = redis.calls.filter(([name]) => name === 'get').map(([, key]) => key);
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('gives two permission keys different keys for the same user', async () => {
      const redis = fakeRedis({ get: MARKER });
      const cache = new RedisPermissionCache(redis, SCHOOL, TTL_MS);

      await cache.read({ userId: USER, permissionKey: 'GRADE_ENTER' });
      await cache.read({ userId: USER, permissionKey: 'GRADE_DELETE' });

      const keys = redis.calls.filter(([name]) => name === 'get').map(([, key]) => key);
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('includes a version segment, so a future key change cannot read old entries', async () => {
      // `v1` is not decoration. Without it, changing the cached *meaning* of a key would
      // silently serve entries written under the old meaning until their TTL expired.
      const redis = fakeRedis({ get: MARKER });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).read({
        userId: USER,
        permissionKey: 'X',
      });

      expect(keyUsedBy(redis, 'get')).toContain('v1');
    });

    it('prefixes every key with the application name, so a shared Redis is shareable', async () => {
      const redis = fakeRedis({ get: MARKER });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).read({
        userId: USER,
        permissionKey: 'X',
      });

      expect(keyUsedBy(redis, 'get')).toMatch(/^eduflow:/);
    });
  });

  describe('read', () => {
    it('returns true for the marker it writes', async () => {
      const cache = new RedisPermissionCache(fakeRedis({ get: MARKER }), SCHOOL, TTL_MS);

      expect(await cache.read({ userId: USER, permissionKey: 'X' })).toBe(true);
    });

    it.each([
      ['null, which is how Redis answers a missing key', null],
      ['an empty string', ''],
      ['a plausible but wrong marker', 'yes'],
      ['a JSON blob left by something else', '{"granted":true}'],
      ['a number', 1],
      ['the literal word true', 'true'],
    ])('returns undefined for %s — never a truthy value', async (_label, reply) => {
      // A corrupt entry must read as a MISS, not as a grant. Anything that is not exactly
      // the marker means "we do not know", and "we do not know" means ask the database.
      const cache = new RedisPermissionCache(fakeRedis({ get: reply }), SCHOOL, TTL_MS);

      expect(await cache.read({ userId: USER, permissionKey: 'X' })).toBeUndefined();
    });

    it('reads exactly one key — no SCAN, no KEYS, on the hot path', async () => {
      // `KEYS`/`SCAN` on a shared Redis is O(N) and blocks the server. The read path must be
      // a single GET or the <5ms criterion is unreachable under load.
      const redis = fakeRedis({ get: MARKER });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).read({
        userId: USER,
        permissionKey: 'X',
      });

      expect(redis.calls.map(([name]) => name)).toEqual(['get']);
    });
  });

  describe('write', () => {
    it('stores the marker with a PX expiry, in that argument order', async () => {
      // The exact call is asserted because argument order is where an ioredis adapter goes
      // wrong silently: `set(key, 'PX', ttl, value)` writes the literal string "PX" as the
      // value and sets no expiry.
      const redis = fakeRedis();
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).write({
        userId: USER,
        permissionKey: 'X',
      });

      const call = redis.calls.find(([name]) => name === 'set');
      expect(call).toBeDefined();
      expect(call?.[2]).toBe(MARKER);
      expect(call?.[3]).toBe('PX');
      expect(call?.[4]).toBe(TTL_MS);
    });

    it('applies the TTL, so an entry cannot outlive its correctness', async () => {
      // The TTL is the backstop. `invalidateUser` is the authority; the TTL is what stops a
      // missed invalidation from being permanent.
      const redis = fakeRedis();
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).write({
        userId: USER,
        permissionKey: 'X',
      });

      expect(redis.calls.find(([name]) => name === 'set')).toContain('PX');
    });

    it('indexes the entry under the user, so invalidation can find it', async () => {
      // Without the index, `invalidateUser` would need `KEYS`/`SCAN` — O(N) on a shared
      // server — or would silently do nothing. This SADD is what makes revocation possible.
      const redis = fakeRedis();
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).write({
        userId: USER,
        permissionKey: 'X',
      });

      const sadd = redis.calls.find(([name]) => name === 'sadd');
      expect(sadd).toBeDefined();
      expect(String(sadd?.[2])).toBe(keyUsedBy(redis, 'set'));
    });

    it('refuses a non-positive TTL at construction, not at first write', async () => {
      // `PX 0` is an error in Redis and a negative expiry is an error in the client. Either
      // way it would otherwise surface on the first request rather than at boot.
      expect(() => new RedisPermissionCache(fakeRedis(), SCHOOL, 0)).toThrow(/ttl/i);
      expect(() => new RedisPermissionCache(fakeRedis(), SCHOOL, -1)).toThrow(/ttl/i);
    });

    it('refuses a blank school id, so entries cannot be written un-namespaced', async () => {
      expect(() => new RedisPermissionCache(fakeRedis(), '  ', TTL_MS)).toThrow(/school/i);
    });
  });

  describe('invalidateUser — the revocation path', () => {
    it('deletes every indexed entry AND the index itself', async () => {
      // The two-part delete is the whole point. Deleting the entries but leaving the index
      // leaks memory; deleting the index but leaving the entries leaves a revoked
      // permission readable until its TTL expires — which is the failure that matters.
      const entries = ['eduflow:perm:v1:school-a:user-1:X', 'eduflow:perm:v1:school-a:user-1:Y'];
      const redis = fakeRedis({ smembers: entries });

      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser(USER);

      const del = redis.calls.find(([name]) => name === 'del');
      const deleted = (del?.slice(1) as unknown[] | undefined) ?? [];
      expect(deleted).toEqual(expect.arrayContaining(entries));
      expect(deleted).toHaveLength(entries.length + 1);
    });

    it('does not use KEYS or SCAN to find them', async () => {
      const redis = fakeRedis({ smembers: ['eduflow:perm:v1:school-a:user-1:X'] });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser(USER);

      expect(redis.calls.map(([name]) => name)).toEqual(['smembers', 'del']);
    });

    it('is a no-op when the user has nothing cached', async () => {
      // The common case: most role-change events concern a user who never triggered a cache
      // write. Issuing a DEL with no keys is harmless but noisy, and `DEL` with zero
      // arguments is an error in some clients.
      const redis = fakeRedis({ smembers: [] });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser(USER);

      expect(redis.calls.map(([name]) => name)).toEqual(['smembers']);
    });

    it('tolerates a nil index, which is how Redis answers a missing set', async () => {
      const redis = fakeRedis({ smembers: null });
      await expect(
        new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser(USER),
      ).resolves.toBeUndefined();
    });

    it('issues no DEL at all when the index held only non-strings', async () => {
      // A corrupt index must not become a DEL of `[object Object]` — and must not throw
      // either, because this is called from a role-change transaction.
      const redis = fakeRedis({ smembers: [42, null] });
      await new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser(USER);

      expect(redis.calls.map(([name]) => name)).toEqual(['smembers']);
    });

    it('refuses a blank user id rather than deleting a wildcard', async () => {
      // `invalidateUser('')` must never reach a DEL, or a bug at a call site becomes a
      // flush of every cached permission in the deployment.
      const redis = fakeRedis({ smembers: [] });

      await expect(
        new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser('   '),
      ).rejects.toThrow(/user/i);
      expect(redis.calls).toEqual([]);
    });
  });

  describe('failures propagate — the RULE decides they are survivable', () => {
    it('propagates a GET failure, so the rule can fall back to the database', async () => {
      const redis = {
        get: () => Promise.reject(new Error('ECONNREFUSED 6379')),
        set: () => Promise.resolve('OK'),
        sadd: () => Promise.resolve(1),
        smembers: () => Promise.resolve([]),
        del: () => Promise.resolve(0),
      } satisfies RedisLike;

      await expect(
        new RedisPermissionCache(redis, SCHOOL, TTL_MS).read({ userId: USER, permissionKey: 'X' }),
      ).rejects.toThrow('ECONNREFUSED 6379');
    });

    it('propagates a DEL failure, so a failed revocation is visible rather than silent', async () => {
      // The opposite trade to the read path, and deliberately so: a revocation that could
      // not be completed MUST NOT look like one that was. The rule swallows it for the
      // request path; the operator log is what surfaces it.
      const redis = {
        get: () => Promise.resolve(null),
        set: () => Promise.resolve('OK'),
        sadd: () => Promise.resolve(1),
        smembers: () => Promise.resolve(['eduflow:perm:v1:school-a:user-1:X']),
        del: () => Promise.reject(new Error('READONLY replica')),
      } satisfies RedisLike;

      await expect(
        new RedisPermissionCache(redis, SCHOOL, TTL_MS).invalidateUser(USER),
      ).rejects.toThrow('READONLY replica');
    });
  });
});
