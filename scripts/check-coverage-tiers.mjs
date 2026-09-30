#!/usr/bin/env node
//
// The coverage gate must enforce something.  FIX-26.
//
// `AGENTS.md` section 4 makes `pnpm test:coverage` a mandatory gate and says
// plainly: "The coverage gate is mandatory, not aspirational." It also says a
// test count is not evidence of coverage.
//
// A coverage threshold can be perfectly written, correctly quoted, backed by an
// installed provider, and still enforce absolutely nothing, because the glob it
// names matches no file. Measured 2026-09-30:
//
//   apps/api   src/**/domain/**/*.ts      90/85   0 files
//              src/**/use-cases/**/*.ts    90/85   0 files
//              src/**/*.controller.ts      70      0 files
//   apps/web   src/**/hooks/**/*.ts       80      0 files
//              src/**/hooks/**/*.tsx      80      0 files
//              src/lib/**/*.ts            80      LIVE
//
// THE COMMENT STYLE ABOVE IS NOT COSMETIC. A recursive glob contains the
// two-character sequence star-slash, which terminates a block comment early and
// hands the parser a glob as code. This repository has hit that exact footgun
// before - WORKLOG.md, [0.1.0-scaffold] "Fixed" lists "a star-slash inside a
// JSDoc comment that closed it early and parsed the glob as code". It happened
// again here on 2026-09-30, twice, and the compiler named the line both times.
// Every comment in this file is therefore a line comment. If a future edit
// "tidies" them into a block comment, it will not compile, which is the only
// reason to prefer the uglier style.
//
// Five of six tiers were decorative, and `pnpm test:coverage` exited 0 the whole
// time. The gate had been *proved able to fail* on 2026-09-29, but by a
// temporary probe threshold on a real file - a different claim from "the
// configured tiers bite". That is the distinction TDD_EVIDENCE_GATES.md section
// 4 rule 2 draws between a "mechanism probe" and a "configured tier".
//
// Sharper than "five tiers are empty": apps/api had NO live tier at all. It
// ships real, tested source in src/config/ and every tier it declares points at
// domain/, use-cases/ or a .controller.ts glob - directories that exist and are
// empty. So the API's coverage was ungated, not merely under-gated.
//
// WHY THIS IS A SCRIPT AND NOT A SPEC
//
// It was written as a spec first, and it worked: it went red naming all five
// globs and the ungated package. It was moved here for one reason. A failing
// spec fails `pnpm test`, and `pnpm test` is the gate every session runs to
// answer "is the product tested?". A permanently-red main gate is how gates die
// - D30: "a gate left red teaches the next developer to ignore it" - and F-1,
// which fixes this, is three epics away.
//
// So the red lives on the gate that owns the concern. `pnpm test` stays green
// and meaningful; `pnpm test:coverage` is red and names the file that fixes it.
// Both signals are honest, and neither is one anyone learns to ignore.
//
// The tier is correct forward-looking configuration for code that has not been
// written yet. The fix is to write the code, not to weaken the tier.
//
// Exits 0 when every configured tier matches at least one source file, or when
// no thresholds are configured at all. Exits 1 otherwise.

