import { Module } from '@nestjs/common';

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
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
