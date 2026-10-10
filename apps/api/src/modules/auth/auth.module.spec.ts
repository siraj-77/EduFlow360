import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/env.js';
import { AppModule } from '../../app.module.js';
import {
  AUTHORIZATION_ORIGIN,
  AuthModule,
  IOIDC_PROVIDER,
  IOIDC_STATE_STORE,
} from './auth.module.js';
import { OidcSignInController } from './controllers/oidc-sign-in.controller.js';
import { GoogleOidcProvider } from './infrastructure/adapters/google-oidc-provider.js';
import { HmacOidcStateStore } from './infrastructure/adapters/oidc-state-store.js';
import { SystemClock } from './infrastructure/adapters/system-clock.js';
import { BeginOidcSignIn } from './use-cases/begin-oidc-sign-in.js';

/**
 * That the module graph is wired.
 *
 * ## Why this file exists
 *
 * Because a security control that exists but is not wired reads exactly like a
 * working one, and this repository has a documented history of that. A controller
 * with correct decorators, a use-case with correct tests and a store with a real
 * HMAC are three things that can all be present while
 * `GET /auth/oidc/redirect` answers `404` forever, because nobody registered the
 * controller.
 *
 * ## What this file does NOT cover, as of 2026-10-03
 *
 * **It does not build the Nest container, and that is now a choice rather than a
 * limitation.** When this file was written, Vitest transformed with esbuild and
 * esbuild does not implement `emitDecoratorMetadata`, so
 * `Reflect.getMetadata('design:paramtypes', OidcSignInController)` was
 * `undefined` and every container build failed. `vitest-swc-plugin.ts` replaces
 * esbuild with SWC for the test suites and that is fixed; see
 * `config/nest-dependency-injection.spec.ts` for the mechanism and for the
 * measured failure mode, which was worse than a build error (Nest injected
 * `undefined` and reported success).
 *
 * The container is still not built *here*, because this file's subject is the
 * module's declarative output: which controllers are registered, which
 * factories exist, and what they build from which environment variable. Building
 * the container is `config/nest-dependency-injection.spec.ts`, and driving a route
 * over a real socket is `oidc-redirect-over-http.spec.ts`.
 *
 * ## What these tests assert
 *
 * 1. **Registration** — the controller is in the module that `AppModule` imports.
 * 2. **The factory bodies** — invoked directly, they build the real provider,
 *    the real store and the real origin from the real configuration.
 *
 * The second point now carries a warning rather than a reassurance. On
 * 2026-10-03 the `IOIDC_STATE_STORE` factory was found to be missing its `inject`
 * array, so the container called it with no arguments and the store was built
 * with `clock === undefined`. Every test below passed regardless, because each
 * one invoked the factory by hand and supplied the argument itself. That is the
 * failure mode a hand-invoked factory cannot see and a real container test can,
 * which is the argument for the other two files existing.
 */

const CONFIGURED = {
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/oidc/callback',
  JWT_ACCESS_SECRET: 'localdev-test-signing-key-0123456789',
  OIDC_STATE_TTL_MS: 600_000,
} as unknown as AppConfig;

const UNCONFIGURED = { OIDC_STATE_TTL_MS: 600_000 } as unknown as AppConfig;

/** The factory for one provider token, or a thrown error. */
function factoryFor(config: AppConfig, token: symbol): (arg: unknown) => unknown {
  const provider = (AuthModule.forRoot(config).providers ?? []).find(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'provide' in candidate &&
      candidate.provide === token,
  );

  if (!provider || !('useFactory' in provider) || typeof provider.useFactory !== 'function') {
    throw new Error(`no useFactory registered for ${String(token)}`);
  }
  return provider.useFactory as (arg: unknown) => unknown;
}

describe('AuthModule.forRoot — registration', () => {
  it('registers the controller when Google is configured', () => {
    expect(AuthModule.forRoot(CONFIGURED).controllers).toContain(OidcSignInController);
  });

  it('registers no controller when Google is not configured, so the route is honestly absent', () => {
    // A `404` rather than a `500`. A controller that answers "not configured"
    // would look like a working feature and behave like an outage.
    expect(AuthModule.forRoot(UNCONFIGURED).controllers ?? []).toEqual([]);
  });

  it('says so at boot rather than leaving a 404 unexplained', () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      AuthModule.forRoot(UNCONFIGURED);

      expect(warned).toHaveBeenCalledWith(expect.stringContaining('not registered'));
    } finally {
      warned.mockRestore();
    }
  });

  it('exports the use-case, so the callback can be added beside it later', () => {
    expect(AuthModule.forRoot(CONFIGURED).exports).toContain(BeginOidcSignIn);
  });

  it('injects the three ports the use-case needs, and nothing else', () => {
    const useCase = (AuthModule.forRoot(CONFIGURED).providers ?? []).find(
      (candidate) =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'provide' in candidate &&
        candidate.provide === BeginOidcSignIn,
    );

    expect(useCase).toMatchObject({
      inject: [IOIDC_PROVIDER, IOIDC_STATE_STORE, AUTHORIZATION_ORIGIN],
    });
  });
});

