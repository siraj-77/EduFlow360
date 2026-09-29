import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WEB_PORT } from './web-port';

/**
 * `package.json` cannot import a constant — npm scripts are not a module
 * graph — so `dev` and `start` carry the port as a literal. That is the one
 * place the value is duplicated, so it is the one place it needs watching.
 *
 * The failure this prevents is the 2026-09-29 incident recorded in
 * `web-port.ts`: a port that disagrees between what the app binds and what
 * the tests navigate to looks like an application bug, and every error message
 * points somewhere else.
 */

/**
 * Walk up until the `@eduflow/web` manifest is found, rather than counting
 * `../` hops from this file.
 *
 * This test previously lived at the package root, so `dirname(import.meta.url)`
 * *was* the web package. It was moved to `src/lib/` to sit beside the module it
 * tests and to be inside the unit runner's `include` globs — see `AUD-30-01` in
 * `docs/analysis/CODE_AUDIT_2026-09-30.md` — and a hard-coded `../../` would
 * have been a second thing that silently drifts when a file moves.
 *
 * The bug this whole file exists to prevent is a test that quietly stops
 * testing. A test whose own location is a magic number is the same shape.
 */
function webPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i += 1) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      const { name } = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string };
      if (name === '@eduflow/web') return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error('could not locate the @eduflow/web package.json above ' + import.meta.url);
}

describe('the web port is defined once', () => {
  const scripts = (
    JSON.parse(readFileSync(join(webPackageRoot(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  it('is 3500, not the 3000 another application on this machine holds', () => {
    expect(WEB_PORT).toBe(3500);
  });

  it.each(['dev', 'start'])('the %s script binds the same port', (name) => {
    expect(scripts[name], `"${name}" must use --port ${WEB_PORT}`).toContain(`--port ${WEB_PORT}`);
    expect(scripts[name], `"${name}" still hard-codes the old port`).not.toContain('--port 3000');
  });
});
