/**
 * The permission cache port — `PLT-202` acceptance criterion 2.
 *
 * ## What it is for
 *
 * > "Permission checks add negligible latency (<5ms) — cache role→permission resolution in
 * > Redis with invalidation on role change." (`PLT-202`, AC-2)
 *
 * ## The shape, and why it is three methods and not a generic KV store
 *
 * A cache port that exposed `get`/`set`/`del` with string keys would push two decisions
 * onto every caller: what the key looks like, and what to do when it is stale. Both are
 * decided here once, so an implementation cannot get them subtly different and no caller
 * has to remember.
 *
 * | method | the decision it owns |
 * |---|---|
 * | `read` | key construction, and the "absent" answer |
 * | `write` | key construction, TTL, and index maintenance |
 * | `invalidateUser` | dropping everything cached about one user |
 *
 * `invalidateUser` rather than `invalidatePermission(userId, key)` is the shape
 * `PLT-202` asks for — *"invalidation on role change"* — and role change means *every* key
 * for that user, not one. A narrower method would leave the interesting case to be spelled
 * at each call site, and getting it wrong means a revoked permission outliving its
 * revocation.
 *
 * ## No cache is a valid deployment, and that is not a degraded mode
 *
 * `REDIS_URL` is optional (`env.ts`) and `.env.example` records why: *"Redis has no
 * official Windows build."* A school with no Redis boots and serves, so **`IPermissionCache`
 * is `@Optional()` wherever it is injected**, and its absence means "ask the database", not
 * "refuse". Making the cache mandatory would put a performance dependency in the boot path
 * and turn a Redis outage into an authorization outage.
 *
 * ## What an implementation must NEVER do
 *
 * - **Return anything but exactly `true`, `false`, or `undefined`.** `undefined` means
 *   "not cached"; anything else is a broken store and is treated as a miss by
 *   `resolvePermissionWithCache`.
 * - **Throw in a way the caller can observe.** Every method here is permitted to reject,
 *   and every rejection is swallowed by the rule — a cache that cannot be reached makes
 *   requests slower, never wrong. See `cached-permission-lookup.ts`.
 * - **Serve a value for a different user or a different permission key.** The port takes
 *   both on every call precisely so a key can never be assembled from the wrong pieces.
 */

/** DI token. Optional wherever it is injected — see the header. */
export const IPERMISSION_CACHE = Symbol('IPermissionCache');

/**
 * One user's grant for one permission key, as the cache sees it.
 *
 * A parameter object rather than positional arguments because every call site passes a
 * `userId` and a `permissionKey` together, and swapping them compiles silently.
 */
export interface PermissionCacheKey {
  readonly userId: string;
  readonly permissionKey: string;
}

/**
 * A read-through cache in front of `IPermissionGrantReader`.
 *
 * ## The contract an implementation must honour
 *
 * - **`undefined` means "not cached".** Not "not granted", not "unknown", not an error.
 *   This is the single most important sentence on the interface: conflating "absent" with
 *   "denied" would deny every permission the first time it was requested after a deploy.
 * - **`true` is served without consulting the database.** That is the whole point, and it
 *   is the only way the <5ms criterion is met.
 * - **`read` MAY reject. The caller will fall back to the database.** It MUST NOT reject
 *   as a way of saying "no".
 * - **`write` is best-effort and MAY reject.** Nothing depends on it having happened.
 * - **`invalidateUser` MUST remove every entry for that user**, including the index the
 *   implementation uses to find them. An implementation that forgets its own index is
 *   correct until the first role change and wrong forever after.
 */
export interface IPermissionCache {
  /**
   * The cached answer for one user and one key, or `undefined` when not cached.
   *
   * Returning exactly `false` is permitted and is served without a database round trip,
   * though this repository's own implementation never writes one — see
   * `resolvePermissionWithCache` for why denials are not cached.
   */
  read(key: PermissionCacheKey): Promise<boolean | undefined>;

  /** Record a confirmed grant. Called only after the database said `true`. */
  write(key: PermissionCacheKey): Promise<void>;

  /**
   * Drop everything cached about one user.
   *
   * Called on any change to that user's role grants — grant, revoke, role deleted, user
   * suspended. Not called on a permission *definition* changing, because a definition
   * change alters what a key means and the entries are keyed by the key itself.
   */
  invalidateUser(userId: string): Promise<void>;
}
