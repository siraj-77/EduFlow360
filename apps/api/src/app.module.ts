import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import type { AppConfig } from './config/env.js';
import { AuthModule } from './modules/auth/auth.module.js';

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
      providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
    };
  }
}
