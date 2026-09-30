/**
 * ARC-08 — writes the two Excalidraw scenes.
 *
 *   node apps/api/erd/render.mjs
 *   pnpm --filter @eduflow/api generate:diagrams
 *
 * An Excalidraw scene is `{ type, version, source, elements, appState, files }`
 * with Excalidraw-specific required keys on every element — `seed`, `version`,
 * `versionNonce`, `isDeleted`, `boundElements`, `updated`, `link`, `locked`.
 * `elements.json` carries the same list without them, which is what makes it
 * diffable in a review; this file adds the envelope.
 *
 * Elements also need `appState`-independent IDs. Excalidraw's own `randomId`
 * is not used, because a random ID per run makes the file undiffable and the
 * whole point of a committed diagram is that a reviewer can see what changed.
 * The renderers already set stable IDs (`mod_…`, `gap_…`, `layer_…`), so a
 * deterministic counter fills the gaps.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProjectErd, renderReferenceArchitecture } from './render-project-diagrams.mjs';

const ERD_DIR = join(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = join(ERD_DIR, '..', '..', '..');
const DIAGRAM_DIR = join(REPO_ROOT, 'docs', 'diagrams');

/** A deterministic counter, so two runs produce byte-identical files. */
function counter() {
  let n = 0;
  return () => {
    n += 1;
    return n.toString(36).padStart(6, '0');
  };
}

/** The keys Excalidraw expects on an element but a renderer has no reason to know. */
function decorate(el, nextId) {
  // `...el` is spread FIRST and `id` is assigned AFTER it, because spreading
  // last silently overwrote `id` with `undefined` on every element the
  // renderers did not name — and JSON.stringify drops undefined keys, so the
  // written file looked right while the in-memory scene carried a different id.
  const merged = {
    angle: 0,
    strokeWidth: el.strokeWidth ?? 1,
    strokeStyle: el.strokeStyle ?? 'solid',
    fillStyle: el.fillStyle ?? 'solid',
    roughness: el.roughness ?? 0,
    opacity: el.opacity ?? 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: el.roundness ?? null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    ...el,
  };
  // `nextId` is CALLED. Passing the function itself produced IDs containing the
  // function's own source text, and the canvas rejected the whole batch with a
  // generic error that looks like a tool failure rather than a bad element.
  return { ...merged, id: el.id || `el_${nextId()}` };
}

/** Excalidraw wants a stable per-element seed; derive it from the id so two runs match. */
function reseed(el, n) {
  const numeric = Number.parseInt(String(el.id).replace(/\D/g, ''), 10) || n;
  return { ...el, seed: numeric, versionNonce: numeric * 7919 };
}

export function scene(elements) {
  const nextId = counter();
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: elements.map((el, i) => reseed(decorate(el, nextId), i)),
    appState: {
      gridSize: null,
      viewBackgroundColor: '#ffffff',
      currentItemStrokeColor: '#161a23',
      currentItemBackgroundColor: 'transparent',
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 0.4 },
    },
    files: {},
  };
}

export function generateDiagrams() {
  mkdirSync(DIAGRAM_DIR, { recursive: true });
  const written = [];

  const erd = join(DIAGRAM_DIR, 'ERD_PROJECT.excalidraw');
  writeFileSync(erd, `${JSON.stringify(scene(renderProjectErd()), null, 2)}\n`, 'utf8');
  written.push(erd);

  const arch = join(DIAGRAM_DIR, 'REFERENCE_ARCHITECTURE.excalidraw');
  writeFileSync(arch, `${JSON.stringify(scene(renderReferenceArchitecture()), null, 2)}\n`, 'utf8');
  written.push(arch);

  return written;
}

if (process.argv[1]?.endsWith('render.mjs')) {
  for (const p of generateDiagrams()) console.log(`written: ${p}`);
}
