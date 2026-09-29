#!/usr/bin/env node
/**
 * Documentation reference checker (`OPS-05`).
 *
 * `AGENTS.md` is a contract, and a contract that points at files which do
 * not exist is worse than one that says nothing: an agent or a new
 * engineer follows the path, finds nothing, and spends a session working
 * out whether the document is wrong or they are.
 *
 * This script extracts backticked paths from the governing documents and
 * fails if any does not exist. It exists so GAP-08 -- the ~21 dangling
 * references found in `AGENTS.md` on 2026-09-28 -- cannot come back.
 *
 * Future-dated targets are allowlisted rather than silently skipped, so
 * adding a new one is a deliberate edit here and shows up in review.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Documents whose references are treated as binding. */
const DOCUMENTS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'docs/core/SSOT.md',
  'docs/core/ARCHITECTURE.md',
  'docs/adr/README.md',
  'docs/work/TODO.md',
  'docs/work/PLATFORM_CORE_PLAN.md',
];

/**
 * Paths that legitimately do not exist yet, with the story that creates
 * each. A new entry here should be a one-line justification.
 */
const ALLOWED_MISSING = new Map([
  ['docs/archive/corpus', 'open question 2 — deleted, or never migrated?'],
  ['docs/modules', 'created per module as modules land'],
  ['apps/mobile', 'milestone 2 (AGENTS.md section 7, D5)'],
  ['directives', 'ARC-08 — Layer-1 SOPs'],
  ['infra/ci', 'P3 — CI pipeline definitions'],
  ['infra/terraform', 'AGENTS.md 3.1 marks this optional; OPS-06 provisions first'],
  ['keys', 'licence public key directory; created by OPS-06 provisioning'],
]);

/**
 * Every backticked span, captured whole.
 *
 * A narrower character class was tried first and produced false
 * positives: it truncated `docs/adr/ADR-003-*` at the `*` and
 * `docs/template/EduFlow — Frontend Template.html` at the em-dash,
 * reporting two files as missing that both exist. Capturing the whole
 * span and deciding afterwards is both simpler and correct.
 */
const BACKTICK = /`([^`\n]+)`/g;
const PATH_EXTENSIONS = /\.(?:md|ts|tsx|html|json|ya?ml|yml|prisma|env)$/;
const REPO_ROOT_RE = /^(?:apps|packages|infra|directives|docs|keys)(?:\/|$)/;

/** Trailing slashes are cosmetic; `docs/archive/corpus/` and
 *  `docs/archive/corpus` are the same reference. */
const normalise = (p) => p.replace(/\/+$/, '');

/**
 * A bare ADR identifier (`docs/adr/ADR-001`, `docs/adr/ADR-003-*`) names a
 * document whose full filename carries a title slug, so an exact existence
 * check can never succeed. Those resolve by prefix.
 */
function resolves(ref) {
  if (existsSync(join(ROOT, ref))) return true;

  const parent = dirname(ref);
  if (!existsSync(join(ROOT, parent))) return false;

  const glob = basename(ref).replace(/\*+$/, '');
  if (!glob) return true; // a bare directory glob like `docs/adr/*`

  return readdirSync(join(ROOT, parent)).some((f) => f.startsWith(glob));
}

let checked = 0;
const skipped = { glob: 0, external: 0 };
const problems = [];

for (const doc of DOCUMENTS) {
  const absolute = join(ROOT, doc);
  if (!existsSync(absolute)) {
    problems.push(`${doc}: listed in docs:verify but does not exist`);
    continue;
  }

  const text = readFileSync(absolute, 'utf8');

  for (const match of text.matchAll(BACKTICK)) {
    const raw = match[1].trim();

    if (!REPO_ROOT_RE.test(raw)) continue; // bare package name, not a path
    if (/[<>{}$]/.test(raw)) continue; // a placeholder, not a real path

    const ref = normalise(raw);

    // A glob is a deliberate wildcard, not a broken link. Record it rather
    // than guessing which file was meant.
    if (/\*/.test(ref)) {
      skipped.glob += 1;
      continue;
    }

    // Only check things that name a file or a directory, not a sentence.
    const looksLikePath = PATH_EXTENSIONS.test(ref) || !/\s/.test(ref);
    if (!looksLikePath) {
      skipped.external += 1;
      continue;
    }

    checked += 1;
    if (resolves(ref)) continue;

    // Allow the path, or any ancestor, being known-future.
    let known = null;
    for (const candidate of [ref, dirname(ref), dirname(dirname(ref))]) {
      if (ALLOWED_MISSING.has(candidate)) {
        known = candidate;
        break;
      }
    }
    if (known) continue;

    problems.push(`${doc}: ${raw} — referenced but does not exist`);
  }
}

if (problems.length > 0) {
  console.error('EDUFLOW — documentation reference check FAILED\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    `\n${problems.length} broken reference(s) in ${checked} checked.`,
    '\nEither create the file, or add it to ALLOWED_MISSING with a justification.',
  );
  process.exit(1);
}

console.log(`docs:verify OK — ${checked} references across ${DOCUMENTS.length} documents resolve.`);
