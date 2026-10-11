import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvFiles } from './env-files.js';

/**
 * The API could not read its own configuration.
 *
 * `env.ts` documents `cp .env.example .env` in its own error message, and the
 * tracked `.env.example` exists, but nothing ever opened either file. `main.ts`
 * called `loadConfig()`, which reads `process.env`, and `process.env` in a
 * plain Nest process contains whatever the shell exported and nothing else.
 *
 * So the documented setup path was a fiction: a developer who followed the
 * error message exactly still got a configuration that could not see the file
 * they had just filled in. The 2026-10-01 fix to
 * `vitest.integration.config.ts` closed the same hole for the *test* gate and
 * left the *application* still broken.
 *
 * The credentials that triggered this made it visible: `GOOGLE_CLIENT_ID` sat
 * in `.env.local`, fully configured, and the API would never have seen it.
 *
 * Precedence, chosen to match Next.js because `apps/web` already uses it and
 * because `.gitignore:2` already documents `.env.local` as a local file:
 *
 *   process.env (explicitly exported, and CI) > `.env.local` > `.env`
 *
 * The shell must win because `process.loadEnvFile` **overwrites** existing
 * keys. Loading a file unconditionally would let a developer's stale
 * `.env` silently replace a value their CI injected from a secret, which is
 * precisely the class of non-determinism that makes a gate untrustworthy.
 */
describe('loadEnvFiles', () => {
  let dir: string;
  const snapshot: NodeJS.ProcessEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'eduflow-env-'));
    // Clear the variables this suite manipulates so each case starts clean.
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('EDUFLOW_TEST_')) delete process.env[k];
    }
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const k of Object.keys(process.env)) {
      if (!(k in snapshot)) delete process.env[k];
    }
    Object.assign(process.env, snapshot);
  });

  const write = (name: string, body: string): string => {
    const p = join(dir, name);
    writeFileSync(p, body, 'utf8');
    return p;
  };

  it('loads a .env file into process.env, so the app can read its own config', () => {
    write('.env', 'EDUFLOW_TEST_ALPHA=from-env\n');

    const result = loadEnvFiles({ paths: [join(dir, '.env')] });

    expect(process.env.EDUFLOW_TEST_ALPHA).toBe('from-env');
    expect(result.loaded).toEqual([join(dir, '.env')]);
  });

  it('lets .env.local override .env', () => {
    write('.env', 'EDUFLOW_TEST_ALPHA=from-env\n');
    write('.env.local', 'EDUFLOW_TEST_ALPHA=from-local\n');

    loadEnvFiles({ paths: [join(dir, '.env'), join(dir, '.env.local')] });

    expect(process.env.EDUFLOW_TEST_ALPHA).toBe('from-local');
  });

  it('never overrides a variable that was already set in the environment', () => {
    // This is the CI case. process.loadEnvFile overwrites, so the guard has to
    // exist here rather than relying on the loader's own behaviour.
    process.env.EDUFLOW_TEST_ALPHA = 'from-shell';
    write('.env', 'EDUFLOW_TEST_ALPHA=from-env\n');
    write('.env.local', 'EDUFLOW_TEST_ALPHA=from-local\n');

    loadEnvFiles({ paths: [join(dir, '.env'), join(dir, '.env.local')] });

    expect(process.env.EDUFLOW_TEST_ALPHA, 'the shell value must survive both files').toBe(
      'from-shell',
    );
  });

  it('keeps what .env supplied when .env.local does not mention it', async () => {
    // The everyday local dev case, and the documented precedence: `.env.local`
    // OVERRIDES `.env` — it wins on the keys it declares, and `.env` still
    // supplies everything else. Found 2026-10-11 when `npm run dev` refused to
    // boot: the root `.env.local` declared DATABASE_URL (and the Google
    // secrets) but not SCHOOL_ID, and the loader deleted every key `.env`
    // introduced before `.env.local` loaded — so SCHOOL_ID, which the
    // developer's `.env` plainly contained, was wiped and the API failed with
    // "DATABASE_URL is set but SCHOOL_ID is not". A developer who followed the
    // repo's own setup instructions could not start the application.
    const { rm } = await import('node:fs/promises');
    await rm(join(dir, '.env.local'), { force: true });

    write('.env', 'EDUFLOW_TEST_ALPHA=from-env\nEDUFLOW_TEST_BETA=also-from-env\n');

    const result = loadEnvFiles({ paths: [join(dir, '.env'), join(dir, '.env.local')] });

    expect(process.env.EDUFLOW_TEST_ALPHA).toBe('from-env');
    expect(process.env.EDUFLOW_TEST_BETA).toBe('also-from-env');
    expect(result.loaded).toEqual([join(dir, '.env')]);
    expect(result.missing).toEqual([join(dir, '.env.local')]);
  });

  it('lets .env.local override .env key by key, not wholesale', async () => {
    // The precedence this file's header promises: the local file WINS on what
    // it declares and loses on nothing else. The previous behaviour deleted
    // every key `.env` introduced before loading `.env.local`, which made a
    // partial `.env.local` (secrets only — the common case) silently discard
    // the rest of the developer's configuration.
    write('.env', 'EDUFLOW_TEST_ALPHA=from-env\nEDUFLOW_TEST_BETA=from-env\n');
    write('.env.local', 'EDUFLOW_TEST_ALPHA=from-local\n');

    loadEnvFiles({ paths: [join(dir, '.env'), join(dir, '.env.local')] });

    expect(process.env.EDUFLOW_TEST_ALPHA).toBe('from-local');
    expect(process.env.EDUFLOW_TEST_BETA, '.env still supplies the keys .env.local omits').toBe(
      'from-env',
    );
  });

  it('reports which files it loaded, for the boot banner', () => {
    const envPath = write('.env', 'EDUFLOW_TEST_ALPHA=a\n');
    write('.env.local', 'EDUFLOW_TEST_ALPHA=b\n');

    const result = loadEnvFiles({ paths: [envPath, join(dir, '.env.local')] });

    expect(result.loaded).toEqual([envPath, join(dir, '.env.local')]);
  });

  it('does not load a file outside the paths it was given', () => {
    // Guards against a future change reading the whole repo by accident.
    write('.env', 'EDUFLOW_TEST_ALPHA=from-env\n');

    loadEnvFiles({ paths: [join(dir, 'nothing-here')] });

    expect(process.env.EDUFLOW_TEST_ALPHA).toBeUndefined();
  });
});
