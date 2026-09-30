import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Scripts {
  'format:check': string;
  'format:check:docs'?: string;
  format?: string;
}

/**
 * `process.cwd()` walk, not `new URL('../../../../', import.meta.url)`.
 *
 * This suite runs under jsdom, where `import.meta.url` is an `http://` URL, so
 * `readFileSync` rejects it with "The URL must be of scheme file". The same trap
 * is already documented in `packages/ui-kit/vitest.config.ts`; the resolution
 * pattern here matches `apps/api/src/config/test-file-oracle.spec.ts`, which
 * walks up to a manifest rather than assuming a fixed depth.
 */
function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir)
        throw new Error('could not locate pnpm-workspace.yaml above ' + process.cwd());
      dir = parent;
    }
  }
}

const pkg = JSON.parse(readFileSync(join(repoRoot(), 'package.json'), 'utf8')) as {
  scripts: Scripts;
};

/**
 * This suite tests the GATE DEFINITION, not the formatting of any file.
 *
 * `AGENTS.md` 3.2.1-style defects in this repository have repeatedly been gates
 * that did not mean what they appeared to mean, so the definition is asserted
 * directly. `A-4` exists because the glob swept all of `docs/` and `AGENTS.md`
 * itself: 78 style warnings, 51 of them under `docs/`, which means every
 * documentation review carries a 51-file formatting diff, and one of those files
 * is the governing contract - which `D14` restricts and for which no approval
 * has been given.
 */
describe('the format:check gate covers code, not prose', () => {
  it('does not sweep markdown into the mandatory gate', () => {
    // The glob was `**/*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}`. Asserting on
    // `docs/` or on the literal `**/*.md` is too weak: the brace form contains
    // neither substring, so both of those assertions pass against the broken
    // glob. The `md` extension is the actual signal.
    expect(pkg.scripts['format:check']).not.toMatch(/\bmd\b/);
  });

  it('names only directories it actually covers', () => {
    // A glob that reaches outside its declared scope is how a gate ends up
    // checking things its author never intended to check.
    for (const scope of ['apps/', 'packages/', 'scripts/']) {
      expect(pkg.scripts['format:check']).toContain(scope);
    }
  });

  it('still covers every source extension the gate is required to cover', () => {
    for (const ext of ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json']) {
      expect(pkg.scripts['format:check']).toContain(ext);
    }
  });

  it('keeps a separate, non-mandatory script for prose', () => {
    expect(pkg.scripts['format:check:docs']).toBeDefined();
    expect(pkg.scripts['format:check:docs']).toMatch(/\.md/);
  });

  it('covers at least everything `format:check` covers, so the two cannot disagree', () => {
    // `format` may cover MORE than `format:check` - that is harmless, and it
    // does: it also writes root `package.json`, which the check skips because
    // pnpm rewrites that file on install and its ordering is not ours to
    // police. What must never happen is the reverse: if `format` covered LESS,
    // then `pnpm format` would appear to fix things the gate still reports.
    //
    // So this asserts containment per scope, not string equality. An earlier
    // draft asserted equality and failed against a correct implementation,
    // which is the same mistake as a test that fails for the wrong reason.
    for (const scope of ['apps/**', 'packages/**', 'scripts/**']) {
      expect(pkg.scripts.format, `format must cover ${scope}`).toContain(scope);
    }
    // Not a literal-substring check on `*.{yml,yaml}`: `format` writes
    // `*.{json,yml,yaml}`, so the shorter string is not present even though the
    // coverage is. Asserting a literal that a correct implementation does not
    // contain is a test that fails for a reason unrelated to the defect.
    for (const ext of ['yml', 'yaml']) {
      expect(pkg.scripts.format, `format must cover root *${ext}`).toContain(ext);
    }
  });

  it('runs the same globs through the same binary', () => {
    expect(pkg.scripts.format).toContain('prettier --write');
    expect(pkg.scripts['format:check']).toContain('prettier --check');
  });
});
