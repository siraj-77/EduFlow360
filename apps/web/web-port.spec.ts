import { readFileSync } from 'node:fs';
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
describe('the web port is defined once', () => {
  const WEB_ROOT = dirname(fileURLToPath(import.meta.url));
  const scripts = (
    JSON.parse(readFileSync(join(WEB_ROOT, 'package.json'), 'utf8')) as {
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
