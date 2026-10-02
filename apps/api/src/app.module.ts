import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard.js';

/**
 * Application root module.
 *
 * P2 scope: infrastructure only, no business logic (Prompt Pack P2).
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
 * It is safe to apply globally right now because there are no controllers yet.
 * The first controller added inherits it.
 *
 * Note this is a *fourth*, orthogonal control. The three AGENTS.md 2.3
 * requires are permission, entitlement and audit; this one asks only whether
 * the request could have been made by a browser the user did not intend to
 * make it. It enforces none of the other three.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