describe('AuthModule.forRoot — the factories, invoked directly', () => {
  it('builds the real Google provider from configuration', () => {
    const provider = factoryFor(CONFIGURED, IOIDC_PROVIDER)(undefined) as GoogleOidcProvider;

    expect(provider).toBeInstanceOf(GoogleOidcProvider);
    expect(provider.key).toBe('google');
  });

  it('derives the one trusted origin from the configured endpoint, and it is https', () => {
    // Derived, not hardcoded in the use-case: `AGENTS.md` 2 forbids a provider
    // named inside a use-case, and this is where the name belongs.
    expect(factoryFor(CONFIGURED, AUTHORIZATION_ORIGIN)(undefined)).toBe(
      'https://accounts.google.com',
    );
  });

  it('builds the real signing store from the injected secret and the configured window', () => {
    const store = factoryFor(
      CONFIGURED,
      IOIDC_STATE_STORE,
    )(new SystemClock()) as HmacOidcStateStore;

    expect(store).toBeInstanceOf(HmacOidcStateStore);
    // A store that signed nothing, or sealed without an expiry, would still be
    // "built" — so drive it once.
    expect(
      store
        .seal({
          // `GET /auth/oidc/redirect` seals sign-in mode. The fixture carries it
          // because the payload is a discriminated union and sign-in is the arm
          // with no account — see `oidc-state-store.ts`.
          mode: 'sign-in',
          state: 's',
          nonce: 'n',
          codeVerifier: 'c',
          redirectUri: 'https://api.school.test/auth/oidc/callback',
        })
        .attributes.expiresAt.getTime(),
    ).toBeGreaterThan(0);
    // And it round-trips, so the sealed value is one this deployment can open —
    // which is the precondition the callback route depends on.
    expect(
      store.open(
        store.seal({
          mode: 'sign-in',
          state: 's',
          nonce: 'n',
          codeVerifier: 'c',
          redirectUri: 'https://api.school.test/auth/oidc/callback',
        }).value,
      )?.mode,
    ).toBe('sign-in');
  });

  it('wires the three ports into a use-case that actually begins a flow', () => {
    // The `BeginOidcSignIn` factory, invoked by hand because the container cannot
    // be built under this runner. Without this, the three-way wiring — provider,
    // store, origin — would be the one join in the graph that no test touches.
    const provider = factoryFor(CONFIGURED, IOIDC_PROVIDER)(undefined) as GoogleOidcProvider;
    const store = factoryFor(
      CONFIGURED,
      IOIDC_STATE_STORE,
    )(new SystemClock()) as HmacOidcStateStore;
    const origin = factoryFor(CONFIGURED, AUTHORIZATION_ORIGIN)(undefined) as string;

    const factory = (AuthModule.forRoot(CONFIGURED).providers ?? []).find(
      (candidate) =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'provide' in candidate &&
        candidate.provide === BeginOidcSignIn,
    );
    if (!factory || !('useFactory' in factory) || typeof factory.useFactory !== 'function') {
      throw new Error('no useFactory registered for BeginOidcSignIn');
    }

    const useCase = factory.useFactory(provider, store, origin) as BeginOidcSignIn;

    return useCase.begin().then((result) => {
      expect(new URL(result.redirectTo).origin).toBe(origin);
      expect(store.open(result.stateCookie.value)).not.toBeNull();
    });
  });

  it.each([
    { label: 'the client id', key: 'GOOGLE_CLIENT_ID' },
    { label: 'the client secret', key: 'GOOGLE_CLIENT_SECRET' },
    { label: 'the redirect uri', key: 'GOOGLE_REDIRECT_URI' },
  ])('refuses a half-configured Google without $label, naming it', ({ key }) => {
    // `env.ts` already rejects a partial set at boot, so this covers
    // configuration that reached the module by another route. The failure it
    // prevents is at the token exchange, as a provider error that reads like
    // Google's fault.
    expect(() =>
      AuthModule.forRoot({ ...CONFIGURED, [key]: undefined } as unknown as AppConfig),
    ).toThrow(new RegExp(key));
  });

  it('refuses to build the store without the signing key, naming it', () => {
    expect(() =>
      factoryFor(
        { ...CONFIGURED, JWT_ACCESS_SECRET: undefined } as unknown as AppConfig,
        IOIDC_STATE_STORE,
      )(new SystemClock()),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});

describe('AppModule.forRoot — the registration that makes the route reachable', () => {
  it('imports the configured auth module', () => {
    const root = AppModule.forRoot(CONFIGURED);
    const imported = (root.imports ?? [])[0] as { module?: unknown; controllers?: unknown[] };

    expect(imported.module).toBe(AuthModule);
    expect(imported.controllers).toContain(OidcSignInController);
  });

  it('keeps CsrfGuard registered globally, so the new controller inherits it', () => {
    // A guard that a new module accidentally drops is the quietest possible
    // regression: nothing fails, the protection is simply gone.
    expect(AppModule.forRoot(CONFIGURED).providers).toEqual(
      expect.arrayContaining([expect.objectContaining({ useClass: expect.any(Function) })]),
    );
  });
});
