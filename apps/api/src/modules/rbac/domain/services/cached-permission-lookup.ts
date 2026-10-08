import type { IPermissionCache } from '../ports/permission-cache.js';

/**
 * The read-through rule — `PLT-202` acceptance criterion 2.
 *
 * ## The one property this file exists to guarantee
 *
 * **The cache can change how long an answer takes. It can never change what the answer is.**
 *
 * That is the entire security requirement of adding a cache in front of an authorization
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
 *
 * ## Why the DATABASE is the answer and the cache is only a note
 *
 * A cache that is never invalidated is a second source of truth for "what can this user do",
 * and `AGENTS.md` 2.3 has already rejected that shape once: `User.roleId` became
 * `UserRole` (`D-4.1`) because two answers that can disagree are a defect class, not a
 * convenience. The database is the answer. The cache records how recently we asked.
 *
 * ## Why denials are NOT cached
 *
 * A cached `false` that outlives the grant it was written against locks a real user out of
 * something they are entitled to, and the report is always the same: *"I was added to the
 * role and it did not work."* Every such report costs more to diagnose than the round trip
 * the cache would have saved, because the cache is invisible and the outage is not. So a
 * confirmed grant is written and a confirmed denial is not.
 *
 * `IPermissionCache.read` still permits `false`, because a deployment may seed the cache
 * itself and the port should not lie about what a cache is.
 */

/**
 * How the answer was reached.
 *
 * Exists so a slow route can be *explained* rather than guessed at, and so a Redis outage
 * is visible. Without it every request still succeeds at database latency and nobody
 * connects the two.
 */
export type CacheOutcome =
  /** Served from the cache. No database round trip. */
  | 'HIT'
  /** Not cached; the database was asked and its answer was written back. */
  | 'MISS'
  /** No cache is configured. The normal deployment for a school without `REDIS_URL`. */
  | 'BYPASS'
  /** A cache was configured but unreachable. The database was asked anyway. */
  | 'DEGRADED';

export interface CachedPermissionOutcome {
  /** Exactly what the database or the cache said. Never inferred. */
  readonly granted: boolean;
  readonly outcome: CacheOutcome;
}

/** The facts the rule needs. */
export interface PermissionCacheFacts {
  readonly userId: string;
  readonly permissionKey: string;
  /**
   * The cache, or `undefined` for a deployment without one.
   *
   * Absent is the **normal** case, not a fault, and it is why this is not `@Optional()`
   * plumbing bolted onto the guard — the rule owns the fallback so there is exactly one
   * place where "ask the database" is decided.
   */
  readonly cache?: IPermissionCache | undefined;
  /** The database. The source of truth, and the only thing that can say `true` for certain. */
  readonly isGranted: () => Promise<boolean>;
}

/**
 * Resolve one permission, consulting the cache when there is one.
 *
 * @throws whatever `isGranted` throws. A database failure is not a permission decision and
 *   is not folded into `false` — see `decidePermissionAccess`, which reaches the same
 *   conclusion for the same reason: a 403 that reads like policy sends an operator to a
 *   role table when the fault is a connection pool.
 */
export async function resolvePermissionWithCache(
  facts: PermissionCacheFacts,
): Promise<CachedPermissionOutcome> {
  const { cache } = facts;

  // No cache configured. This is a school with no `REDIS_URL`, and it is a first-class
  // deployment rather than a degraded one, so it is checked before anything else and
  // reported as BYPASS rather than MISS.
  if (cache === undefined) {
    return { granted: await facts.isGranted(), outcome: 'BYPASS' };
  }

  let outcome: CacheOutcome = 'MISS';

  try {
    const cached = await cache.read({
      userId: facts.userId,
      permissionKey: facts.permissionKey,
    });

    // `=== true` / `=== false`, never a truthiness test. An external store returning
    // `'true'`, `1` or `{ granted: true }` is either a broken adapter or a substituted one,
    // and neither may open a route by accident — the same rule `decidePermissionAccess`
    // applies to a grant reader.
    if (cached === true || cached === false) {
      return { granted: cached, outcome: 'HIT' };
    }

    // Anything else, including `undefined`, is a MISS. See the port header for why that
    // sentence is the most important one on the interface.
  } catch {
    // Swallowed deliberately, and this is the only reason `outcome` is mutable. A cache
    // that cannot be reached makes this request slower; it does not make it wrong.
    outcome = 'DEGRADED';
  }

  const granted = await facts.isGranted();

  // Only a confirmed grant is written. A denial is not cached — see the file header.
  if (granted && outcome === 'MISS') {
    try {
      await cache.write({ userId: facts.userId, permissionKey: facts.permissionKey });
    } catch {
      // A full or read-only cache is not a reason to fail a request the database already
      // answered. Left unreported so the write path cannot become a 500.
    }
  }

  return { granted, outcome };
}
