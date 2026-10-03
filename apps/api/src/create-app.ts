import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/env.js';

/**
 * The one place the Nest application is created.
 *
 * ## Why this exists
 *
 * `main.ts` is the entry point and it is the *only* caller of `NestFactory.create`
 * in this repository. That was correct until somebody wanted to make a route
 * testable: `main.ts` calls `void bootstrap()` at module scope, so importing it
 * from a test starts a real server on `PORT` before the first assertion runs, and
 * there is no way to intercept that.
 *
 * The two available answers were a second bootstrap for tests, or extracting the
 * one the product uses. A second bootstrap is a second thing that can be wrong:
 * it could enable CORS differently, forget `enableShutdownHooks`, or wire a
 * module graph the deployed application does not have, and every route test would
 * then be evidence about a program nobody runs. So the application's own creation
 * was pulled out, unchanged, and `main.ts` calls it.
 *
 * ## What is deliberately NOT here
 *
 * **Configuration loading.** `loadEnvFiles()` and `loadConfig()` stay in
 * `main.ts`, because they read the developer's `.env` and `.env.local`, and a
 * test must not depend on a git-ignored personal file. Configuration arrives as
 * an argument instead — which is the arrangement `AuthModule.forRoot` already
 * documented as its reason for taking `AppConfig` as a parameter.
 *
 * **Listening.** `app.listen()` is also `main.ts`'s. A test wants an ephemeral
 * port rather than the configured one, and a product that hard-coded its own
 * listener could not be given an ephemeral port by a caller at all.
 *
 * So this function is the whole of "build the app", and nothing else. A test
 * calls exactly the function production calls.
 */

/**
 * CORS origin used when the environment does not name one.
 *
 * Spelled here and passed in by `main.ts`, so this module holds no ambient read
 * of its own: `process.env` is consulted once, in the entry point, where it has
 * always been consulted. A test therefore cannot be perturbed by whatever
 * `WEB_ORIGIN` happens to be in the developer's shell.
 */
export const DEFAULT_WEB_ORIGIN = 'http://localhost:3500';

export interface CreateAppOptions {
  /** Already validated by `loadConfig()`. Never read from `process.env` here. */
  readonly config: AppConfig;
  /** The single browser origin allowed to call this API. */
  readonly webOrigin: string;
}

/**
 * The configuration every built application receives, in one function.
 *
 * Extracted so a test that builds the application a *different way* — see
 * `testing/http-harness.ts`, which may substitute one vendor port through
 * `@nestjs/testing`'s `overrideProvider` — applies the SAME settings rather than
 * re-deriving them. Two functions configuring the same application would be two
 * places for CORS to drift, and a test proving a behaviour against different CORS
 * than production runs is not evidence about production.
 *
 * `bufferLogs` is carried over from `main.ts` unchanged: without it, a module's
 * constructor logs are emitted before Nest's logger exists, which produces the
 * interleaved half-initialised banner `bufferLogs` exists to prevent. It is not a
 * test-only setting, and it belongs to the *builder* rather than to this function
 * because it is an argument to `NestFactory.create`, not something applied after.
 */
export function configureApp(app: INestApplication, options: CreateAppOptions): INestApplication {
  // The API is a separate service. It serves JSON only; the web app is UI
  // (AGENTS.md 3.1). One origin, never a list — a wildcard here would undo the
  // CSRF guard's assumption that only one origin can make a credentialed request.
  app.enableCors({ origin: options.webOrigin });

  app.enableShutdownHooks();

  return app;
}

/**
 * Build the Nest application. Does not listen.
 *
 * ## There is deliberately no seam for substituting the module graph
 *
 * An earlier version of this file took an optional `appModule`, on the theory that
 * a graph which cannot be constructed could not be tested. Nothing uses it: the
 * problem turned out to be *metadata*, not wiring, and the honest fix was to supply
 * the decorator metadata the compiler failed to emit
 * (`testing/oidc-controller-di-repair.ts`) rather than to hand `createApp` a
 * different module. A test-only parameter in the production bootstrap is a
 * permanent invitation to test something other than the product, and the
 * measurement that retired it is recorded in that fixture's file comment.
 *
 * **A test that needs a different implementation behind a port does not come here.**
 * `startHttpHarness` takes an `overrides` list and applies it through
 * `@nestjs/testing`, then calls `configureApp` from this file — so the module graph is
 * still `AppModule.forRoot`'s, the application is still a real Nest application on a
 * real socket, and the only difference is which implementation sits behind one port.
 * That is precisely what a port is for.
 */
export async function createApp(options: CreateAppOptions): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(options.config), { bufferLogs: true });

  return configureApp(app, options);
}
