import { APP_GUARD } from '@nestjs/core';
import type { Provider } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { testConfig, TEST_ENVIRONMENT } from '../../testing/test-environment.js';
import { loadConfig, type AppConfig } from '../../config/env.js';
import { PermissionGuard } from '../../common/guards/permission.guard.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { I_SESSION_REPOSITORY } from '../auth/auth.module.js';
import { AppModule } from '../../app.module.js';
import { IPERMISSION_GRANT_READER } from './domain/ports/permission-grant-reader.js';
import { IPERMISSION_CACHE } from './domain/ports/permission-cache.js';
import { IOWNERSHIP_POLICY_REGISTRY } from './domain/ports/ownership-policy.js';
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

  it('injects every guard dependency as OPTIONAL, so a bare deployment still boots', () => {
    // `@Optional()` plus a factory is the only shape that resolves an absent token to
    // `undefined` instead of failing the container. Requiring any of them would stop
    // a Google-only deployment from starting for routes it does not register.
    //
    // This asserts the FLAG on every entry rather than the array length, which is the
    // property that matters: an earlier version asserted
    // `inject === [{ token: expect.any(Symbol), optional: true }]` on each guard, which
    // passed while `PermissionGuard` was missing two of its four tokens outright. A
    // length assertion written to match the current wiring would have been the same
    // mistake wearing a different hat, so the count is stated and the flag is checked
    // per entry instead.
    const providers = guardProviders();

    for (const provider of providers) {
      // `CsrfGuard` is registered with `useClass` and legitimately has no `inject`
      // array at all - it takes no optional dependency. Only the factory-registered
      // guards are in scope here.
      const entries = (provider as { inject?: { token: symbol; optional?: boolean }[] }).inject;
      if (entries === undefined) continue;

      for (const entry of entries) {
        expect(entry.optional, `${String(entry.token?.description)} optional`).toBe(true);
      }
    }

    // And the counts, because a guard silently losing a dependency is precisely the
    // defect `SEC-110` records. `SessionGuard` takes one; `PermissionGuard` takes
    // three - the grant reader, the cache, and the ownership registry.
    expect((providers[1] as { inject?: unknown[] }).inject).toHaveLength(1);
    expect((providers[2] as { inject?: unknown[] }).inject).toHaveLength(3);
  });

  it('gives each guard ITS OWN ports, and PermissionGuard all three of its own', () => {
    // A copy-paste between the two factories would compile, satisfy every shape check
    // above, and hand each guard the other's port - which is a runtime resolution
    // failure at boot, or worse, a working guard wired to the wrong data.
    //
    // SEC-110: this assertion previously named ONLY the grant reader for
    // PermissionGuard, and it PASSED, because the factory genuinely asked for only
    // the grant reader. The test recorded the defect as though it were the contract.
    // A test that pins what the code happens to do cannot catch the code being wrong;
    // this one states which ports the guards take, so a factory that drops one fails
    // here.
    const providers = guardProviders();

    expect((providers[1] as { inject?: unknown }).inject).toEqual([
      { token: I_SESSION_REPOSITORY, optional: true },
    ]);
    expect((providers[2] as { inject?: unknown }).inject).toEqual([
      { token: IPERMISSION_GRANT_READER, optional: true },
      { token: IPERMISSION_CACHE, optional: true },
      { token: IOWNERSHIP_POLICY_REGISTRY, optional: true },
    ]);
  });

  it('injects every constructor dependency except the Reflector it builds itself', () => {
    // The general form of the test above, and the one that would have caught SEC-110
    // without anyone having to notice it by hand: require the factory to name a token
    // for each of the guard's constructor parameters.
    //
    // Reflected metadata rather than source inspection, because vitest-swc-plugin.ts
    // makes design:paramtypes real in this suite - nest-dependency-injection.spec.ts
    // is the tripwire for that - so the count read here is the real one.
    //
    // Minus ONE, and the one is the Reflector: the factory constructs it rather than
    // asking the container for it, because a Reflector holds no state worth sharing
    // between guards and `new Reflector()` is what every other guard factory here
    // does. So the invariant is "one injected token per constructor parameter that is
    // not a Reflector", not "the counts are equal" - stating it as equality would
    // have demanded a DI token that does not and should not exist.
    const parameterCount = Reflect.getMetadata?.('design:paramtypes', PermissionGuard)?.length ?? 0;
    const injected = (guardProviders()[2] as { inject?: unknown[] }).inject?.length ?? 0;

    expect(parameterCount).toBeGreaterThan(1);
    expect(injected).toBe(parameterCount - 1);
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

  it('registers the ownership registry when persistence is configured', () => {
    expect(RbacModule.forRoot(withDatabase()).exports).toContain(IOWNERSHIP_POLICY_REGISTRY);
  });

  /**
   * The invariant whose absence let a real boot failure ship.
   *
   * `PLT-203` added `IOWNERSHIP_POLICY_REGISTRY` to `exports` and, by editing accident, not
   * to `providers`. Every test in this file still passed, because they all inspect the
   * object `forRoot` RETURNS rather than the container Nest builds FROM it — and the
   * mismatch only surfaces as `UnknownExportException` when the real module graph is
   * instantiated. `test:integration` caught it, 44 tests down.
   *
   * That is the same shape as the defect `WORKLOG.md` records at `3f8fd23` — "the shipped
   * application could not boot, and nine green gates never noticed" — so the check is
   * asserted structurally here rather than left to a suite that needs a database.
   */
  describe('every exported symbol is also a registered provider', () => {
    const tokensOf = (providers: readonly Provider[] | undefined): unknown[] =>
      (providers ?? [])
        .filter(
          (provider): provider is Provider & { provide: unknown } =>
            typeof provider === 'object' && provider !== null && 'provide' in provider,
        )
        .map((provider) => provider.provide);

    it('holds when persistence IS configured', () => {
      const moduleRef = RbacModule.forRoot(withDatabase());

      for (const exported of moduleRef.exports ?? []) {
        expect(tokensOf(moduleRef.providers)).toContain(exported);
      }
    });

    it('holds when persistence is NOT configured — vacuously, and that is the point', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const moduleRef = RbacModule.forRoot(testConfig());

        expect(moduleRef.exports ?? []).toEqual([]);
      } finally {
        warn.mockRestore();
      }
    });

    it('BOOTS the real container in the persistence configuration', async () => {
      // The assertion that would have caught it immediately. `PrismaClient` connects
      // lazily, so this needs no database — it needs the container, which is where the
      // failure actually lived.
      const { NestFactory } = await import('@nestjs/core');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const app = await NestFactory.create(
          { module: RbacModule, imports: [RbacModule.forRoot(withDatabase())] },
          { abortOnError: false, logger: false },
        );
        await app.init();

        expect(app.get(IOWNERSHIP_POLICY_REGISTRY, { strict: false })).toBeDefined();

        await app.close();
      } finally {
        warn.mockRestore();
      }
    });
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
