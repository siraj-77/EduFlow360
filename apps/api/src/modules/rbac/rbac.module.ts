import { Module, type DynamicModule, type OnModuleDestroy, type Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readPersistenceConfig } from '../../config/persistence.js';
import type { AppConfig } from '../../config/env.js';
import { IPERMISSION_GRANT_READER } from './domain/ports/permission-grant-reader.js';
import type { IPermissionGrantReader } from './domain/ports/permission-grant-reader.js';
import { IPERMISSION_CACHE } from './domain/ports/permission-cache.js';
import {
  IOWNERSHIP_POLICY_REGISTRY,
  type IOwnershipPolicy,
} from './domain/ports/ownership-policy.js';
import {
  RedisPermissionCache,
  type RedisLike,
} from './infrastructure/adapters/redis-permission-cache.js';
import { StaticOwnershipPolicyRegistry } from './infrastructure/adapters/static-ownership-policy-registry.js';
import { PrismaPermissionGrantReader } from './infrastructure/postgres/prisma-permission-grant-reader.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { ReadMyPermissions } from './use-cases/read-my-permissions.js';

/**
 * `RbacModule` â€” the wiring, and nothing else.
 *
 * ## Why there is no business logic in this file
 *
 * The same rule `AuthModule` states, for the same reason: every rule lives in
 * `domain/`, and what is left here is the part that knows which implementation to
 * construct from which environment variable. That is a genuine fourth thing and it
 * belongs in the module file (`AGENTS.md` 2, Interface Segregation).
 *
 * ## The two states it can be in
 *
 * | state                | `IPermissionGrantReader` | effect on a gated route        |
 * |----------------------|--------------------------|--------------------------------|
 * | no `DATABASE_URL`    | not registered           | every gated route is REFUSED   |
 * | `DATABASE_URL` + id  | registered               | evaluated against the schema   |
 *
 * The absent case is a **supported configuration**, not a broken one: a Google-only
 * deployment has sign-in routes (`@Public`) and no permission-gated ones, so it needs
 * no database to sign anybody in. `PermissionGuard` takes `@Optional()` and refuses
 * every non-public route when the reader is missing, so the module's absence is a
 * refusal rather than a boot failure â€” and never a silent "allowed".
 * The `PermissionsController` is likewise registered only with the reader, so a
 * database-less deployment answers 404 for `GET /permissions/me` rather than
 * booting a route that can only refuse.
 *
 * A half-configured deployment is refused at boot by `readPersistenceConfig`, which is
 * shared with `AuthModule` so the two cannot disagree about when persistence counts.
 *
 * ## Its own `PrismaClient`, and the honest cost of that
 *
 * `AuthModule` owns a pool and does not export `PrismaClient`, so this module builds
 * its own â€” the alternative being a refactor of tested, working wiring or an import
 * cycle, and this story is not that refactor.
 *
 * The cost is a second connection pool in a database-backed deployment. It is stated
 * here rather than left for someone to measure: two pools mean twice the idle
 * connections against one PostgreSQL, and the day a per-school deployment runs dozens
 * of application instances that is a number somebody will want to have reduced.
 */

/** Re-exported so import sites read the same as every other port in this repository. */
export { IPERMISSION_GRANT_READER } from './domain/ports/permission-grant-reader.js';
export { IPERMISSION_CACHE } from './domain/ports/permission-cache.js';
export { IOWNERSHIP_POLICY_REGISTRY } from './domain/ports/ownership-policy.js';

/**
 * The ownership policies this deployment knows about.
 *
 * ## It is empty, and that is the correct state â€” not a gap
 *
 * `AGENTS.md` 2.3 requires teacherâ†’own classes, parentâ†’own children and vendorâ†’own outlet.
 * **None of those relationships exists in this repository.** There is no class table, no
 * guardian link, no parent-child edge and no outlet table, and the `User` model's own
 * comment says so: ownership "resolves through abstract ports, and the domains that would own
 * those relationships do not exist yet."
 *
 * So the list is empty because the domains that will fill it have not shipped. Writing a
 * teacher-to-own-classes policy now would mean inventing the class table, the assignment
 * table and the semantics of "assigned to" â€” which is `AGENTS.md` 6's named failure, *"A gap
 * is recorded, never filled with an invented threshold."*
 *
 * ## What an empty registry does, and why it is the safe direction
 *
 * It **refuses** any route declaring `@OwnsResource('<type>')`, with
 * `NO_POLICY_FOR_ENTITY` â€” a wiring fault naming this module. It does not allow.
 *
 * That direction is the whole design. The alternative â€” treating "no policy" as "nothing to
 * check" â€” would let a domain ship `@OwnsResource('student')` before its policy and get a
 * route that runs completely unscoped while reading exactly like a protected one. A visibly
 * broken route is recoverable; a quietly unscoped one is a cross-family data leak.
 *
 * Every domain that owns a record adds its policy here, and nothing in `common/guards/`
 * changes â€” which is `PLT-203`'s second acceptance criterion.
 */
