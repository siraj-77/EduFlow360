import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js';
import type { AppConfig } from './config/env.js';
import { AuthModule, I_SESSION_REPOSITORY } from './modules/auth/auth.module.js';
import type { ISessionRepository } from './modules/auth/domain/ports/session-repository.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { IAUDIT_REPOSITORY } from './modules/audit/domain/repositories/audit-repository.js';
import type { IAuditRepository } from './modules/audit/domain/repositories/audit-repository.js';
import { IREASON_POLICY } from './modules/audit/domain/ports/reason-policy.js';
import type { IReasonPolicy } from './modules/audit/domain/ports/reason-policy.js';
import { IPERMISSION_GRANT_READER } from './modules/rbac/domain/ports/permission-grant-reader.js';
import type { IPermissionGrantReader } from './modules/rbac/domain/ports/permission-grant-reader.js';
import { IPERMISSION_CACHE } from './modules/rbac/domain/ports/permission-cache.js';
import type { IPermissionCache } from './modules/rbac/domain/ports/permission-cache.js';
import {
  IOWNERSHIP_POLICY_REGISTRY,
  type IOwnershipPolicyRegistry,
} from './modules/rbac/domain/ports/ownership-policy.js';
import { RbacModule } from './modules/rbac/rbac.module.js';

