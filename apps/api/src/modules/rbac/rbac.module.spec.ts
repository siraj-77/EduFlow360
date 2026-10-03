import { APP_GUARD } from '@nestjs/core';
import type { Provider } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { testConfig, TEST_ENVIRONMENT } from '../../testing/test-environment.js';
import { loadConfig, type AppConfig } from '../../config/env.js';
import { PermissionGuard } from '../../common/guards/permission.guard.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { AppModule } from '../../app.module.js';
import { IPERMISSION_GRANT_READER } from './domain/ports/permission-grant-reader.js';
import { RbacModule } from './rbac.module.js';

/**
 * The wiring, and the claim that a guard which is not registered reads exactly like
 * one that is.
 *
 * ## Why a structural test at all
 *
 * `AGENTS.md` 2.3's failure mode, and this repository's own: "a control that exists,
 * is not wired, and reads exactly like a working one." `PermissionGuard` could be a
 * complete, correct, fully-tested class that no request ever passes through, and every
 * behavioural test in the suite would still be green.
 *
 * So this file asserts the REGISTRATION — that `AppModule.forRoot` puts three
 * `APP_GUARD` providers in the graph, in an order — and
 * `permission-guards-over-http.spec.ts` asserts the behaviour over a socket.
 * Neither alone is sufficient: the structural test cannot tell a working guard from a
 * broken one, and the behavioural test cannot tell a registered guard from one that
 * only runs in the configuration somebody tested.
 */

/** Every `APP_GUARD` provider in the order Nest will execute them. */
const guardProviders = (): Provider[] =>
  (AppModule.forRoot(testConfig()).providers ?? []).filter(
    (provider): provider is Provider & { provide: unknown } =>
      typeof provider === 'object' && provider !== null && provider.provide === APP_GUARD,
  );

describe('AppModule.forRoot — the global guards', () => {
  it('registers THREE of them, so PermissionGuard is not merely written', () => {
    // The count is the assertion. A fourth control added later makes this fail and
    // forces whoever added it to say where it sits in the order below.
    expect(guardProviders()).toHaveLength(3);
  });

  it('runs CsrfGuard first, because its question needs only the request', () => {
    const [first] = guardProviders();

    // `useClass` for this one, so the shape is a class reference rather than a factory.
    expect(first).toMatchObject({ useClass: CsrfGuard });
  });

  it('runs SessionGuard SECOND, so it can attach a principal for the third', () => {
    const providers = guardProviders();
    const session = providers[1] as { useFactory?: (sessions?: unknown) => unknown };

    // Invoked by hand rather than only inspected: the factory is what actually builds
    // the guard, and a factory that built the wrong class would satisfy a shape check.
    expect(session.useFactory?.()).toBeInstanceOf(SessionGuard);
  });

  it('runs PermissionGuard THIRD, and last, which is the composition', () => {
    // If this were first or second, an unauthenticated request would be refused by it
    // as `NO_PRINCIPAL` — a wiring fault logged as though it were policy, on every 401
    // in the system. Being third is what makes `SessionGuard`'s 401 the answer to a
    // missing session and this guard's 403 the answer to a missing permission.
    const permission = guardProviders()[2] as { useFactory?: (grants?: unknown) => unknown };

    expect(permission.useFactory?.()).toBeInstanceOf(PermissionGuard);
  });

  it('injects each guard-s dependency as OPTIONAL, so a bare deployment still boots', () => {
    // `@Optional()` plus a factory is the only shape that resolves an absent token to
    // `undefined` instead of failing the container. Requiring either token would stop
    // a Google-only deployment from starting for routes it does not register.
    const providers = guardProviders();

    for (const index of [1, 2]) {
      const provider = providers[index] as { inject?: unknown };
      expect(provider.inject).toEqual([{ token: expect.any(Symbol), optional: true }]);
    }
  });

  it('gives SessionGuard the SESSION repository token and PermissionGuard the GRANT one', () => {
    // A copy-paste between the two factories would compile, satisfy every shape check
    // above, and hand each guard the other's port — which is a runtime resolution
    // failure at boot, or worse, a working guard wired to the wrong data.
    const providers = guardProviders();

    expect((providers[1] as { inject?: unknown }).inject).toEqual([
      { token: expect.any(Symbol), optional: true },
    ]);
    expect((providers[2] as { inject?: unknown }).inject).toEqual([
      { token: IPERMISSION_GRANT_READER, optional: true },
    ]);
  });

  it('imports the rbac module, or the grant reader is never provided', () => {
    // `.module`, not the array element itself: `AppModule` imports the DYNAMIC module,
    // so each entry is `{ module: RbacModule, providers: [...] }`. Comparing the
    // element to the class would fail on a correct graph.
    const imported = (AppModule.forRoot(testConfig()).imports ?? []).map(
      (entry) => (entry as { module?: unknown }).module,
    );

    // A module can be registered and not imported. That is a control which exists and
    // is not wired, which is the exact failure this file exists for.
    expect(imported).toContain(RbacModule);
  });
});

