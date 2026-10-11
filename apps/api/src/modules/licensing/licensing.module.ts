import {
  Module,
  type DynamicModule,
  type OnModuleDestroy,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { readPersistenceConfig } from '../../config/persistence.js';
import type { AppConfig } from '../../config/env.js';
import { EcdsaLicenceSignatureVerifier } from './infrastructure/adapters/ecdsa-licence-signature-verifier.js';
import { InMemoryLicencePayloadCache } from './infrastructure/adapters/in-memory-licence-payload-cache.js';
import { PrismaLicenseRepository } from './infrastructure/postgres/prisma-license-repository.js';
import { ValidateLicenceCertificate } from './use-cases/validate-licence-certificate.js';
import { RefreshCachedLicence } from './use-cases/refresh-cached-licence.js';
import { I_LICENCE_REPOSITORY } from './domain/repositories/license-repository.js';
import { I_LICENCE_PAYLOAD_CACHE } from './domain/ports/licence-payload-cache.js';
import { I_LICENCE_SIGNATURE_VERIFIER } from './domain/ports/licence-signature-verifier.js';
import { CLOCK } from '../auth/domain/ports/clock.js';
import { SystemClock } from '../auth/infrastructure/adapters/system-clock.js';

/**
 * `LicensingModule` — the wiring for `PLT-301`/`PLT-302`, and nothing else.
 *
 * ## The states, like every other module here
 *
 * | state | what happens |
 * |---|---|
 * | no `DATABASE_URL` | no licence repository, no validator; the cache stands empty and `EntitlementGuard` **refuses every `@RequireEntitlement` route by name** |
 * | `DATABASE_URL`, no `LICENSE_PUBLIC_KEY_PATH` | the repository is registered, but without a verifier nothing can judge a certificate; reported at boot, the guard still refuses |
 * | both | the full chain, and the boot refresh fills the cache |
 *
 * The first two are deliberate, and `AGENTS.md` §2.3's fail-closed is the
 * reason: a deployment that cannot verify a licence must not be able to
 * unlock one. The guard is registered with an optional cache dependency so
 * the container still boots in all three states — what refuses is the ROUTE,
 * which is the object the rule is about.
 *
 * ## The verification key
 *
 * `ADR-009`: the public key is embedded in the build and `env.ts` names the
 * file. A missing path is reported and the chain degrades to "refuse
 * everything"; an UNREADABLE one is a boot failure, because a deployment that
 * cannot read the key it was configured with has a deployment fault, not a
 * licensing state (`AGENTS.md` §11).
 */

@Module({})
export class LicensingModule {
  static forRoot(config: AppConfig): DynamicModule {
    const persistence = readPersistenceConfig(config);
    if (persistence === null) {
      return { module: LicensingModule, providers: [], exports: [] };
    }

    const { databaseUrl, schoolId } = persistence;
    const publicKeyPem = readLicenceKey(config);

    // Without a key the verification chain cannot be built at all, and the
    // cache stays absent — which the guard answers as a refusal, by name.
    const chain: Provider[] =
      publicKeyPem === null
        ? []
        : [
            {
              provide: I_LICENCE_SIGNATURE_VERIFIER,
              // Constructed once from the file content, never re-read: the key
              // is a build artefact (`ADR-009`), so a runtime change would be
              // an attempt to move the goalposts, not a deployment action.
              useFactory: (): EcdsaLicenceSignatureVerifier =>
                new EcdsaLicenceSignatureVerifier({ publicKeyPem }),
            },
            {
              provide: ValidateLicenceCertificate,
              useFactory: (verifier): ValidateLicenceCertificate =>
                new ValidateLicenceCertificate({ verifier }),
              inject: [I_LICENCE_SIGNATURE_VERIFIER],
            },
            {
              provide: RefreshCachedLicence,
              useFactory: (licenses, validator): RefreshCachedLicence =>
                new RefreshCachedLicence({
                  licenses,
                  validator,
                  clock: new SystemClock(),
                }),
              inject: [I_LICENCE_REPOSITORY, ValidateLicenceCertificate],
            },
            {
              // The boot refresh, and the ONLY writer of the cache in
              // production. A provider rather than a listener in `main.ts`,
              // because the provider owns the ordering: the cache is filled
              // before the first request can be routed, and the banner is
              // printed where the verdict is produced.
              provide: LicenceBootstrapper,
              useFactory: (
                refresher: RefreshCachedLicence,
                cache: InMemoryLicencePayloadCache,
              ): LicenceBootstrapper => new LicenceBootstrapper(refresher, cache, schoolId),
              inject: [RefreshCachedLicence, I_LICENCE_PAYLOAD_CACHE],
            },
          ];

    const providers: Provider[] = [
      {
        provide: PrismaClient,
        useFactory: (): PrismaClient => new PrismaClient({ datasourceUrl: databaseUrl }),
      },
      {
        // Its OWN clock, not `useExisting: SystemClock`. The class lives in
        // `AuthModule`, which does not export it, and importing `AuthModule`
        // here would build a SECOND auth graph — with a second Prisma pool —
        // inside this one. A clock has no dependencies; constructing one is
        // the cheaper and more honest option, and `IClock`'s whole purpose
        // is that any conforming implementation is interchangeable.
        provide: CLOCK,
        useFactory: (): SystemClock => new SystemClock(),
      },
      {
        // In-process: one certificate, one deployment (`ADR-003`), and a value
        // that must answer in microseconds on every request. The port is what
        // lets a Redis-backed registry (`PLT-602`) take over without
        // `EntitlementGuard` noticing.
        provide: I_LICENCE_PAYLOAD_CACHE,
        useFactory: (): InMemoryLicencePayloadCache => new InMemoryLicencePayloadCache(),
      },
      {
        provide: I_LICENCE_REPOSITORY,
        useFactory: (client: PrismaClient) => new PrismaLicenseRepository(client, schoolId),
        inject: [PrismaClient],
      },
      ...chain,
      {
        // The shutdown hook, the arrangement `AuthModule` and `RbacModule` use:
        // Nest calls `onModuleDestroy` on providers, not on factory return
        // values, and a test run that leaves a pool behind holds the socket
        // long after the process is gone.
        provide: LicenceConnection,
        useFactory: (client: PrismaClient): LicenceConnection => new LicenceConnection(client),
        inject: [PrismaClient],
      },
    ];

    return {
      module: LicensingModule,
      providers,
      // Exported so the globally-registered `EntitlementGuard` can inject the
      // cache — the same arrangement `AuditInterceptor` uses with the audit
      // repository.
      exports: [I_LICENCE_PAYLOAD_CACHE],
    };
  }
}

/** Fills the cache once, at boot, and reports what it found. */
class LicenceBootstrapper implements OnModuleInit {
  /** What the refresh concluded, so the wiring spec can read it without a database. */
  lastBootState: string | null = null;

  constructor(
    private readonly refresher: RefreshCachedLicence,
    private readonly cache: InMemoryLicencePayloadCache,
    private readonly schoolId: string,
  ) {}

  onModuleInit(): void {
    void this.refresher.refresh(this.cache).then((state) => {
      this.lastBootState = state.outcome;
      const summary =
        state.outcome === 'valid'
          ? `${state.payload.edition}, ${state.payload.allowedModules.length} modules, ` +
            `${Object.keys(state.payload.features).length} features`
          : `NOT LICENSED — ${state.outcome}`;
      console.warn(
        `LicensingModule: licence state at boot for school ${this.schoolId}: ${summary}. ` +
          'EntitlementGuard reads this state on every feature-gated request (PLT-302).',
      );
    });
  }
}

/** The pool's shutdown hook. */
class LicenceConnection implements OnModuleDestroy {
  constructor(private readonly client: PrismaClient) {}

  onModuleDestroy(): void {
    void this.client.$disconnect();
  }
}

/** Reads `LICENSE_PUBLIC_KEY_PATH`, or `null` when the deployment has no key. */
function readLicenceKey(config: AppConfig): string | null {
  const path = config.LICENSE_PUBLIC_KEY_PATH;
  if (path === undefined || path.trim().length === 0) {
    console.warn(
      'LicensingModule: no LICENSE_PUBLIC_KEY_PATH is configured, so no certificate can be ' +
        'verified. Every route carrying @RequireEntitlement will be REFUSED (403), which is the ' +
        'correct fail-closed behaviour for a deployment without a licence key (AGENTS.md 2.3, ' +
        'ADR-009). Reported so the state is visible rather than discovered.',
    );
    return null;
  }

  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    // Fail fast, naming the variable (`AGENTS.md` §11).
    throw new Error(
      `LicensingModule could not read LICENSE_PUBLIC_KEY_PATH (${path}): ` +
        `${cause instanceof Error ? cause.message : String(cause)}. The licence verification key ` +
        'is embedded in the build (ADR-009) and must be readable.',
    );
  }
}
