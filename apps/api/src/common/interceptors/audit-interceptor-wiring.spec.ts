import { APP_INTERCEPTOR, type DynamicModule, type Provider } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { IAUDIT_REPOSITORY } from '../../modules/audit/domain/repositories/audit-repository.js';
import { IREASON_POLICY } from '../../modules/audit/domain/ports/reason-policy.js';
import { testConfig } from '../../testing/test-environment.js';

/**
 * The production wiring, asserted the way `permission-guard-production-wiring.spec.ts`
 * asserts its own (`PLT-402`).
 *
 * ## Why a wiring spec exists at all, in this repository specifically
 *
 * `SEC-110` is the reason, recorded in `app.module.ts`: a guard whose optional
 * dependencies were registered and injected into nothing failed
 * *visibly-invisibly* — everything still refused correctly, so every suite
 * stayed green while two of four dependencies were silently unwired. The only
 * test that can catch that class of defect is one that reads the REAL
 * registration and checks the token names. This is that test, for the
 * interceptor.
 *
 * ## What it checks, precisely
 *
 * 1. `AppModule.forRoot` actually registers an `APP_INTERCEPTOR` — a control
 *    that exists but is not registered is the failure this file exists for;
 * 2. the factory's `inject` list names BOTH optional tokens, because a
 *    `useFactory` without `inject` resolves its dependencies as `undefined`
 *    and every `@Audited` route would then be refused for a wiring reason
 *    that no other suite would notice;
 * 3. calling the factory produces a real `AuditInterceptor`, including in the
 *    no-database state where both dependencies are `undefined`.
 *
 * ## The token import, and the trap it names
 *
 * `APP_INTERCEPTOR` is imported from `@nestjs/core`, NOT `@nestjs/common`.
 * Both declare it; only core re-exports it at runtime — common's `index.js`
 * re-exports four constants and this is not one of them, so importing it from
 * there yields `undefined` while `tsc`, lint and the build all pass. The same
 * trap `audit.interceptor.ts` documents for `PATH_METADATA`, and worth stating
 * again because the failure is a provider keyed on `undefined`.
 */

interface InterceptorProvider {
  provide: unknown;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: readonly unknown[];
}

const appModule: DynamicModule = AppModule.forRoot(testConfig());

/** The APP_INTERCEPTOR provider, exactly as `app.module.ts` registers it. */
const interceptorProvider = (): InterceptorProvider =>
  (appModule.providers ?? []).find(
    (provider): provider is Provider =>
      typeof provider === 'object' &&
      provider !== null &&
      'provide' in provider &&
      (provider as { provide: unknown }).provide === APP_INTERCEPTOR,
  ) as unknown as InterceptorProvider;

describe('the audit interceptor is wired into the application root', () => {
  it('registers exactly one APP_INTERCEPTOR, and it is the audit one', () => {
    const provider = interceptorProvider();

    expect(provider).toBeDefined();
    expect(provider.useFactory).toBeDefined();
  });

  it('names both optional dependencies in the inject list', () => {
    const provider = interceptorProvider();

    // An `APP_INTERCEPTOR` with a `useFactory` and no `inject` gets an EMPTY
    // argument list, because an arrow function carries no
    // `design:paramtypes` — the `AuthModule` bug this repository already
    // shipped once at `IOIDC_STATE_STORE`: a 500 on the first request with a
    // green build.
    expect(provider.inject).toEqual([
      { token: IAUDIT_REPOSITORY, optional: true },
      { token: IREASON_POLICY, optional: true },
    ]);
  });

  it('builds a real AuditInterceptor from the registered factory', () => {
    const provider = interceptorProvider();

    // Called with both dependencies UNDEFINED — the no-database state. The
    // interceptor must still construct, and the routes it guards must still
    // be refused by name rather than crashing the container.
    const built = provider.useFactory?.(undefined, undefined);

    expect(built).toBeInstanceOf(AuditInterceptor);
  });

  it('registers AuditModule, so the repository has a home in the graph', () => {
    // `imports` holds DynamicModules, not classes: each `forRoot` returns an
    // object with a `module` property, which is where the name lives.
    const imported = (appModule.imports ?? []).map((entry) => {
      const module = (entry as { module?: { name?: string } }).module;
      return module?.name ?? typeof entry;
    });

    expect(imported).toContain('AuditModule');
  });
});
