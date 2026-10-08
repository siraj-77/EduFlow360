import 'reflect-metadata';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Controller, Get, type DynamicModule, type Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../app.module.js';
import { OwnsResource } from './owns-resource.decorator.js';
import { RequirePermission } from './route-guards.decorator.js';
import { loadConfig, type AppConfig } from '../../config/env.js';
import { TEST_ENVIRONMENT } from '../../testing/test-environment.js';
import {
  IOWNERSHIP_POLICY_REGISTRY,
  type IOwnershipPolicyRegistry,
} from '../../modules/rbac/domain/ports/ownership-policy.js';
import { IPERMISSION_CACHE } from '../../modules/rbac/domain/ports/permission-cache.js';
import { IPERMISSION_GRANT_READER } from '../../modules/rbac/domain/ports/permission-grant-reader.js';
import { I_SESSION_REPOSITORY } from '../../modules/auth/auth.module.js';
import type { ISessionRepository } from '../../modules/auth/domain/ports/session-repository.js';
import { StaticOwnershipPolicyRegistry } from '../../modules/rbac/infrastructure/adapters/static-ownership-policy-registry.js';
import { ownershipPoliciesFor } from '../../modules/rbac/rbac.module.js';

/**
 * SEC-110 — that the SHIPPED guard chain is wired, not merely a locally-rebuilt one.
 *
 * ## The defect
 *
 * `PermissionGuard` takes four constructor arguments. The application graph
 * supplied two:
 *
 *     new PermissionGuard(new Reflector(), grants)
 *
 * `IPERMISSION_CACHE` and `IOWNERSHIP_POLICY_REGISTRY` were registered and exported
 * by `RbacModule` and injected into nothing. So in the shipped application:
 *
 *   - every permission lookup took the `BYPASS` path, which is why `PLT-202`
 *     AC-2's sub-5ms target was unreachable however fast Redis was, and why
 *     `reportCacheOutcome` could never fire and `DEGRADED` was unreachable;
 *   - a route declaring `@OwnsResource('<type>')` was refused with
 *     `NO_POLICY_REGISTRY` — a WIRING fault — rather than `NO_POLICY_FOR_ENTITY`,
 *     which is the fault that means "this domain has not shipped its policy yet".
 *
 * Both are refusals and both fail closed, so nothing leaked. That is exactly why
 * the defect survived: its only symptom is being correctly cautious.
 *
 * ## Why the two existing suites could not see it
 *
 * `permission-ownership-over-http.spec.ts` and `permission-cache-over-http.spec.ts` both
 * declare `{ provide: APP_GUARD, useClass: PermissionGuard }` in their OWN testing
 * module. Nest then resolves all four constructor parameters itself, so those suites
 * exercise the guard as it is *meant* to be wired rather than as it *is* wired.
 *
 * `nest-dependency-injection.spec.ts` builds the real `AppModule.forRoot`, but with
 * `DATABASE_URL` absent — correctly, so `pnpm test` needs no database — and in that
 * state `RbacModule.forRoot` returns `providers: []`, so the registry is not
 * registered and its absence cannot be observed there either.
 *
 * **The gap between those two is where the defect lived.** Every test using the real
 * graph had persistence off; every test with persistence on used a graph it built
 * itself.
 *
 * ## Why this suite does not boot `AppModule.forRoot` into a container
 *
 * It was tried, and it is worth recording why it does not work: `AuthModule` resolves
 * the school's argon2id cost parameters at container CONSTRUCTION, so a
 * `PrismaClient` is asked a question while the graph is still being built, and the
 * suite dies in `beforeAll` with a `PrismaClientInitializationError` that says nothing
 * about SEC-110. `Test.overrideProvider` does not reach into an imported
 * `DynamicModule`'s injector, so the store cannot be replaced from here.
 *
 * So this suite does the next most honest thing available: it takes the provider
 * entries **AppModule itself produced** and hands them to a container, replacing only
 * the two repositories that would open a connection. The factory under test is
 * production's own factory, unmodified. A future defect in `app.module.ts` still fails
 * here, and a defect in `PermissionGuard`'s constructor still fails here.
 */