import { existsSync, globSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = [
  'apps/api',
  'apps/web',
  'packages/shared-types',
  'packages/ui-kit',
  'packages/i18n-resources',
];

/** Directories that are never source, whatever a glob says. */
const NEVER_SOURCE = [
  'node_modules',
  'dist',
  '.next',
  'coverage',
  'test-results',
  'playwright-report',
  '.turbo',
];

function configPathFor(dir) {
  return ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts', 'vitest.config.mjs']
    .map((f) => join(ROOT, dir, f))
    .find((p) => existsSync(p));
}

/**
 * Read `coverage.thresholds` keys out of a config file.
 *
 * A text read, not an import: a threshold glob is data about which files a
 * runner will measure, and importing the config would execute its plugins. A
 * config that computes its globs dynamically is not seen, which is the same
 * limit `coverage-gate.spec.ts` already documents for `provider`.
 */
function declaredTiers(config) {
  const block = /thresholds\s*:\s*\{/.exec(config);
  if (!block) return [];
  // Up to the matching close brace, so a sibling `thresholds`-shaped key
  // outside the coverage block cannot contribute globs.
  let depth = 0;
  let end = block.index + block[0].length - 1;
  for (let i = end; i < config.length; i += 1) {
    if (config[i] === '{') depth += 1;
    else if (config[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = config.slice(block.index, end + 1);
  return [...body.matchAll(/'([^']+)'\s*:\s*\{/g)].map((m) => m[1]).filter((g) => g.includes('/'));
}

/** Does this glob land on at least one real source file? */
function tierMatchesSource(dir, glob) {
  let hits;
  try {
    hits = globSync(glob, { cwd: join(ROOT, dir) });
  } catch {
    return false;
  }
  return hits.some((hit) => {
    if (/\.(spec|test)\./.test(hit)) return false;
    try {
      return statSync(join(ROOT, dir, hit)).isFile();
    } catch {
      return false;
    }
  });
}

/** Does this package ship any source at all, spec files excluded? */
function shipsSource(dir) {
  const src = join(ROOT, dir, 'src');
  if (!existsSync(src)) return false;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (NEVER_SOURCE.includes(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) return true;
      } else if (/\.(spec|test)\./.test(entry.name)) continue;
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) return true;
    }
    return false;
  };
  return walk(src);
}

const findings = { emptyTiers: [], ungatedPackages: [], noTierAtAll: [] };

for (const dir of PACKAGES) {
  const configPath = configPathFor(dir);
  if (!configPath) continue;
  const tiers = declaredTiers(readFileSync(configPath, 'utf8'));
  if (tiers.length === 0) continue;

  const empty = tiers.filter((glob) => !tierMatchesSource(dir, glob));
  for (const glob of empty) findings.emptyTiers.push({ dir, glob });

  if (empty.length === tiers.length && shipsSource(dir)) findings.ungatedPackages.push(dir);
  if (tiers.length > 0 && !shipsSource(dir)) findings.noTierAtAll.push(dir);
}

const totalTiers = findings.emptyTiers.length + (findings.emptyTiers.length === 0 ? 0 : 0);
const problems =
  findings.emptyTiers.length + findings.ungatedPackages.length + findings.noTierAtAll.length;

if (problems === 0) {
  console.log('coverage tiers OK - every configured threshold matches at least one source file');
  process.exit(0);
}

console.error('');
console.error('EDUFLOW - coverage gate enforces nothing for some tiers');
console.error('');
if (findings.emptyTiers.length) {
  console.error(`${findings.emptyTiers.length} configured tier(s) match ZERO source files:`);
  for (const { dir, glob } of findings.emptyTiers) console.error(`  ${dir}  ${glob}`);
  console.error('');
}
if (findings.ungatedPackages.length) {
  console.error(
    `${findings.ungatedPackages.length} package(s) declare tiers but NONE matches a source file, so their coverage is ungated:`,
  );
  for (const dir of findings.ungatedPackages) console.error(`  ${dir}`);
  console.error('');
}
if (findings.noTierAtAll.length) {
  console.error(
    `${findings.noTierAtAll.length} package(s) configure thresholds but ship no source to measure:`,
  );
  for (const dir of findings.noTierAtAll) console.error(`  ${dir}`);
  console.error('');
}
console.error('A tier matching zero files is not a low score. It is the absence of a score.');
console.error('');
console.error(
  'The tiers are correct forward-looking configuration for code that has not been written',
);
console.error('yet. The fix is to write the code, not to weaken the tier:');
console.error('  ACTION_PLAN_2026-09-30-v2.md story F-1 - IClock and the domain error hierarchy,');
console.error('  which creates the first file under a domain/ directory.');
console.error('');
console.error('Do not delete a tier to make this gate green.');
process.exit(1);
