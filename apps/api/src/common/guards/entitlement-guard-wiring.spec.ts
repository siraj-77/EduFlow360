import { APP_GUARD, type DynamicModule, type Provider } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { EntitlementGuard } from './entitlement.guard.js';
import { I_LICENCE_PAYLOAD_CACHE } from '../../modules/licensing/domain/ports/licence-payload-cache.js';
import { testConfig } from '../../testing/test-environment.js';

/**
 * The entitlement guard's production wiring, in the shape
 * `permission-guard-production-wiring.spec.ts` established (`PLT-302`).
 *
 * ## Why the same reasoning applies to the fourth guard
 *
 * `SEC-110` recorded what this pattern is for: a guard whose optional
 * dependencies were registered and injected into nothing failed
 * *visibly-invisibly* — every suite stayed green while the dependency sat
 * unwired. `EntitlementGuard` has exactly that shape (one optional token, a
 * factory, no `useClass`), so exactly that class of defect is the one to
 * catch: a factory without `inject` gets an empty argument list and EVERY
 * feature-gated route would refuse for a wiring reason nothing else notices.
 */

const appModule: DynamicModule = AppModule.forRoot(testConfig());

/** Every APP_GUARD provider the real module registers. */
const guardProviders = (): readonly Provider[] =>
  ((appModule.providers ?? []) as readonly Provider[]).filter(
    (provider): provider is Provider =>
      typeof provider === 'object' &&
      provider !== null &&
      'provide' in provider &&
      (provider as { provide: unknown }).provide === APP_GUARD,
  );

interface GuardProvider {
  provide: unknown;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: readonly unknown[];
}

/**
 * The APP_GUARD whose factory builds the EntitlementGuard.
 *
 * Found by its inject list rather than its position: `SessionGuard` and
 * `PermissionGuard` are also factories, and matching on "the first factory"
 * would assert whatever happened to be registered first — the very drift a
 * wiring spec exists to catch.
 */
const entitlementProvider = (): GuardProvider =>
  (guardProviders() as unknown as GuardProvider[]).find((provider) =>
    (provider.inject ?? []).some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as { token?: unknown }).token === I_LICENCE_PAYLOAD_CACHE,
    ),
  ) as GuardProvider;

describe('the entitlement guard is wired into the application root', () => {
  it('is one of the four APP_GUARD providers, and the fourth of them', () => {
    // `AGENTS.md` §2.3's composition, and the ORDER is the assertion: CSRF,
    // Session, Permission, Entitlement. A guard that ran before
    // `PermissionGuard` would answer about licences for callers who were
    // never allowed near the route.
    const providers = guardProviders() as unknown as GuardProvider[];

    expect(providers).toHaveLength(4);
    // The LAST one — its position in the array is its position in the chain.
    expect(entitlementProvider()).toBe(providers[3]);
  });

  it('names the licence cache in its inject list, optional', () => {
    const provider = entitlementProvider();

    // Without the inject list, `useFactory` receives an empty argument array
    // — the `IOIDC_STATE_STORE` bug class, one token deep.
    expect(provider.inject).toEqual([{ token: I_LICENCE_PAYLOAD_CACHE, optional: true }]);
  });

  it('builds a real EntitlementGuard, including in the no-cache state', () => {
    // Called with the cache UNDEFINED, which is what a database-less
    // deployment resolves to. The guard must still construct — the container
    // must still boot — and every feature-gated route must still be refused
    // by name rather than crashing.
    const built = entitlementProvider().useFactory?.(undefined);

    expect(built).toBeInstanceOf(EntitlementGuard);
  });

  it('registers LicensingModule, so the cache has a home in the graph', () => {
    const imported = (appModule.imports ?? []).map((entry) => {
      const module = (entry as { module?: { name?: string } }).module;
      return module?.name ?? typeof entry;
    });

    expect(imported).toContain('LicensingModule');
  });
});
