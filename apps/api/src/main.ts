import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { bootBanner, loadConfig } from './config/env.js';
import { AppModule } from './app.module.js';

/**
 * EduFlow API entry point.
 *
 * Configuration is validated BEFORE the Nest application is created, so
 * an invalid environment fails with a readable message instead of a
 * dependency-injection error twenty frames deep (AGENTS.md 11).
 */
async function bootstrap(): Promise<void> {
  const loaded = loadConfig();
  // eslint-disable-next-line no-console
  console.log(bootBanner(loaded).join('\n'));

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // The API is a separate service. It serves JSON only; the web app is UI
  // (AGENTS.md 3.1). CORS is scoped to the local web origin until a
  // deployment-specific origin is configured.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3500' });

  app.enableShutdownHooks();
  await app.listen(loaded.config.PORT);
}

void bootstrap();
