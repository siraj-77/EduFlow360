import 'reflect-metadata';
import { bootBanner, loadConfig } from './config/env.js';
import { loadEnvFiles, workspaceEnvFilePaths } from './config/env-files.js';
import { createApp } from './create-app.js';

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

  // The application is built by `createApp()` in `create-app.ts`, not here, and
  // the reason is ordering rather than style. `bootstrap()` is invoked at module
  // scope (`void bootstrap()` on the last line), so a test importing this file
  // would start a real server on `PORT` before its first assertion. Extracting
  // the creation means a route test calls the very function this entry point
  // calls, rather than a second bootstrap that could differ from the deployed
  // one in ways no test would notice — a second bootstrap is a second thing that
  // can be wrong.
  //
  // Configuration is passed in rather than read here because `AuthModule` needs
  // the *validated* configuration, and `loadEnvFiles()` above has only just made
  // the environment readable. That is the arrangement `AppModule.forRoot`
  // documents as its own reason for taking `AppConfig` as a parameter.
  const app = await createApp({
    config: loaded.config,
    // The allowed origin is a deployment fact, validated by `loadConfig()`
    // above rather than read ambiently here. `createApp` holds no
    // `process.env` read of its own, so a test cannot be perturbed by
    // whatever `WEB_ORIGIN` is in a developer's shell.
    webOrigin: loaded.config.WEB_ORIGIN,
  });

  // `enableShutdownHooks()` is inside `createApp`, not here. Calling it in both
  // places would register every signal handler twice.
  await app.listen(loaded.config.PORT);
}

void bootstrap();
