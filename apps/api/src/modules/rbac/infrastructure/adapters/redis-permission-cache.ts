import type { IPermissionCache, PermissionCacheKey } from '../../domain/ports/permission-cache.js';

/**
 * `RedisPermissionCache` — the `IPermissionCache` implementation over Redis.
 *
 * ## Why a `RedisLike` interface and not an `ioredis` import
 *
 * `AGENTS.md` 2.2 keeps vendor SDKs out of `domain/`, and this file is `infrastructure/` so
 * an import would be permitted — but permitted is not the same as wanted. `AGENTS.md` 3.1
 * lists **Redis + BullMQ** for cache/queue, and the first real consumer of Redis in this
 * system is a *queue*, not this cache. `ioredis` therefore arrives with the queue story.
 *
 * So this adapter is written against the five commands it actually uses. That makes it
 * complete and fully testable **today**, with no dependency added and no claim that cannot
 * be verified. When `ioredis` lands, the factory passes it as a constructor argument —
 * `ioredis` satisfies `RedisLike` structurally, and not one line here changes.
 *
 * ## The key layout, and why each segment is there
 *
 * ```
 * eduflow:perm:v1:<schoolId>:<userId>:<permissionKey>      -> "1"
 * eduflow:perm:v1:<schoolId>:<userId>:__keys               -> SET of the entry keys above
 * ```
 *
 * | segment | what it prevents |
 * |---|---|
 * | `eduflow:` | two deployments sharing one Redis colliding, and this cache being flushable with a prefix |
 * | `perm:v1` | a future change to what a cached entry *means* silently serving entries written under the old meaning until their TTL expired |
 * | `schoolId` | one deployment reading another's grants. `AGENTS.md` 2.1 makes data isolation physical per school, and a shared cache is the one place that could leak across it |
 * | `userId` | one user's grants answering for another's — the cross-family read `AGENTS.md` 2.13 is about |
 * | `permissionKey` | `GRADE_ENTER` being served for `GRADE_DELETE` |
 *
 * ## Why entries are indexed in a SET rather than found with `KEYS`
 *
 * `invalidateUser` has to delete everything cached about one user. The two alternatives are
 * both wrong:
 *
 * - **`KEYS`/`SCAN`** is O(N) over the whole keyspace and blocks the Redis event loop while
 *   it runs. On a shared instance that is one school's role change stalling every other
 *   school's requests. Unacceptable on the revocation path, which is the path that must
 *   never be slow.
 * - **A pattern delete** is the same scan wearing a friendlier syntax.
 *
 * A per-user SET makes revocation two commands regardless of how much is cached, and makes
 * the hot read path exactly one `GET`. The cost is one extra `SADD` per write, on the
 * write-back path, which by definition already missed.
 *
 * ## Failures propagate here, and are survivable there
 *
 * Every method here rejects on a client failure rather than swallowing it. That is the
 * opposite of what the guard does, and the split is deliberate:
 *
 * - **On the request path**, `resolvePermissionWithCache` catches and falls back to the
 *   database. A Redis outage must not become an authorization outage.
 * - **On the revocation path**, a swallowed failure would mean a revoked permission stays
 *   readable until its TTL expires, and nobody would know. So it propagates to the caller
 *   that can log it.
 *
 * An adapter that swallowed everything would make the second case impossible to detect.
 */

/**
 * The five Redis commands this adapter uses.
 *
 * `ioredis` satisfies this structurally — its methods return promises and take the argument
 * order used below. Declaring it here rather than importing the client keeps the adapter
 * testable and keeps a vendor SDK out of the module until something actually needs it.
 */
export interface RedisLike {
  get(key: string): Promise<unknown>;
  /**
   * @param args `[key, value, 'PX', ttlMs]` — in that order.
   */
  set(...args: readonly unknown[]): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<unknown>;
  /** @param args one or more keys. Never called with zero — see `invalidateUser`. */
  del(...args: readonly string[]): Promise<unknown>;
}