export function ownershipPoliciesFor(): readonly IOwnershipPolicy[] {
  return [];
}

@Module({})
export class RbacModule {
  /**
   * @param ownershipPolicies the policies to register. Defaults to
   *   `ownershipPoliciesFor()`, which is empty â€” see that function for why, and for what an
   *   empty registry does to an `@OwnsResource` route.
   */
  static forRoot(
    config: AppConfig,
    ownershipPolicies: readonly IOwnershipPolicy[] = ownershipPoliciesFor(),
    /**
     * The Redis client, or `undefined` for a deployment with no cache.
     *
     * Supplied as an argument rather than constructed here because **`ioredis` is not a
     * dependency of this repository yet**, and this is deliberate. `AGENTS.md` 3.1 lists
     * Redis + BullMQ for cache/queue, and the first real consumer of Redis here is a
     * *queue* — `ioredis` (or `bullmq`, which pulls it) arrives with that story. Until then
     * `RedisPermissionCache` is written against the five commands it uses, so it is
     * complete and tested without a dependency nobody has justified yet.
     *
     * The wiring when `ioredis` lands is one argument at the call site in `app.module.ts`,
     * and `ioredis` satisfies `RedisLike` structurally — no change to the adapter, the port,
     * or the rule.
     */
    redisClient?: RedisLike,
  ): DynamicModule {
    const persistence = readPersistenceConfig(config);

    if (persistence === null) {
      // Reported, never silent. Same rule as `AuthModule`: a boot warning that says
      // what is absent beats a 403 an operator has to diagnose from the outside.
      //
      // The ownership registry and the permission cache are NOT registered here, and that
      // is a deliberate refusal to improve on the invariant this branch already encodes —
      // *no persistence, nothing registered*. Neither needs a database, so registering them
      // would work; it would also mean an operator reading this warning could no longer
      // conclude "this deployment has no data layer and therefore evaluates nothing", which
      // is the one sentence the branch exists to make true. The cost is that an
      // `@OwnsResource` route reports `NO_POLICY_REGISTRY` rather than
      // `NO_POLICY_FOR_ENTITY`, and every lookup pays database latency; both refuse and both
      // answer correctly, and no such route exists today.
      console.warn(
        `RbacModule: no DATABASE_URL, so ${String(IPERMISSION_GRANT_READER.description)} is not ` +
          'registered and PermissionGuard will REFUSE every route carrying @RequirePermission. ' +
          'That is correct — a deployment with no database cannot evaluate a role — and @Public ' +
          'routes are unaffected, which is what keeps sign-in working (PLT-201). ' +
          `${String(IOWNERSHIP_POLICY_REGISTRY.description)} and ` +
          `${String(IPERMISSION_CACHE.description)} are likewise not registered, so a route ` +
          'carrying @OwnsResource would be REFUSED with NO_POLICY_REGISTRY and every lookup ' +
          'would go to the database (PLT-202 AC-2, PLT-203).',
      );

      return { module: RbacModule, providers: [], controllers: [], exports: [] };
    }

    // Built only once persistence is confirmed, so the warning below can never describe a
    // state the deployment is not in.
    const registry = new StaticOwnershipPolicyRegistry(ownershipPolicies);
    const registered = registry.registeredEntityTypes();

    // Reported, never silent — the same rule as the branch above. An operator who sees
    // "0 ownership policies" learns it at boot; one who does not learns it by wondering
    // why a route 403s.
    if (registered.length === 0) {
      console.warn(
        'RbacModule: 0 IOwnershipPolicy implementations are registered, so every route ' +
          "declaring @OwnsResource('<type>') will be REFUSED with NO_POLICY_FOR_ENTITY. That " +
          'is correct — the domains that would own those relationships (classes, children, ' +
          'outlets) do not exist yet, and AGENTS.md 6 forbids inventing them. A domain ships ' +
          'its policy by adding it to ownershipPoliciesFor(). No @OwnsResource route exists ' +
          'today, so nothing is affected (PLT-203).',
      );
    }

    const { databaseUrl, schoolId } = persistence;

    const providers: Provider[] = [
      {
        provide: PrismaClient,
        // `datasourceUrl` rather than `process.env.DATABASE_URL`, because configuration
        // arrives as an argument precisely so that nothing here reads the ambient
        // environment. See `AuthModule` for the same decision.
        useFactory: (): PrismaClient => new PrismaClient({ datasourceUrl: databaseUrl }),
      },
      {
        provide: PrismaConnection,
        useFactory: (client: PrismaClient): PrismaConnection => new PrismaConnection(client),
        inject: [PrismaClient],
      },
      {
        provide: IPERMISSION_GRANT_READER,
        useFactory: (client: PrismaClient): IPermissionGrantReader =>
          new PrismaPermissionGrantReader(client, schoolId),
        // `inject` is declared, always. A `useFactory` arrow carries no
        // `design:paramtypes`, so omitting it hands Nest an empty argument list and the
        // dependency arrives `undefined` — which is the defect `AuthModule` records at
        // `IOIDC_STATE_STORE`, where the symptom was a 500 on the first request and a
        // green build.
        inject: [PrismaClient],
      },
      {
        provide: ReadMyPermissions,
        // The use-case takes the port, and nothing else: it reads a set
        // through `IPermissionGrantReader` and owns no state of its own.
        useFactory: (grants: IPermissionGrantReader): ReadMyPermissions =>
          new ReadMyPermissions(grants),
        inject: [IPERMISSION_GRANT_READER],
      },
      {
        provide: IOWNERSHIP_POLICY_REGISTRY,
        // `useValue` rather than a factory: there is nothing to construct and nothing to
        // inject — the policies arrived as an argument, already built.
        //
        // This provider and the `exports` entry below MUST name the same symbol. A mismatch
        // boots to `UnknownExportException` rather than failing a test that inspects the
        // returned object, which is why `rbac.module.spec.ts` now boots the real graph.
        useValue: registry,
      },
    ];

    // The cache is OPTIONAL, and its absence is the ordinary case.
    //
    // `REDIS_URL` is an `optionalSecret` in `env.ts` and `.env.example` records why: "Redis
    // has no official Windows build." A school with no Redis boots and serves, and its
    // answers are identical — only slower. That is the whole design: the cache is a latency
    // optimisation in front of a source of truth, never a dependency of it.
    //
    // The presence of a client is what decides, NOT the presence of `REDIS_URL`. A
    // deployment may set the variable and pass no client (no driver installed yet), and one
    // may pass a client with the variable unset. Keying on the argument keeps this module
    // honest: it registers a cache exactly when it was handed something to build one from.
    const cacheConfigured = redisClient !== undefined;

    if (cacheConfigured) {
      providers.push({
        provide: IPERMISSION_CACHE,
        useFactory: (client: RedisLike) =>
          new RedisPermissionCache(client, schoolId, PERMISSION_CACHE_TTL_MS),
        inject: [REDIS_CLIENT],
      });
    } else {
      console.warn(
        `RbacModule: no Redis client was supplied, so ${String(IPERMISSION_CACHE.description)} is ` +
          'not registered and every permission check reads the database. That is CORRECT and is ' +
          'the normal deployment on a host without Redis — answers are identical, only slower, ' +
          'which is what PLT-202 AC-2 asks for. It is reported so that an operator who expected ' +
          'a cache learns at boot rather than by measuring latency (see REDIS_URL in .env.example).',
      );
    }

    return {
      module: RbacModule,
      providers: [
        ...providers,
        // Registered unconditionally when a client was supplied, because `inject` needs a
        // token to resolve against. `useFactory` above reads the parameter, not the token.
        ...(cacheConfigured ? [{ provide: REDIS_CLIENT, useValue: redisClient }] : []),
      ],
      // The route that serves `PLT-204`: the caller's own permission set.
      // Registered only in this branch — with no reader, the route could
      // only refuse, and a 404 is the more honest answer.
      controllers: [PermissionsController],
      // Exported so the globally-registered `PermissionGuard` — which lives in
      // `common/guards/` and cannot import this module — can inject it.
      exports: [
        IPERMISSION_GRANT_READER,
        IOWNERSHIP_POLICY_REGISTRY,
        ...(cacheConfigured ? [IPERMISSION_CACHE] : []),
      ],
    };
  }
}

