import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Geometry check for the two generated diagrams.
 *
 * A generated diagram can be structurally valid — every element well formed,
 * every assertion green — and still be unreadable, because nothing in the
 * renderer stops a long text block from running into the note beneath it. That
 * is not hypothetical: the first pass of the project ERD overlapped Platform
 * Core's fourteen-entity list with its own caption, and a three-line subtitle
 * sat three pixels inside the first band header.
 *
 * This asserts the two failure modes that matter, over the committed files.
 * Run via `pnpm --filter @eduflow/api generate:diagrams`, or directly:
 *   node apps/api/erd/check-geometry.mjs
 *
 * The same assertions run inside `project-erd.spec.ts`, which is the gate that
 * actually fails the build. This script is the standalone version, for running
 * during authoring.
 */

// Resolved from this module, not from the working directory. `pnpm --filter`
// runs the script with cwd set to the package, so a `docs/diagrams/...`
// relative path resolves to apps/api/docs and fails with ENOENT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIAGRAM_DIR = join(REPO_ROOT, 'docs', 'diagrams');

const FILES = ['ERD_PROJECT', 'REFERENCE_ARCHITECTURE'];

let failed = false;

for (const name of FILES) {
  const scene = JSON.parse(readFileSync(join(DIAGRAM_DIR, `${name}.excalidraw`), 'utf8'));
  const texts = scene.elements.filter((e) => e.type === 'text');

  // 1. No two text blocks may overlap. Elements drawn later sit on top, so an
  //    overlap means one label is unreadable.
  let overlaps = 0;
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      const hit =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      if (hit) {
        overlaps += 1;
        if (overlaps <= 3) {
          console.log(`  OVERLAP  ${JSON.stringify(a.text.slice(0, 44))}`);
          console.log(`        vs ${JSON.stringify(b.text.slice(0, 44))}`);
        }
      }
    }
  }

  // 2. No text may spill out of the card that contains its origin.
  const cards = scene.elements.filter((e) => e.type === 'rectangle' && e.id);
  let escapes = 0;
  for (const card of cards) {
    for (const t of texts) {
      const inside = t.x >= card.x - 2 && t.x < card.x + card.width && t.y >= card.y - 2 && t.y < card.y + card.height;
      if (inside && t.y + t.height > card.y + card.height) {
        escapes += 1;
        if (escapes <= 3) {
          console.log(`  ESCAPES ${card.id}  ${JSON.stringify(t.text.slice(0, 40))}`);
        }
      }
    }
  }

  const ok = overlaps === 0 && escapes === 0;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}  texts=${texts.length} cards=${cards.length} overlaps=${overlaps} escapes=${escapes}`,
  );
}

process.exitCode = failed ? 1 : 0;