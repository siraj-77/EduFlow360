import { Module, type DynamicModule, type OnModuleDestroy, type Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readPersistenceConfig } from '../../config/persistence.js';
import type { AppConfig } from '../../config/env.js';
import { IPERMISSION_GRANT_READER } from './domain/ports/permission-grant-reader.js';
import type { IPermissionGrantReader } from './domain/ports/permission-grant-reader.js';
import { PrismaPermissionGrantReader } from './infrastructure/postgres/prisma-permission-grant-reader.js';

/**
 * `RbacModule` — the wiring, and nothing else.
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
 * refusal rather than a boot failure — and never a silent "allowed".
 *
 * A half-configured deployment is refused at boot by `readPersistenceConfig`, which is
 * shared with `AuthModule` so the two cannot disagree about when persistence counts.
 *
 * ## Its own `PrismaClient`, and the honest cost of that
 *
 * `AuthModule` owns a pool and does not export `PrismaClient`, so this module builds
 * its own — the alternative being a refactor of tested, working wiring or an import
 * cycle, and this story is not that refactor.
 *
 * The cost is a second connection pool in a database-backed deployment. It is stated
 * here rather than left for someone to measure: two pools mean twice the idle
 * connections against one PostgreSQL, and the day a per-school deployment runs dozens
 * of application instances that is a number somebody will want to have reduced.
 */

/** Re-exported so import sites read the same as every other port in this repository. */
export { IPERMISSION_GRANT_READER } from './domain/ports/permission-grant-reader.js';

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

@Module({})
export class RbacModule {
  static forRoot(config: AppConfig): DynamicModule {
    const persistence = readPersistenceConfig(config);

    if (persistence === null) {
      // Reported, never silent. Same rule as `AuthModule`: a boot warning that says
      // what is absent beats a 403 an operator has to diagnose from the outside.
      console.warn(
        'RbacModule: no DATABASE_URL, so IPermissionGrantReader is not registered and ' +
          'PermissionGuard will REFUSE every route carrying @RequirePermission. That is correct ' +
          '— a deployment with no database cannot evaluate a role — and @Public routes are ' +
          'unaffected, which is what keeps sign-in working (PLT-201).',
      );

      return { module: RbacModule, providers: [], exports: [] };
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
    ];

    return {
      module: RbacModule,
      providers,
      // Exported so the globally-registered `PermissionGuard` — which lives in
      // `common/guards/` and cannot import this module — can inject it.
      exports: [IPERMISSION_GRANT_READER],
    };
  }
}
