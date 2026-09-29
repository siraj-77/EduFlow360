import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The build-script allow-list must be machine-interpretable.
 *
 * pnpm refuses to run a dependency's postinstall unless that dependency
 * appears in an explicit allow-list. A package in the store but not on the
 * list is blocked, and pnpm reports the whole run as
 * `ERR_PNPM_IGNORED_BUILDS` and **exits non-zero**.
 *
 * That is safe, and it is deliberate - it is what stops a supply-chain
 * postinstall from running unapproved. The problem is not the rule, it is
 * that a `allowBuilds` block in `pnpm-workspace.yaml` was written with
 * literal placeholder strings instead of booleans, so the block cannot be
 * interpreted at all:
 *
 *   allowBuilds:
 *     '@prisma/client': set this to true or false
 *
 * `pnpm config get allowBuilds` returns those strings verbatim. The effect
 * is invisible on a clean tree - `pnpm install` exits 0 - and appears the
 * moment a dependency is added, which is exactly when a broken install
 * blocks the work. `pnpm add -D @vitest/coverage-v8` completed and wrote a
 * correct lockfile, then exited 1.
 *
 * This test asserts one property of one block. It is deliberately a
 * targeted line scan, not a general YAML parser, and it does not pretend
 * to be one: the file is a settings file, and the property under test is
 * "every value in this block is a boolean literal".
 */

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate pnpm-workspace.yaml above ' + process.cwd());
}

const WORKSPACE_FILE = join(repoRoot(), 'pnpm-workspace.yaml');
const lines = readFileSync(WORKSPACE_FILE, 'utf8').split(/\r?\n/);

/** The `key: value` entries of a top-level block, as [key, rawValue, lineNumber]. */
function blockEntries(block: string): Array<[string, string, number]> {
  const start = lines.findIndex((l) => l.trim() === `${block}:`);
  if (start === -1) return [];

  const entries: Array<[string, string, number]> = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    // A new top-level key, or end of file, ends the block.
    if (line.trim() === '' || /^\S/.test(line)) break;
    const match = /^\s+['"]?([^'":]+)['"]?:\s*(.*?)\s*$/.exec(line);
    if (match?.[1] && match[2] !== undefined) entries.push([match[1].trim(), match[2], i + 1]);
  }
  return entries;
}

/** The list items of a top-level sequence block, as [item, lineNumber]. */
function listItems(block: string): Array<[string, number]> {
  const start = lines.findIndex((l) => l.trim() === `${block}:`);
  if (start === -1) return [];

  const items: Array<[string, number]> = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || /^\S/.test(line)) break;
    const match = /^\s+-\s*['"]?([^'"]+)['"]?\s*$/.exec(line);
    if (match?.[1]) items.push([match[1].trim(), i + 1]);
  }
  return items;
}

describe('pnpm-workspace.yaml build-script allow-lists are machine-interpretable', () => {
  it('every allowBuilds value is a boolean literal', () => {
    const entries = blockEntries('allowBuilds');

    for (const [key, raw, lineNo] of entries) {
      expect(
        raw,
        `pnpm-workspace.yaml:${lineNo} - allowBuilds["${key}"] is the string "${raw}", not a boolean. pnpm cannot interpret it, so the whole allow-list is rejected and every build script is blocked. Run "pnpm install" to see ERR_PNPM_IGNORED_BUILDS.`,
      ).toMatch(/^(true|false)$/);
    }
  });

  it('declares no build-script allow-list entry with a placeholder value', () => {
    // A more specific guard, so a future placeholder is caught with its cause
    // rather than only as a type error.
    const placeholders = /set this to|true or false|TODO|FIXME|<.*>|xxx/i;
    for (const [key, raw, lineNo] of blockEntries('allowBuilds')) {
      expect(placeholders.test(raw), `pnpm-workspace.yaml:${lineNo} - allowBuilds["${key}"] is still a placeholder: "${raw}"`).toBe(false);
    }
  });

  it('declares the allow-list with allowBuilds, not the inert onlyBuiltDependencies', () => {
    // Measured on pnpm 11.22.0, 2026-09-29: with `onlyBuiltDependencies` alone,
    // pnpm reported ERR_PNPM_IGNORED_BUILDS for four packages (esbuild,
    // @prisma/client, @prisma/engines, prisma) and exited 1. With the
    // equivalent `allowBuilds` block it exits 0 and the postinstalls run.
    // `pnpm config get onlyBuiltDependencies` reads the array back correctly,
    // so the inert key is indistinguishable from a working one by inspection.
    // That is why this is asserted rather than left to a comment.
    const allow = blockEntries('allowBuilds');
    const built = listItems('onlyBuiltDependencies');

    expect(allow.length, 'pnpm-workspace.yaml declares no allowBuilds entries, so every dependency postinstall is blocked and pnpm exits 1').toBeGreaterThan(0);

    for (const [item, lineNo] of built) {
      expect(
        allow.some(([key]) => key === item),
        `pnpm-workspace.yaml:${lineNo} - "${item}" is listed only in onlyBuiltDependencies, which pnpm 11.22.0 does not honour. List it in allowBuilds with the value true, or its postinstall will be blocked and pnpm will exit 1.`,
      ).toBe(true);
    }
  });

  it('every allowBuilds entry is allowed rather than denied', () => {
    // A `false` here means "block this deliberately". That is a legitimate
    // choice, but it must be a deliberate one, and it must not collide with
    // the packages that genuinely need a postinstall to function.
    for (const [key, raw, lineNo] of blockEntries('allowBuilds')) {
      expect(raw, `pnpm-workspace.yaml:${lineNo} - allowBuilds["${key}"] is ${raw}, so its postinstall stays blocked`).toBe('true');
    }
  });

  it('declares at least one build-script allow-list entry', () => {
    // Guards against the suite passing vacuously if the block is deleted.
    // A dependency with a postinstall step genuinely needs one: esbuild for
    // vitest's transform pipeline, prisma for its query-engine binary.
    expect(blockEntries('allowBuilds').length).toBeGreaterThan(0);
  });
});
