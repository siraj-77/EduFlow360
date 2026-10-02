import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Loading the repository's own `.env` files.
 *
 * ## Why this file exists
 *
 * `env.ts` tells a developer whose configuration is wrong to run
 * `cp .env.example .env` and fill it in. The tracked `.env.example` exists.
 * But **nothing ever opened either file.** `main.ts` called `loadConfig()`,
 * which reads `process.env`, and `process.env` in a plain Nest process holds
 * whatever the shell exported and nothing else.
 *
 * So the documented setup path did not work. A developer who followed the
 * error message exactly still ended up with an application that could not see
 * the file they had just filled in. This was found on 2026-10-02, when real
 * Google credentials sat fully configured in `.env.local` and the API would
 * never have seen them.
 *
 * The same hole was closed for the *test* gate on 2026-10-01 in
 * `vitest.integration.config.ts`. That fix was correct for its scope and left
 * the *application* still broken, which is the usual way this defect
 * survives: one caller fixed, the other forgotten.
 *
 * ## Precedence
 *
 *   process.env  >  .env.local  >  .env
 *
 * Two measured facts about `process.loadEnvFile` drive this, and the second
 * one is the opposite of what was assumed when this file was first written:
 *
 * 1. **It does not overwrite.** Verified on Node 26.7.0: set a variable, load
 *    a file that declares it differently, and the original value survives.
 *    So the shell already wins over any file, for free - no guard needed. An
 *    earlier draft of this comment claimed the opposite and asserted that a
 *    restore-guard was required; the test caught it before it shipped.
 * 2. **Consequently `.env.local` cannot override `.env`.** Because `.env` runs
 *    first and sets the key, the loader leaves it alone. Later files need the
 *    keys earlier files introduced to be *removed* first. That is what
 *    `introduced` below tracks - and it only ever holds keys no file was
 *    given from outside, so an exported or CI-injected value is never touched.
 *
 * `.env.local` overrides `.env` so a single developer can diverge without
 * editing a file everyone else shares, which is the Next.js convention
 * `apps/web` already follows and which `.gitignore:8` already anticipates.
 *
 * `apps/web` gets this for free because Next.js loads `.env*` itself. The API
 * is plain NestJS and has to do it explicitly, which is why this file exists
 * rather than a dependency.
 */
export interface LoadEnvFilesResult {
  /** Files that existed and were loaded, in load order. */
  readonly loaded: readonly string[];
  /** Paths that did not exist. Absent is not an error. */
  readonly missing: readonly string[];
}

export interface LoadEnvFilesOptions {
  /** Candidate files, in increasing precedence. */
  readonly paths: readonly string[];
}

/**
 * Load env files into `process.env` without ever displacing a value the
 * process was already given.
 *
 * Safe to call when nothing is set: the only effect is populating variables
 * that were absent.
 */
export function loadEnvFiles(options: LoadEnvFilesOptions): LoadEnvFilesResult {
  // Everything the process was already given. These came from the shell or
  // from CI, and they are the only keys a file must never displace.
  const preset = new Set(Object.keys(process.env));

  // Keys that earlier files introduced. Only these are cleared before a later
  // file loads, which is what lets `.env.local` win over `.env` without letting
  // a file win over the shell.
  const introduced = new Set<string>();

  const loaded: string[] = [];
  const missing: string[] = [];

  for (const path of options.paths) {
    if (!existsSync(path)) {
      missing.push(path);
      continue;
    }

    // The loader will not overwrite, so a key set by `.env` would otherwise
    // survive and `.env.local` could never win.
    for (const key of introduced) delete process.env[key];
    introduced.clear();

    process.loadEnvFile(path);

    for (const key of Object.keys(process.env)) {
      if (!preset.has(key)) introduced.add(key);
    }

    loaded.push(path);
  }

  return { loaded, missing };
}

/**
 * Markers that identify the workspace root when walking up from a directory.
 * A monorepo has exactly one, so this is not a guess.
 */
const ROOT_MARKERS = ['pnpm-workspace.yaml', '.git'] as const;

/**
 * Find the workspace root by walking up from `from`.
 *
 * Resolved from a marker file rather than from `import.meta.url` on purpose:
 * this module is compiled to CommonJS for the Nest build and executed as ESM
 * under Vitest, so neither `__dirname` nor `import.meta` is honest in both.
 * A marker file works identically in either.
 *
 * @param from Directory to start the walk at. Defaults to the working
 *   directory, which is the package directory under pnpm.
 */
export function findWorkspaceRoot(from: string = process.cwd()): string {
  let current = resolve(from);

  for (;;) {
    for (const marker of ROOT_MARKERS) {
      if (existsSync(join(current, marker))) return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        `Could not find a workspace root above ${from}: expected one of ` +
          `${ROOT_MARKERS.join(' or ')}. The API loads its .env from the workspace root, ` +
          `so it cannot start without knowing where that is.`,
      );
    }
    current = parent;
  }
}

/**
 * The env files the API reads at boot, in increasing precedence.
 *
 * `.env` first because it is the shared local configuration a developer
 * creates from `.env.example`; `.env.local` second because it is the personal
 * override, and `.gitignore:8` already excludes it.
 */
export function workspaceEnvFilePaths(from?: string): string[] {
  const root = findWorkspaceRoot(from);
  return [join(root, '.env'), join(root, '.env.local')];
}
