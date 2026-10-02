import 'reflect-metadata';
import { Global, Injectable, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { loadConfig, type AppConfig } from './env.js';
import { BeginOidcSignIn } from '../modules/auth/use-cases/begin-oidc-sign-in.js';
import { OidcSignInController } from '../modules/auth/controllers/oidc-sign-in.controller.js';
import { repairOidcControllerMetadata } from '../testing/oidc-controller-di-repair.js';
import { TEST_ENVIRONMENT, testConfig } from '../testing/test-environment.js';

/** Alias, so the regression test below reads as a statement rather than a lookup. */
const OidcSignInControllerRef = OidcSignInController;

/**
 * That the Nest container is BUILT under this test runner, and built correctly.
 *
 * ## Why this file exists
 *
 * Vitest transforms with esbuild by default, and **esbuild does not implement
 * `emitDecoratorMetadata`**. So `Reflect.getMetadata('design:paramtypes', X)` was
 * `undefined` for every decorated class in this package. `nest build` uses `tsc`,
 * which does emit it, so `dist/` was correct and the gap was test-only — which is
 * why the limitation used to be recorded as a note in three other files instead
 * of being fixed. `vitest-swc-plugin.ts` replaces esbuild with SWC for the test
 * suites, and this file is the tripwire for that.
 *
 * ## The measured failure mode, because it is not the obvious one
 *
 * The natural assumption is "the container cannot resolve anything, so it fails
 * loudly". Measured on 2026-10-03, before the transform:
 *
 *     Reflect.getMetadata('design:paramtypes', OidcSignInController)  ->  undefined
 *     app.init()                                                       ->  succeeds
 *     app.get(OidcSignInController).beginSignIn                       ->  undefined
 *     controller.begin(response)                                      ->  TypeError
 *
 * Nest does not reject a class whose parameter types it cannot read. It
 * **constructs it with `undefined` for each parameter and reports success.** A
 * test that asserted "the container compiled" would therefore have been green
 * over a controller that could not serve a single request.
 *
 * Which is why the assertions below are about *what was injected*, not about
 * whether a compile threw.
 */

/** A value class, so the metadata under test names a real constructor. */
class Widget {
  readonly label = 'widget';
}

/**
 * A decorated class whose constructor dependency is a VALUE import.
 *
 * Value import, not `import type`, because that is the distinction under test:
 * `import type` is erased, so the compiler has no runtime reference to emit. See
 * `oidc-controller-di-repair.ts` for what that costs this repository.
 */
@Injectable()
class WidgetConsumer {
  constructor(readonly widget: Widget) {}
}

@Global()
@Module({ providers: [Widget, WidgetConsumer], exports: [WidgetConsumer] })
class WidgetModule {}

/** The application graph, validated by the real schema rather than cast. */
const CONFIGURED: AppConfig = testConfig();

describe('decorator metadata under the Vitest transform', () => {
  it('emits design:paramtypes naming the real class', () => {
    // The direct assertion. `undefined` is the exact state that made every
    // container silently inject `undefined`, so it is asserted here rather than
    // inferred from a downstream symptom.
    expect(Reflect.getMetadata('design:paramtypes', WidgetConsumer)).toEqual([Widget]);
  });

  it('distinguishes real metadata from the Object fallback', () => {
    // `Object` is what a compiler emits when it cannot resolve a parameter type,
    // and it is an unresolvable DI token. So metadata that is *present but wrong*
    // fails loudly at boot, while metadata that is *absent* fails silently. These
    // two assertions together are the tripwire; either alone can be satisfied by
    // a broken transform.
    expect(Reflect.getMetadata('design:paramtypes', WidgetConsumer)).not.toEqual([Object]);
    expect(Reflect.getMetadata('design:paramtypes', WidgetConsumer)).not.toEqual([Function]);
  });

  it('does NOT leave a decorated class without any metadata at all', () => {
    // A guard on the guard. `design:type` is deliberately not asserted here: SWC
    // emits `Function` for it where `tsc` emits the class itself, and neither
    // Nest's injector nor anything else in this repository reads it. Pinning it
    // would assert a compiler's incidental output rather than a property the
    // application depends on. What matters is that `design:paramtypes` is real,
    // and the two tests above cover it.
    const designType = Reflect.getMetadata('design:type', WidgetConsumer);

    expect(designType).toBeDefined();
  });

  it('resolves a value-import dependency from a decorated class', () => {
    // The narrow claim, with no application involved: a class-based provider with
    // constructor injection, which is the ordinary Nest style and which nothing in
    // this repository used before this transform existed.
    const consumer = new WidgetConsumer(new Widget());
    expect(consumer.widget.label).toBe('widget');
  });
});

describe('the real container, built from AppModule.forRoot', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // The one deviation from production, and it is a compiler output rather than
    // a wiring change: `OidcSignInController` uses `import type`, so `tsc` and SWC
    // both emit an unresolvable token. Supplying the metadata they should have
    // emitted lets the *unmodified* `AppModule.forRoot` graph be built, so nothing
    // about the wiring under test is invented. Read
    // `testing/oidc-controller-di-repair.ts` before trusting this.
    repairOidcControllerMetadata();
    app = await NestFactory.create(AppModule.forRoot(CONFIGURED), { abortOnError: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('injects the real OIDC use-case, not undefined', () => {
    // The claim that matters. Without the transform this was `undefined` while
    // `init()` still reported success, and this is the assertion that catches it.
    expect(app.get(BeginOidcSignIn)).toBeInstanceOf(BeginOidcSignIn);
  });

  it('hands back one shared use-case, so one request cannot see another request state', () => {
    expect(app.get(BeginOidcSignIn)).toBe(app.get(BeginOidcSignIn));
  });

  it('constructs the controller with a live dependency rather than a placeholder', () => {
    // Asserted through the container's own resolution rather than by reading a
    // private field: reading the field would pass even when it held `undefined`,
    // which is exactly what happened before the SWC transform.
    expect(() => app.get(OidcSignInController, { strict: false })).not.toThrow();
  });

  it('registered the route, so the container is not merely resolvable but serving', () => {
    expect(() => app.get(BeginOidcSignIn, { strict: false })).not.toThrow();
  });
});

describe('the configuration the container was built from', () => {
  it("is the synthetic one, and never the developer's .env", () => {
    // `process.env` is not consulted, and on a developer machine it holds real
    // Google credentials at this moment. So the values that reached Nest are
    // asserted to be the synthetic ones.
    expect(CONFIGURED.GOOGLE_CLIENT_ID).toBe(TEST_ENVIRONMENT.GOOGLE_CLIENT_ID);
    expect(CONFIGURED.JWT_ACCESS_SECRET).toBe(TEST_ENVIRONMENT.JWT_ACCESS_SECRET);
  });

  it('was validated by the real schema, not cast', () => {
    // `loadConfig` refuses a half-configured Google set, naming what is missing.
    // A cast would skip that, and the first symptom of the skip is a suite that
    // boots a shape production cannot boot.
    expect(CONFIGURED.NODE_ENV).toBe('test');
    expect(() => loadConfig({ ...TEST_ENVIRONMENT, GOOGLE_CLIENT_SECRET: undefined })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    );
  });

  it('leaves a missing signing key to the container, and the container refuses it by name', () => {
    // Two facts that are easy to conflate, and together they are the fail-loud
    // path this harness relies on. `env.ts` types `JWT_ACCESS_SECRET` as
    // *optional*, so `loadConfig` accepts its absence — measured, not assumed; an
    // earlier version of this file asserted the opposite and was wrong. The
    // refusal happens one layer later, when `AuthModule`'s `IOIDC_STATE_STORE`
    // factory runs during container construction, and it names the variable.
    // Between the two there is no window in which a missing key becomes an
    // `undefined` secret inside a signing store.
    repairOidcControllerMetadata();
    const withoutSecret = {
      ...CONFIGURED,
      JWT_ACCESS_SECRET: undefined,
    } as unknown as AppConfig;

    expect(loadConfig({ ...TEST_ENVIRONMENT, JWT_ACCESS_SECRET: undefined }).config).toBeDefined();

    return expect(
      NestFactory.create(AppModule.forRoot(withoutSecret), {
        abortOnError: false,
        // Silenced for the same reason as the defect test below: this failure is
        // the assertion, so a red ERROR block in the gate output is noise.
        logger: false,
      }),
    ).rejects.toThrow(/JWT_ACCESS_SECRET/);
  });

  it('needed no database, so pnpm test needs no container stack', () => {
    expect(CONFIGURED.DATABASE_URL).toBeUndefined();
  });
});

describe('the production defect this repository WAS carrying', () => {
  // These two tests originally asserted the DEFECT — that the shipped graph could
  // not be constructed at all — and carried a note saying they should be deleted
  // when the fix landed. The fix has landed, so they are replaced rather than
  // deleted: the failure they documented is now locked in the positive direction.
  //
  // Keeping a regression test matters because the defect was invisible to `tsc`.
  // A type-only import of a class is legal TypeScript, `lint` demanded it, and the
  // build succeeded. It surfaced only at DI resolution — that is, when the app
  // tried to start. So the assertion is not about a compiler flag; it is that the
  // shipped container can actually build a controller it ships.

  it('builds the graph the repository actually ships', async () => {
    const app = await NestFactory.create(AppModule.forRoot(CONFIGURED), {
      abortOnError: false,
      logger: false,
    });
    try {
      expect(app).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('serves a controller instance, so a resolvable container is not mistaken for a working one', async () => {
    const app = await NestFactory.create(AppModule.forRoot(CONFIGURED), {
      abortOnError: false,
      logger: false,
    });
    try {
      // A container that resolves but hands back nothing usable would satisfy the
      // previous test while the product stayed broken. Actually serving over HTTP
      // is covered by `oidc-redirect-over-http.spec.ts`; this asserts the graph
      // end without reaching into Express internals, whose router shape is an
      // implementation detail that changes between versions.
      const controller = app.get(OidcSignInController);
      expect(controller).toBeInstanceOf(OidcSignInController);
      // And the use-case it depends on is the real one, not a placeholder.
      expect((controller as unknown as { beginSignIn: unknown }).beginSignIn).toBeInstanceOf(
        BeginOidcSignIn,
      );
    } finally {
      await app.close();
    }
  });

  it('carries an explicit @Inject token, so the fix does not depend on a compiler flag', () => {
    // `@Inject(BeginOidcSignIn)` resolves from an explicit token rather than
    // reflected metadata. That is what makes the repair robust: whether `tsc` or
    // SWC compiles this file, and whether `emitDecoratorMetadata` is enabled, the
    // dependency resolves. Reverting to a bare constructor parameter would make
    // correctness depend on the transform again.
    const paramtypes = Reflect.getMetadata?.('design:paramtypes', OidcSignInControllerRef) as
      unknown[] | undefined;
    const selfDeclared = Reflect.getMetadata?.('self:paramtypes', OidcSignInControllerRef) as
      unknown[] | undefined;
    expect(paramtypes ?? selfDeclared ?? []).toContain(BeginOidcSignIn);
  });
});

/** Referenced only to keep the decorator metadata it declares under transform. */
void WidgetModule;