/**
 * Application root module.
 *
 * Feature modules are registered here one per epic as they are built
 * (P5 auth, P6 rbac, P7 audit, ...), so the module graph grows visibly
 * rather than appearing all at once. Each module's folder shape is fixed
 * by AGENTS.md section 3: controllers / use-cases / domain /
 * infrastructure / dto.
 *
 * ## CsrfGuard is global, and it is registered here rather than declared
 *
 * `APP_GUARD` applies it to every route with no per-controller opt-in, which
 * is the fail-closed arrangement: a developer adding a new `POST` route gets
 * the check for free, and cannot forget it. Opt-in registration has the exact
 * failure `route-guards.decorator.ts` documents about itself — a control whose
 * absence from a file is invisible in review.
 *
 * The first controller has now landed, and it inherits this: `GET` is in the
 * safe-method allow-list, so `GET /auth/oidc/redirect` is reachable without a
 * CSRF header, and any future `POST` on the same controller is not.
 *
 * Note this is a *fourth*, orthogonal control. The three AGENTS.md 2.3
 * requires are permission, entitlement and audit; this one asks only whether
 * the request could have been made by a browser the user did not intend to
 * make it. It enforces none of the other three.
 *
 * ## `SessionGuard` is ALSO global, and it is the fifth
 *
 * Before it existed, `ISessionRepository.findByToken` had no caller and
 * "an authenticated route" had no mechanism behind the phrase. Now every
 * route without a `@Public` marker must present a live session, and
 * `@Public` is the single exemption marker for BOTH `@RequirePermission`
 * and authentication — one convention, one allowlist, reconciled in both
 * directions by `check-route-guards`.
 *
 * It is registered with a factory rather than `useClass` so its
 * `@Optional()` `I_SESSION_REPOSITORY` can actually resolve to `undefined`
 * in a Google-only deployment: `AuthModule` registers no repository without
 * `DATABASE_URL`, and requiring the token would stop the application
 * booting for routes it does not even register. With the token absent the
 * guard **refuses every authenticated route** rather than treating the
 * caller as anonymous.
 *
 * ## Why `forRoot`, and why it takes the configuration
 *
 * Because `AuthModule` needs validated configuration, and because the
 * environment is only readable after `loadEnvFiles()` has run. Both happen in
 * `main.ts`, before `NestFactory.create`, so the configuration is *passed in*
 * rather than read from a closure evaluated while this decorator is applied —
 * which would run at import time, before the env files exist. `auth.module.ts`
 * states that hazard in full; this is the other half of the same decision.
 *
 * ## `AuditInterceptor` is the FIRST registered interceptor, and it is
 * registered globally
 *
 * `@Audited('<ACTION>')` was vocabulary until this existed — the decorator
 * recorded an intention and nothing read it, which `route-guards.decorator.ts`
 * says in its own header. The interceptor is what makes the decorator a
 * control: a developer adding a sensitive action writes the decorator and
 * nothing else, which is `PLT-402`'s acceptance criterion, and which
 * per-controller opt-in registration would quietly not deliver.
 *
 * It is registered LAST among the interceptors because it is the only one,
 * and it runs AFTER all three guards — Nest runs guards before interceptors —
 * which is what lets it read the principal `SessionGuard` attached and the
 * permission `PermissionGuard` checked. A route refused by a guard never
 * reaches it, so a refused request produces no record of an action that did
 * not happen.
 *
 * A factory with an explicit `inject`, for the same reason `SessionGuard`
 * and `PermissionGuard` use one: BOTH dependencies are optional, and a
 * `useFactory` arrow carries no `design:paramtypes`, so an omitted `inject`
 * hands Nest an empty argument list. That is the `AuthModule` bug this
 * repository already shipped once at `IOIDC_STATE_STORE` — a 500 on the first
 * request with a green build — and `audit-interceptor-wiring.spec.ts` is what
 * proves it cannot happen here.
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AuthModule.forRoot(config),
        RbacModule.forRoot(config),
        AuditModule.forRoot(config),
      ],
      providers: [
        { provide: APP_GUARD, useClass: CsrfGuard },
        // `APP_GUARD` with an explicit factory rather than `useClass`, because
        // `SessionGuard` takes an OPTIONAL dependency (`@Optional()`
        // `I_SESSION_REPOSITORY`) and a factory is the shape that can resolve one
        // without the container failing to boot when the token is absent. Both guards
        // run on every route, in this order: the CSRF question is answerable from the
        // request alone, so it is asked first and cheaper.
        //
        // The ORDER is not arbitrary and not tested by accident: `CsrfGuard` was already
        // here, and a second global guard that did not honour `@Public` would make
        // `GET /auth/oidc/redirect` — the only route a browser can reach before a
        // session exists — answer 401 and sign-in would be impossible.
        {
          provide: APP_GUARD,
          useFactory: (sessions?: ISessionRepository) =>
            new SessionGuard(new Reflector(), sessions),
          inject: [{ token: I_SESSION_REPOSITORY, optional: true }],
        },
        // `PermissionGuard` is THIRD, and that position is the whole composition.
        //
        // It does not read the cookie. It reads the principal `SessionGuard` attached to
        // the request, so it must run after it — Nest executes `APP_GUARD` providers in
        // registration order. Reusing the principal rather than re-deriving it avoids a
        // second database round trip per request and, more importantly, avoids two
        // places that independently decide who the caller is: those eventually disagree,
        // and the disagreement is an authentication bypass rather than an outage.
        //
        // Registered the other way round it would STILL refuse, which is the trap worth
        // naming: with this guard first, every unauthenticated request would be refused
        // here as `NO_PRINCIPAL` — a wiring fault logged on every 401 in the system,
        // indistinguishable from policy. The order is asserted over a real socket in
        // `permission-guards-over-http.spec.ts`, not by reading this comment.
        //
        // A factory for the same reason as `SessionGuard`: all THREE of
        // `PermissionGuard`'s optional dependencies must be able to resolve to
        // `undefined` in a deployment that has none of them, without the container
        // failing to boot. `AuthModule` registers no repository without
        // `DATABASE_URL`, and `RbacModule` registers no cache without a Redis
        // client, so requiring any of these tokens would stop the application
        // booting for routes it does not even serve. Each absent token leaves the
        // guard refusing correctly, never allowing.
        //
        // `SEC-110`, and the reason this comment is longer than the code it
        // describes. The factory used to build the guard with TWO of its four
        // arguments:
        //
        //     new PermissionGuard(new Reflector(), grants)
        //
        // `IPERMISSION_CACHE` and `IOWNERSHIP_POLICY_REGISTRY` were registered and
        // exported by `RbacModule` and injected into nothing. Both halves of that
        // failed visibly-invisibly:
        //
        //   - every lookup took the `BYPASS` path, so `PLT-202` AC-2's sub-5ms
        //     target was unreachable however fast Redis was, and `DEGRADED`
        //     reporting could never fire;
        //   - a route declaring `@OwnsResource('<type>')` was refused with
        //     `NO_POLICY_REGISTRY` -- a WIRING fault -- instead of
        //     `NO_POLICY_ENTITY`, which is the fault that means the domain has
        //     not shipped its policy yet.
        //
        // Nothing leaked: both are refusals and both fail closed. The only symptom
        // was being correctly cautious, which is why it survived every suite.
        //
        // Two existing specs could not have caught it.
        // `permission-ownership-over-http.spec.ts` and `permission-cache-over-http.spec.ts`
        // declare `{ provide: APP_GUARD, useClass: PermissionGuard }` in their OWN
        // testing modules, so Nest resolves all four parameters itself and they
        // exercise the guard as it is MEANT to be wired. `nest-dependency-injection.spec.ts`
        // builds the real graph but with `DATABASE_URL` absent, and in that state
        // `RbacModule.forRoot` returns `providers: []`. Every test using the real
        // graph had persistence off; every test with persistence on used a graph it
        // built itself. `permission-guard-production-wiring.spec.ts` holds both at
        // once and asserts these tokens are named here.
        {
          provide: APP_GUARD,
          useFactory: (
            grants?: IPermissionGrantReader,
            cache?: IPermissionCache,
            ownership?: IOwnershipPolicyRegistry,
          ) => new PermissionGuard(new Reflector(), grants, cache, ownership),
          inject: [
            { token: IPERMISSION_GRANT_READER, optional: true },
            { token: IPERMISSION_CACHE, optional: true },
            { token: IOWNERSHIP_POLICY_REGISTRY, optional: true },
          ],
        },
        // `AuditInterceptor` — the first APP_INTERCEPTOR in this application,
        // and the reader for the `@Audited('<ACTION>')` decorator. See the
        // header for why it is a factory and why the inject list is spelled
        // out. Both dependencies are optional so a database-less deployment
        // (ADR-019) still boots; an @Audited route reached without them is
        // refused by name, never silently unrecorded.
        {
          provide: APP_INTERCEPTOR,
          useFactory: (repository?: IAuditRepository, reasonPolicy?: IReasonPolicy) =>
            new AuditInterceptor(new Reflector(), repository, reasonPolicy),
          inject: [
            { token: IAUDIT_REPOSITORY, optional: true },
            { token: IREASON_POLICY, optional: true },
          ],
        },
      ],
    };
  }
}
