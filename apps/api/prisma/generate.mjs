/**
 * ARC-01 — the generator. Writes both artefacts from `schema-source.mjs`:
 *
 *   apps/api/prisma/schema.prisma
 *   docs/diagrams/ERD_PLATFORM_CORE.elements.json
 *
 * The JSON is the Excalidraw element list. It is committed so the diagram can
 * be regenerated and diffed without a running canvas, and so a reviewer can
 * read the diagram's content as data. `render-erd.mjs` is imported by the
 * Round-2 spec to prove the picture and the schema come from one source.
 *
 * The schema is written and then handed to `prisma format`, so the checked-in
 * file is in the canonical form the Prisma CLI itself defines. Without that
 * step, running `prisma format` — a thing everyone does — rewrites 580 lines
 * of column alignment and the byte-identical gate in schema-generation.spec.ts
 * fails on a file nobody hand-edited. Reimplementing the CLI's alignment here
 * would only move the drift somewhere less obvious.
 *
 *   node apps/api/prisma/generate.mjs
 *   pnpm --filter @eduflow/api generate:schema
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPrismaSchema } from './render-prisma.mjs';
import { renderErdElements } from './render-erd.mjs';

const PRISMA_DIR = join(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = join(PRISMA_DIR, '..', '..', '..');
const DIAGRAM_DIR = join(REPO_ROOT, 'docs', 'diagrams');

/** The Prisma CLI, invoked through node so no .cmd shim is involved. */
function prismaCli() {
  const cli = join(PRISMA_DIR, '..', 'node_modules', 'prisma', 'build', 'index.js');
  return existsSync(cli) ? cli : null;
}

/**
 * Prettier, in-process, for the JSON artefacts this generator writes.
 *
 * ## Why the generator formats its own output
 *
 * `JSON.stringify(x, null, 2)` and prettier disagree on arrays of numbers —
 * the stringifier puts every element on its own line, prettier keeps
 * `[0, 0]` inline — so the ERD elements file was committed unformatted and
 * every commit touching it tripped the pre-commit hook while
 * `pnpm format:check` stayed green (its globs did not cover `docs/**`).
 * Two gates disagreeing is the failure; a generator whose output IS the
 * gate's answer removes it. The globs are aligned too (`package.json`).
 */
let prettierPromise;
async function prettierFormat(text, filePath) {
  prettierPromise ??= import(
    pathToFileURL(join(REPO_ROOT, 'node_modules', 'prettier', 'index.mjs')).href
  );
  const prettier = (await prettierPromise).default;
  const options = (await prettier.resolveConfig(filePath)) ?? {};
  return prettier.format(text, { ...options, filepath: filePath });
}

export function formatSchema(schemaPath) {
  const cli = prismaCli();
  if (!cli) return false;
  // `prisma format` does not need a live database, and does not require
  // DATABASE_URL — verified, because a generator that needs a credential to
  // regenerate a text file is a generator nobody runs.
  execFileSync(process.execPath, [cli, 'format', '--schema', schemaPath], { stdio: 'ignore' });
  return true;
}

export async function generate() {
  const written = [];

  const schemaPath = join(PRISMA_DIR, 'schema.prisma');
  writeFileSync(schemaPath, renderPrismaSchema(), 'utf8');
  formatSchema(schemaPath);
  written.push(schemaPath);

  mkdirSync(DIAGRAM_DIR, { recursive: true });
  const elementsPath = join(DIAGRAM_DIR, 'ERD_PLATFORM_CORE.elements.json');
  // Formatted through prettier, so the committed artefact is what
  // `pnpm format:check` accepts and a bare regenerate is a no-op for the
  // formatting gate. See `prettierFormat`'s header.
  const elementsText = `${JSON.stringify(renderErdElements(), null, 2)}\n`;
  writeFileSync(elementsPath, await prettierFormat(elementsText, elementsPath), 'utf8');
  written.push(elementsPath);

  return written;
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('generate.mjs')
) {
  for (const p of await generate()) console.log(`written: ${p}`);
}
