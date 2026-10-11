import { Module, type DynamicModule, type OnModuleDestroy, type Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readPersistenceConfig } from '../../config/persistence.js';
import type { AppConfig } from '../../config/env.js';
import { PrismaAuditRepository } from './infrastructure/postgres/prisma-audit-repository.js';
import { IAUDIT_REPOSITORY } from './domain/repositories/audit-repository.js';
import { IREASON_POLICY } from './domain/ports/reason-policy.js';
import { FrozenReasonPolicy } from './domain/services/reason-policy.js';

/**
 * `AuditModule` — the wiring, and nothing else (`PLT-401`, `PLT-402`).
 *
 * The same rule `AuthModule` and `RbacModule` state: every rule lives in
 * `domain/`, and what is left here is which implementation to construct from
 * which environment variable.
 *
 * ## The two states
 *
 * | state                | `IAUDIT_REPOSITORY`    | effect on an `@Audited` route      |
 * |----------------------|------------------------|------------------------------------|
 * | no `DATABASE_URL`    | not registered        | the interceptor REFUSES by name    |
 * | `DATABASE_URL`       | registered            | the record is written              |
 *
 * The absent case is a supported configuration (`ADR-019`): without a
 * database there is no session repository either, so `SessionGuard` refuses
 * every authenticated route before an audited one is reached, and the
 * sign-in routes that ARE reached have nowhere to put a record — which is
 * why `AuditInterceptor` refuses rather than pretending. Reportd, never
 * silent, exactly as `RbacModule` reports.
 *
 * ## Its own `PrismaClient`, and the honest cost
 *
 * A third module-scoped pool, after `AuthModule` and `RbacModule`. The cost
 * is the one `RbacModule` already recorded: three pools mean three times the
 * idle connections against one PostgreSQL, and the day a per-school
 * deployment runs dozens of application instances is the day somebody wants
 * that reduced. The alternative is a shared-pool module — a refactor of
 * tested, working wiring that this story is not, and the failure mode of
 * doing it badly (two owners of one connection, one of whom closes it) is
 * worse than the idle connections.
 *
 * Both tokens are EXPORTED because the globally-registered
 * `AuditInterceptor` lives in `common/` and cannot import this module —
 * the same arrangement `RbacModule` uses for `PermissionGuard`.
 */

/** Re-exported so import sites read the same as every other port here. */
export { IAUDIT_REPOSITORY } from './domain/repositories/audit-repository.js';
export { IREASON_POLICY } from './domain/ports/reason-policy.js';

@Module({})
export class AuditModule {
  static forRoot(config: AppConfig): DynamicModule {
    const persistence = readPersistenceConfig(config);

    if (persistence === null) {
      console.warn(
        `AuditModule: no DATABASE_URL, so ${String(IAUDIT_REPOSITORY.description)} and ` +
          `${String(IREASON_POLICY.description)} are not registered. Any route carrying ` +
          '@Audited will be REFUSED by AuditInterceptor rather than silently unrecorded, and ' +
          '@Public sign-in routes are unaffected. That is correct for a deployment with no ' +
          'data layer — ADR-019 — and is reported so an operator who expected an audit trail ' +
          'learns it at boot (PLT-401, PLT-402).',
      );

      return { module: AuditModule, providers: [], exports: [] };
    }

    const { databaseUrl, schoolId } = persistence;

    const providers: Provider[] = [
      {
        provide: PrismaClient,
        // `datasourceUrl` rather than `process.env.DATABASE_URL`, because the
        // configuration arrives as an argument so that nothing here reads the
        // ambient environment.
        useFactory: (): PrismaClient => new PrismaClient({ datasourceUrl: databaseUrl }),
      },
      {
        provide: IAUDIT_REPOSITORY,
        // `schoolId` as metadata, the same way `PrismaPermissionGrantReader`
        // carries it: the draft never supplies one, so a caller cannot forget
        // it and cannot forge another school's.
        useFactory: (client: PrismaClient): PrismaAuditRepository =>
          new PrismaAuditRepository(client, schoolId),
        inject: [PrismaClient],
      },
      {
        // `useValue`: nothing to construct, nothing to inject. The frozen
        // set is empty today (`reason-policy.ts` explains why that is the
        // correct state), and a module that wants its own policy supplies
        // its own implementation of the same port.
        provide: IREASON_POLICY,
        useValue: new FrozenReasonPolicy(),
      },
      // The shutdown hook. A provider CLASS rather than a hook on the
      // factories, for the reason `AuthModule` and `RbacModule` give: Nest
      // calls `onModuleDestroy` on providers and not on factory return
      // values, and a `pnpm test` run that leaves a pool behind holds the
      // socket long after the process is gone — on Windows, longer. The class
      // IS the provider token, so nothing outside it can hold one.
      {
        provide: AuditConnection,
        useFactory: (client: PrismaClient): AuditConnection => new AuditConnection(client),
        inject: [PrismaClient],
      },
    ];

    return {
      module: AuditModule,
      providers,
      // Exported so the globally-registered `AuditInterceptor` — which lives
      // in `common/interceptors/` and cannot import this module — can inject
      // them. `audit-interceptor-wiring.spec.ts` asserts the names match.
      exports: [IAUDIT_REPOSITORY, IREASON_POLICY],
    };
  }
}

class AuditConnection implements OnModuleDestroy {
  constructor(private readonly client: PrismaClient) {}

  onModuleDestroy(): void {
    // Not awaited: Nest's shutdown hook is synchronous here and the pool
    // closes itself. A rejected disconnect during shutdown must not mask the
    // reason the process is shutting down.
    void this.client.$disconnect();
  }
}
