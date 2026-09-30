import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a real, containerized PostgreSQL on an
 * isolated schema (AGENTS.md section 4; Prompt Pack P4).
 *
 * `passWithNoTests` is deliberately `false`, and the gate is therefore
 * RED until `F-7` supplies the first real integration test.
 *
 * It was `true`, and that made `pnpm test:integration` exit 0 while running
 * nothing — in this package and in `apps/web`, whose `test:integration` was
 * the literal script `echo "no web integration suite at P2" && exit 0`. Two of
 * two declaring packages reported a green integration gate that neither
 * provided. `AUD-30-02`.
 *
 * Two ways to make a gate hollow are now covered by
 * `src/config/integration-gate.spec.ts`: a script that always exits 0, and a
 * config that tolerates an empty include glob. Neither is visible to
 * `isPassingStub()`, which is why this file needed its own assertion.
 *
 * The empty `include` below is not the end state. It is the honest
 * intermediate: a gate that fails because it has no test yet tells the next
 * developer exactly what is missing, where a gate that passes because it has
 * no test yet tells them nothing. `D30`.
 *
 * Do not set this back to `true` to make the gate green.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
});