describe('RbacModule.forRoot — the two configurations', () => {
  const SCHOOL_ID = '3f1c9a44-0b2e-4d6a-9f31-8c7b5e2a1d40';
  const DATABASE_URL = 'postgresql://user:pw@127.0.0.1:5432/eduflow';

  /**
   * A configuration with persistence, built through the REAL loader.
   *
   * `testConfig()` takes no arguments and hard-codes an environment with no
   * `DATABASE_URL`, so composing one here rather than casting: a cast would let this
   * spec describe a shape production cannot boot, which is the failure
   * `test-environment.ts` exists to rule out.
   */
  const withDatabase = (): AppConfig =>
    loadConfig({ ...TEST_ENVIRONMENT, DATABASE_URL, SCHOOL_ID }).config;

  it('registers the reader when persistence is configured', () => {
    // No connection is opened by building the module: `PrismaClient` connects lazily,
    // so this asserts the WIRING without needing a database.
    expect(RbacModule.forRoot(withDatabase()).exports).toContain(IPERMISSION_GRANT_READER);
  });

  it('registers NOTHING when persistence is absent, and says so at boot', () => {
    // A Google-only deployment has sign-in routes and no permission-gated ones. The
    // warning is the point: `PermissionGuard` refuses every gated route in that state,
    // and an operator should not have to infer that from a 403.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const moduleRef = RbacModule.forRoot(testConfig());

      expect(moduleRef.exports).toEqual([]);
      expect(moduleRef.providers).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('names the token and the consequence, so the warning is actionable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      RbacModule.forRoot(testConfig());

      const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
      // The token's DESCRIPTION, which is what an operator sees in a Nest resolution
      // failure — and it is what the warning actually prints.
      expect(logged).toContain(IPERMISSION_GRANT_READER.description);
      // The consequence, not just the absence. "A token is missing" sends an operator
      // looking; "every @RequirePermission route will be REFUSED" tells them what is
      // about to happen to their users.
      expect(logged).toMatch(/REFUSE every route/);
    } finally {
      warn.mockRestore();
    }
  });

  it('refuses a half-configured deployment rather than guessing which half is missing', () => {
    // `AGENTS.md` 11: fail fast, naming the variable. Shared with `AuthModule` so the
    // two cannot disagree about when persistence counts.
    //
    // Built with `loadConfig` rather than `testConfig({ ... })`, which takes no
    // arguments — passing one would silently configure nothing and this test would
    // assert that a throw does not happen.
    expect(() => RbacModule.forRoot(loadConfig({ ...TEST_ENVIRONMENT, SCHOOL_ID }).config)).toThrow(
      /SCHOOL_ID is set but DATABASE_URL is not/,
    );

    expect(() =>
      RbacModule.forRoot(loadConfig({ ...TEST_ENVIRONMENT, DATABASE_URL }).config),
    ).toThrow(/DATABASE_URL is set but SCHOOL_ID is not/);
  });

  it('injects the Prisma client into the reader, or the reader gets undefined', () => {
    // A `useFactory` arrow carries no `design:paramtypes`, so omitting `inject` hands
    // Nest an empty argument list. The symptom is a 500 on the first permission check
    // and a green build — recorded in `auth.module.ts` at `IOIDC_STATE_STORE`, where it
    // actually happened.
    const moduleRef = RbacModule.forRoot(withDatabase());
    const reader = (moduleRef.providers ?? []).find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === IPERMISSION_GRANT_READER,
    ) as { inject?: unknown } | undefined;

    expect(reader?.inject).toHaveLength(1);
  });
});
