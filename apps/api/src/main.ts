import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { bootBanner, loadConfig } from './config/env.js';
import { loadEnvFiles, workspaceEnvFilePaths } from './config/env-files.js';
import { AppModule } from './app.module.js';

/**
 * EduFlow API entry point.
 *
 * Configuration is validated BEFORE the Nest application is created, so
 * an invalid environment fails with a readable message instead of a
 * dependency-injection error twenty frames deep (AGENTS.md 11).
 */
async function bootstrap(): Promise<void> {
  /**
   * The workspace `.env` files are read FIRST, before validation.
   *
   * Until 2026-10-02 nothing did this, so the instruction in `env.ts`'s own
   * error message - "cp .env.example .env, then fill in the values" - led a
   * developer to a configuration the application then could not see. It was
   * found when real Google credentials sat complete in `.env.local` and the
   * API would never have read them.
   *
   * Order matters and is not negotiable: load, then validate. Loading after
   * `loadConfig()` would validate an environment that is missing everything
   * the files are about to supply.
   */
  const envFiles = loadEnvFiles({ paths: workspaceEnvFilePaths() });

  const loaded = loadConfig();

  // eslint-disable-next-line no-console
  console.log(
    bootBanner(loaded, {
      envFilesLoaded: envFiles.loaded,
    }).join('\n'),
  );

  // `forRoot` rather than the class: `AuthModule` needs the validated
  // configuration, and `loadEnvFiles()` above has only just made the environment
  // readable. Passing it in is what keeps module wiring after that read instead
  // of at import time.
  const app = await NestFactory.create(AppModule.forRoot(loaded.config), { bufferLogs: true });

  // The API is a separate service. It serves JSON only; the web app is UI
  // (AGENTS.md 3.1). CORS is scoped to the local web origin until a
  // deployment-specific origin is configured.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3500' });

  app.enableShutdownHooks();
  await app.listen(loaded.config.PORT);
}

void bootstrap();