/** The grant marker. Written and matched, so `read` and `write` cannot disagree. */
const GRANT_MARKER = '1';

/** The index key suffix. A permission key may never equal this. */
const INDEX_SUFFIX = '__keys';

/**
 * The default TTL.
 *
 * The backstop, not the mechanism: `invalidateUser` is the authority. This bounds how long a
 * *missed* invalidation can keep serving a stale answer, so it is short enough to be
 * harmless and long enough that a busy teacher's page load does not re-query the database on
 * every navigation.
 */
const DEFAULT_TTL_MS = 60_000;

export class RedisPermissionCache implements IPermissionCache {
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: RedisLike,
    schoolId: string,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {
    // Both validated here rather than at first use. A cache constructed with a blank
    // school id would write un-namespaced entries that a second deployment would read, and
    // a non-positive TTL is a Redis error that would otherwise surface on the first
    // request rather than at boot.
    if (typeof schoolId !== 'string' || schoolId.trim().length === 0) {
      throw new Error(
        'RedisPermissionCache requires a non-blank school id. AGENTS.md 2.1 isolates one ' +
          'school per database, and the school id is the only thing keeping two deployments ' +
          "sharing one Redis from reading each other's grants.",
      );
    }

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(
        `RedisPermissionCache requires a positive ttl in milliseconds; received ${String(ttlMs)}. ` +
          'A non-positive expiry is rejected by Redis, so this would otherwise fail on the first write.',
      );
    }

    this.keyPrefix = `eduflow:perm:v1:${schoolId.trim()}:`;
  }

  async read(key: PermissionCacheKey): Promise<boolean | undefined> {
    const stored = await this.redis.get(this.entryKey(key));

    // `=== GRANT_MARKER`, never a truthiness test. A value that is not exactly the marker
    // means "we do not know", and "we do not know" must reach the rule as a miss. Treating
    // a corrupt or foreign value as a grant is the one way this cache could open a route.
    return stored === GRANT_MARKER ? true : undefined;
  }

  async write(key: PermissionCacheKey): Promise<void> {
    const entry = this.entryKey(key);

    // Two commands, deliberately not a transaction or a pipeline. Both are best-effort and
    // a partial failure is harmless: without the SADD the entry expires on its own TTL,
    // and without the SET the index holds a key that does not exist.
    await this.redis.set(entry, GRANT_MARKER, 'PX', this.ttlMs);
    await this.redis.sadd(this.indexKey(key.userId), entry);
  }

  async invalidateUser(userId: string): Promise<void> {
    // Refused rather than sanitised. `invalidateUser('')` must never reach a DEL, or a bug
    // at a call site becomes a flush of every cached permission in the deployment.
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error(
        'invalidateUser requires a non-blank user id. A blank id would issue a delete with ' +
          'no key, which some clients treat as a flush rather than an error.',
      );
    }

    const indexKey = this.indexKey(userId.trim());
    const members = await this.redis.smembers(indexKey);

    // Narrowed here rather than trusting the client: a corrupt index must not become a
    // `DEL` of `[object Object]`, and must not throw either, because this runs inside a
    // role-change transaction.
    const entries = Array.isArray(members)
      ? members.filter(
          (member): member is string => typeof member === 'string' && member.length > 0,
        )
      : [];

    // `DEL` with zero keys is an error in some clients and a no-op in others. Skipping it
    // keeps the common case — most role changes concern a user who never populated the
    // cache — down to a single command.
    if (entries.length === 0) return;

    // The index goes LAST and in the same call, so it cannot be deleted while its entries
    // survive: a crash between two commands would otherwise leave a revoked permission
    // readable with nothing pointing at it, and unrevocable until the TTL expired.
    await this.redis.del(...entries, indexKey);
  }

  private entryKey(key: PermissionCacheKey): string {
    return `${this.keyPrefix}${key.userId}:${key.permissionKey}`;
  }

  private indexKey(userId: string): string {
    return `${this.keyPrefix}${userId}:${INDEX_SUFFIX}`;
  }
}