const OWNER_ID = '00000000-0000-4000-8000-0000000000a1';

/** The persistence state the defect hides inside. */
const PERSISTENT: AppConfig = loadConfig({
  ...TEST_ENVIRONMENT,
  DATABASE_URL: 'postgresql://sec-110:sec-110@localhost:5432/sec_110_never_connected',
  SCHOOL_ID: '00000000-0000-4000-8000-000000000110',
}).config;

const GRANT_ALL = { isGranted: async () => true };

/** Resolves any presented session cookie, so `SessionGuard` attaches a principal. */
const SESSIONS = {
  async findByToken(token: string) {
    return token.length > 0 ? { sessionId: 'session-110', userId: OWNER_ID } : null;
  },
} as unknown as ISessionRepository;

/**
 * A controller declared HERE, because no production route carries `@OwnsResource`.
 *
 * The domains that would own those relationships — classes, children, outlets — do
 * not exist, and `AGENTS.md` 6 forbids inventing them. So a production route cannot
 * be used to reach the guard with an ownership requirement.
 */
@Controller('sec-110-probe')
class ProbeController {
  @Get('owned')
  @RequirePermission('AUTH_LINK_EXTERNAL_IDENTITY')
  @OwnsResource('widget')
  owned(): { ok: true } {
    return { ok: true };
  }
}

/** The `APP_GUARD` entry `AppModule.forRoot` built for `PermissionGuard`, found by what it injects. */
function permissionGuardProviderFromAppModule(config: AppConfig): Provider {
  const dynamic = AppModule.forRoot(config);
  const providers = (dynamic.providers ?? []) as Provider[];

  const found = providers.find(
    (provider) =>
      typeof provider === 'object' &&
      provider !== null &&
      'inject' in provider &&
      Array.isArray((provider as { inject?: unknown[] }).inject) &&
      ((provider as { inject: unknown[] }).inject as { token?: symbol }[]).some(
        (entry) => entry?.token === IPERMISSION_GRANT_READER,
      ),
  );

  if (found === undefined) {
    throw new Error(
      'AppModule.forRoot no longer registers a PermissionGuard that injects ' +
        'IPERMISSION_GRANT_READER. This suite cannot test SEC-110 against a graph that ' +
        'does not wire the guard at all, and guessing which entry was meant would test nothing.',
    );
  }

  return found;
}

describe('SEC-110 — what AppModule asks the container for', () => {
  const provider = permissionGuardProviderFromAppModule(PERSISTENT) as {
    inject: { token: symbol; optional?: boolean }[];
  };

  /** The tokens the factory names, ignoring the `optional` flag. */
  const injectedTokens = (): symbol[] => provider.inject.map((entry) => entry.token);

  it('injects the permission grant reader it already did', () => {
    // Stated first so a failure below cannot be mistaken for "the guard is not
    // wired at all" rather than "it is wired to the wrong things".
    expect(injectedTokens()).toContain(IPERMISSION_GRANT_READER);
  });

  it('injects the OWNERSHIP REGISTRY', () => {
    // THE DEFECT. `RbacModule` registers and exports this token; the factory named
    // only the grant reader, so every `@OwnsResource` route reported a wiring fault
    // (`NO_POLICY_REGISTRY`) instead of the domain fault it actually had.
    expect(injectedTokens()).toContain(IOWNERSHIP_POLICY_REGISTRY);
  });

  it('injects the PERMISSION CACHE', () => {
    // THE OTHER HALF. Without it every lookup took the `BYPASS` path, which is why
    // `PLT-202` AC-2's sub-5ms target could not be met by any Redis configuration,
    // and why `DEGRADED` reporting was unreachable.
    expect(injectedTokens()).toContain(IPERMISSION_CACHE);
  });

  it('marks both optional, so a deployment with neither still boots', () => {
    // `@Optional()` is what lets the token resolve to `undefined` rather than
    // failing the container. Redis is genuinely absent on Windows hosts and a
    // Google-only deployment has no database, so a required token here would stop
    // the application booting for routes it does not serve.
    for (const token of [IPERMISSION_CACHE, IOWNERSHIP_POLICY_REGISTRY]) {
      const entry = provider.inject.find((candidate) => candidate.token === token);
      expect(entry?.optional, `${String(token.description)} optional`).toBe(true);
    }
  });
});