/**
 * How long a cached grant may be served before the TTL backstop expires.
 *
 * Short, because `invalidateUser` is the authority and this only bounds how long a *missed*
 * invalidation can keep serving a stale answer. Long enough that one page load does not
 * re-query the database on every navigation. Per-school configuration would be the obvious
 * next step (`AGENTS.md` 2.14) and is deliberately not invented here.
 */
const PERMISSION_CACHE_TTL_MS = 60_000;

/**
 * DI token for the Redis client itself.
 *
 * Local to this module rather than exported: nothing outside `RbacModule` may hold a Redis
 * connection, because a second holder is a second pool and `AGENTS.md` 2.2 would then have
 * two places that disagree about whether the cache is configured.
 */
const REDIS_CLIENT = Symbol('RedisClient');

/**
 * Closes the pool when the module goes away.
 *
 * A provider class rather than a hook on the factory, for the reason `AuthModule` gives:
 * Nest calls `onModuleDestroy` on providers and not on factory return values. Without
 * it a `pnpm test` run leaves a pool behind, and Windows holds the socket long after
 * the process that wanted it has gone.
 */
class PrismaConnection implements OnModuleDestroy {
  constructor(private readonly client: PrismaClient) {}

  onModuleDestroy(): void {
    // Not awaited: Nest's shutdown hook is synchronous here and the pool closes
    // itself. A rejected disconnect during shutdown must not mask the reason the
    // process is shutting down.
    void this.client.$disconnect();
  }
}
