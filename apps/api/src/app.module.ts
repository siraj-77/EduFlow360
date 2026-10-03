import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { SessionGuard } from './common/guards/session.guard.js';
import type { AppConfig } from './config/env.js';
import { AuthModule, I_SESSION_REPOSITORY } from './modules/auth/auth.module.js';
import type { ISessionRepository } from './modules/auth/domain/ports/session-repository.js';

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
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [AuthModule.forRoot(config)],
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
      ],
    };
  }
}