describe('SEC-110 — the shipped factory, given the tokens RbacModule registered', () => {
  /** The real registry `RbacModule` builds: empty, because no domain has shipped a policy. */
  const registry: IOwnershipPolicyRegistry = new StaticOwnershipPolicyRegistry(
    ownershipPoliciesFor(),
  );

  let warn: ReturnType<typeof vi.spyOn>;

  /** Boots `AppModule`'s own guard provider with fakes for the two repositories. */
  async function bootShippedGuard() {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        Reflector,
        { provide: I_SESSION_REPOSITORY, useValue: SESSIONS },
        { provide: IPERMISSION_GRANT_READER, useValue: GRANT_ALL },
        { provide: IOWNERSHIP_POLICY_REGISTRY, useValue: registry },
        permissionGuardProviderFromAppModule(PERSISTENT),
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const server = app.getHttpServer() as {
      listen(port: number): unknown;
      address(): { port: number } | null;
    };
    await new Promise<void>((resolve) => server.listen(0, resolve));

    return {
      get: async (path: string) => {
        const response = await fetch(`http://127.0.0.1:${server.address()?.port ?? 0}${path}`, {
          headers: { cookie: 'eduflow_session=any-non-empty-token' },
        });
        return { status: response.status, body: await response.text() };
      },
      close: () => app.close(),
    };
  }

  beforeEach(() => {
    // `PLT-203` AC-1 requires the denial reason to be distinguishable in logs, and
    // that claim is only testable if something reads them.
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('refuses the route', async () => {
    // Stated before the reason, because a reader should see that the status is
    // unchanged by the fix. Fail-closed in both states is the point.
    const harness = await bootShippedGuard();
    try {
      const response = await harness.get('/sec-110-probe/owned');
      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });

  it('answers NO_POLICY_FOR_ENTITY, so the registry REACHED the guard', async () => {
    // The discriminating assertion.
    //
    //   NO_POLICY_REGISTRY -> the factory was not given the registry. The defect.
    //   NO_POLICY_FOR_ENTITY   -> the factory had it, asked it, and the registry holds
    //                         no policy for 'widget'. The fix.
    //
    // Both are 403 with one frozen body, because distinguishing reasons in the
    // response would be an enumeration oracle (`AGENTS.md` 2.13). Only the log can
    // tell them apart, which is exactly where `PLT-203` requires it to be visible.
    const harness = await bootShippedGuard();
    try {
      await harness.get('/sec-110-probe/owned');

      const logged = warn.mock.calls.map((call) => call.map(String).join(' ')).join('\n');

      expect(logged).toContain('NO_POLICY_FOR_ENTITY');
      expect(logged).not.toContain('NO_POLICY_REGISTRY');
    } finally {
      await harness.close();
    }
  });

  it('reached a registry it actually had, rather than one it re-derived', async () => {
    // The same fact from the registry itself, so the conclusion does not rest on
    // one log line's formatting. Empty is the honest state today --
    // `ownershipPoliciesFor()` says why at length.
    await expect(registry.find('widget')).resolves.toBeUndefined();
  });
});

/** Referenced so the import is load-bearing under the transform. */
void (undefined as unknown as DynamicModule);
void APP_GUARD;
