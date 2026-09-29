import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a real, containerized PostgreSQL on an
 * isolated schema (AGENTS.md section 4; Prompt Pack P4).
 *
 * At P2 there is no schema yet — the ERD is deferred — so this suite is
 * empty by design. It exists so `pnpm test:integration` is runnable and
 * a real failure is distinguishable from "not configured".
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
