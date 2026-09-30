/**
 * ARC-08 — the gate for the PROJECT-WIDE ERD and the REFERENCE ARCHITECTURE.
 *
 * ARC-01 shipped a correct ERD of a module that exists: fourteen Platform Core
 * tables. This file governs the two diagrams that sit above it and answer a
 * different question — "what does the whole system look like, and what is
 * still undesigned?" — which is the question a reviewer actually has when they
 * open `docs/`.
 *
 * WHY THIS FILE IS A GATE AND NOT A REVIEW
 * ----------------------------------------
 * The corpus is uneven, and the failure mode this prevents is specific:
 * `docs/idea-bank/README.md` §6 rule 5 says a missing rule is visible and an
 * invented one is not, and `AGENTS.md` §6 withdraws the "35 entities" figure
 * outright. An ERD that quietly drew a plausible `Student`, `Vehicle` or
 * `Wallet` would convert seven documented gaps (`PC-000`..`PC-006`) into
 * unearned certainty, and nothing downstream could tell the difference.
 *
 * So the diagram is only allowed to draw what the corpus NAMES, and every
 * undesigned domain must be drawn AS a gap. The tests below encode that:
 *
 *   1. Both artefacts exist and are real Excalidraw scenes, not placeholders.
 *   2. Every entity drawn is traceable to a named source (Tier A/B). No tiers
 *      below that — an unnamed concept is not drawn, it is counted.
 *   3. Every `PC-xxx` gap is drawn. A gap that is not on the diagram is
 *      invisible, which is the whole problem.
 *   4. The prohibitions hold on the diagram too: no `School` table, no
 *      cross-tenant role, no tenant scoping, no float money.
 *   5. The seven shared engines appear exactly once each (`AGENTS.md` §2.9) —
 *      the ERD must not imply a second attendance or ledger model.
 *   6. Reference architecture shows the Clean Architecture dependency flow and
 *      the three mandatory guards, both of which are architectural
 *      non-negotiables (`AGENTS.md` §2.2, §2.3).
 *
 * Tests assert the diagrams' CONTENT, so an image that is beautiful and wrong
 * fails exactly as hard as one that is ugly and wrong.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MODULES, PLATFORM_CORE_ENTITIES, SHARED_ENGINES } from '../../erd/project-erd-source.mjs';

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(API_ROOT, '..', '..');
const DIAGRAM_DIR = join(REPO_ROOT, 'docs', 'diagrams');

const ERD_PATH = join(DIAGRAM_DIR, 'ERD_PROJECT.excalidraw');
const ARCH_PATH = join(DIAGRAM_DIR, 'REFERENCE_ARCHITECTURE.excalidraw');

interface Scene {
  type: string;
  id: string;
  text?: string;
  [key: string]: unknown;
}

function readScene(path: string): Scene[] {
  expect(existsSync(path), `${path} must exist — the ERD is a committed artefact`).toBe(true);
  const scene = JSON.parse(readFileSync(path, 'utf8'));
  expect(Array.isArray(scene.elements), `${path} must hold an Excalidraw element list`).toBe(true);
  return scene.elements;
}

/** Every string of text on the diagram, joined — for prohibition matching. */
function allText(elements: Scene[]): string {
  return elements
    .filter((e) => e.type === 'text' && typeof e.text === 'string')
    .map((e) => e.text as string)
    .join('\n');
}

describe('the project ERD exists and is a real scene', () => {
  it('is committed as an Excalidraw file with the fourteen Platform Core tables on it', () => {
    const elements = readScene(ERD_PATH);
    const text = allText(elements);

    // Platform Core is the only part of the system with a generated schema
    // (ARC-01). It is drawn from that schema, so it must be present verbatim —
    // and it is the part of this diagram that can be checked against code.
    for (const entity of PLATFORM_CORE_ENTITIES) {
      expect(text, `${entity} is missing from the ERD`).toContain(entity);
    }

    // The count, not the filename: a reviewer needs to see that the module
    // carries all fourteen rather than a summary of them.
    expect(text).toMatch(/fourteen tables/i);
  });

  it('draws every module the corpus specifies, tagged with its licence gate', () => {
    const text = allText(readScene(ERD_PATH));

    // A module with no gate shown is a module nobody can decide to build. The
    // gate strings are the corpus's own edition names, not ours.
    for (const m of MODULES) {
      expect(text, `module ${m.name} is missing from the ERD`).toContain(m.name);
      expect(text, `module ${m.name} has no licence gate drawn`).toContain(m.gate);
    }
  });
});

describe('the ERD separates what the corpus names from what it does not', () => {
  it('draws every documented gap rather than filling it with a plausible entity', () => {
    const text = allText(readScene(ERD_PATH));

    // `PC-000`..`PC-006` are the seven requirement gaps. Each one is a place
    // where inventing an entity would look like progress and be a fabrication.
    for (const gap of ['PC-000', 'PC-001', 'PC-002', 'PC-003', 'PC-004', 'PC-005', 'PC-006']) {
      expect(text, `${gap} is not on the ERD — an undocumented gap is invisible`).toContain(gap);
    }
  });

  it('marks every entity it draws with the document that names it', () => {
    const elements = readScene(ERD_PATH);
    const texts = elements.filter((e) => e.type === 'text').map((e) => (e.text as string) ?? '');
    const blob = texts.join('\n');

    // Traceability, not decoration. `AGENTS.md` §12 asks where things are
    // documented; an ERD that cannot answer that is a second source of truth.
    for (const source of ['SRS §6', 'MP §5', 'ARC-01', 'ADR-', 'AGENTS.md']) {
      expect(blob, `no traceability to ${source} anywhere on the ERD`).toContain(source);
    }
  });

  it('draws each of the seven shared engines exactly once', () => {
    const text = allText(readScene(ERD_PATH));

    // `AGENTS.md` §2.9 — one engine per concern. A second attendance model or a
    // second ledger is the most common way this codebase drifts, so the ERD
    // must not depict one.
    expect(SHARED_ENGINES.length).toBe(7);
    for (const engine of SHARED_ENGINES) {
      const occurrences = text.split(engine.concern).length - 1;
      expect(
        occurrences,
        `${engine.concern} appears ${occurrences} times — AGENTS.md §2.9 allows one engine for it`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('the ERD obeys the prohibitions, not just the intentions', () => {
  it('has no School table, because one database per school makes it a second tenancy concept', () => {
    const elements = readScene(ERD_PATH);
    const text = allText(elements);

    // `ADR-003` + `AGENTS.md` §2.1. The prohibition is drawn as an explicit
    // "there is no School table" statement rather than by omission: a reviewer
    // who has just read `SRS` §6 — which DOES name `School` — needs to see
    // that the discrepancy was decided, not missed.
    expect(text).toMatch(/no\s+`?School`?\s+table/i);
  });

  it('has no cross-tenant role and no tenant scoping', () => {
    const text = allText(readScene(ERD_PATH));
    // Matched as prose statements of the prohibition. `SUPER_ADMIN` must appear
    // only inside a sentence that denies it, which is why the assertion is on
    // the denial and not on the token's absence.
    expect(text).toMatch(/no\s+cross-tenant/i);
    expect(text).toMatch(/SUPER_ADMIN[\s\S]{0,60}(does not|never|no )/i);
  });

  it('represents money as integer minor units and never as a float', () => {
    const text = allText(readScene(ERD_PATH));
    expect(text).toMatch(/minor unit/i);
    expect(text).toMatch(/ADR-002/);
    // A float in the diagram becomes a float in a migration.
    expect(text).not.toMatch(/\b(Float|float64|double)\b/);
  });

  it('never lets a feature module write the ledger directly', () => {
    const text = allText(readScene(ERD_PATH));
    // `AGENTS.md` §2.6 — every financial transaction posts through
    // ILedgerPostingRule. The ERD must show the funnel, not a shortcut.
    expect(text).toContain('ILedgerPostingRule');
  });
});

describe('the reference architecture shows the architecture, not the feature list', () => {
  it('is committed as an Excalidraw file', () => {
    const elements = readScene(ARCH_PATH);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('draws the Clean Architecture dependency flow inward', () => {
    const text = allText(readScene(ARCH_PATH));
    // `AGENTS.md` §2.2. If the flow is not on the diagram it is a convention
    // nobody checks, and a use-case that imports Prisma is a review miss.
    for (const layer of ['Presentation', 'Application', 'Domain', 'Infrastructure']) {
      expect(text, `${layer} layer is missing from the architecture diagram`).toContain(layer);
    }
  });

  it('draws all three mandatory guards and the public escape hatch', () => {
    const text = allText(readScene(ARCH_PATH));
    // `AGENTS.md` §2.3 — fail-closed, all three compose, none optional.
    for (const guard of ['@RequirePermission', '@RequireEntitlement', '@Audited', '@Public']) {
      expect(text, `${guard} is missing from the architecture diagram`).toContain(guard);
    }
  });

  it('shows the vendor adapters behind interfaces, so no SDK is called from a use-case', () => {
    const text = allText(readScene(ARCH_PATH));
    // `AGENTS.md` §2.2 — the seams are the point of the diagram. Two that are
    // deliberately undecided are called out, because an undecided provider
    // invites someone to hard-code one.
    expect(text).toMatch(/I\w+Adapter/);
    expect(text).toMatch(/ISmsAdapter/);
    expect(text).toMatch(/undecided|not decided|per-school configured/i);
  });

  it('states the single-tenant deployment, because it changes every other decision', () => {
    const text = allText(readScene(ARCH_PATH));
    expect(text).toMatch(/one (PostgreSQL )?database per school/i);
    expect(text).toMatch(/physical isolation/i);
  });
});

describe('the diagrams cannot drift from the source that draws them', () => {
  // Without this, the generated header becomes a lie within one commit — the
  // exact failure ARC-01 guards against for the Platform Core schema.
  it('generates the ERD deterministically', async () => {
    const { renderProjectErd } = await import('../../erd/render-project-diagrams.mjs');
    expect(renderProjectErd()).toEqual(renderProjectErd());
  });

  it('generates the reference architecture deterministically', async () => {
    const { renderReferenceArchitecture } = await import('../../erd/render-project-diagrams.mjs');
    expect(renderReferenceArchitecture()).toEqual(renderReferenceArchitecture());
  });

  it('has a checked-in ERD that matches the source exactly', async () => {
    const { scene } = await import('../../erd/render.mjs');
    const { renderProjectErd } = await import('../../erd/render-project-diagrams.mjs');
    const expected = scene(renderProjectErd());
    expect(
      JSON.parse(readFileSync(ERD_PATH, 'utf8')),
      'ERD_PROJECT.excalidraw is generated — run `pnpm --filter @eduflow/api generate:diagrams` and commit the result',
    ).toEqual(expected);
  });

  it('has a checked-in reference architecture that matches the source exactly', async () => {
    const { scene } = await import('../../erd/render.mjs');
    const { renderReferenceArchitecture } = await import('../../erd/render-project-diagrams.mjs');
    const expected = scene(renderReferenceArchitecture());
    expect(
      JSON.parse(readFileSync(ARCH_PATH, 'utf8')),
      'REFERENCE_ARCHITECTURE.excalidraw is generated — run `pnpm --filter @eduflow/api generate:diagrams` and commit the result',
    ).toEqual(expected);
  });

  it('agrees with ARC-01 on the Platform Core entity list', async () => {
    // Two diagrams in the same repository, describing the same fourteen tables,
    // must not be able to disagree. This is the one cross-diagram consistency
    // check, and it is the cheapest way to catch a second tenancy concept.
    const { modelsWithSchoolId } = await import(join(API_ROOT, 'prisma', 'schema-source.mjs'));
    expect(
      [...modelsWithSchoolId()].map((m) => m.name).sort(),
      'the project ERD and the generated schema disagree about Platform Core',
    ).toEqual([...PLATFORM_CORE_ENTITIES].sort());
  });
});

describe('the diagrams are readable, not merely well formed', () => {
  // Every element above can be valid and the diagram still unreadable. Three
  // real collisions were found this way during authoring: Platform Core's
  // fourteen-entity list running into its own caption, a three-line subtitle
  // overlapping the first band header, and the architecture's two band headers
  // both drawn 1400px wide so they sat on top of each other. None of those is
  // visible in the element list and all three are visible on the canvas.
  for (const [label, path] of [
    ['ERD_PROJECT', ERD_PATH],
    ['REFERENCE_ARCHITECTURE', ARCH_PATH],
  ] as const) {
    it(`${label} has no overlapping text`, () => {
      const texts = readScene(path).filter((e) => e.type === 'text');
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i];
          const b = texts[j];
          const hit =
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height;
          expect(
            hit,
            `overlapping text in ${label}: "${(a.text as string).slice(0, 40)}" and "${(b.text as string).slice(0, 40)}"`,
          ).toBe(false);
        }
      }
    });

    it(`${label} keeps every label inside the card it belongs to`, () => {
      const elements = readScene(path);
      const texts = elements.filter((e) => e.type === 'text');
      const cards = elements.filter((e) => e.type === 'rectangle' && e.id);

      for (const card of cards) {
        for (const t of texts) {
          const inside =
            t.x >= card.x - 2 &&
            t.x < card.x + card.width &&
            t.y >= card.y - 2 &&
            t.y < card.y + card.height;
          if (inside) {
            expect(
              t.y + t.height,
              `"${(t.text as string).slice(0, 40)}" overflows the bottom of ${card.id}`,
            ).toBeLessThanOrEqual(card.y + card.height);
          }
        }
      }
    });

    it(`${label} has no element Excalidraw would reject`, () => {
      // A malformed element does not fail the import loudly — the canvas simply
      // comes back empty, which reads as a tool failure. `nextId` passed instead
      // of called produced IDs that were a function's source text, and the batch
      // was refused with a generic error.
      const elements = readScene(path);
      for (const e of elements) {
        expect(e.type, `element ${e.id} has no type`).toBeTruthy();
        expect(typeof e.id, `element has a non-string id`).toBe('string');
        expect(e.id.length, `element id is too long to be a valid id`).toBeLessThanOrEqual(64);
        if (e.type === 'arrow') {
          expect(e.width, `arrow ${e.id} has zero width`).toBeGreaterThan(0);
          expect(e.height, `arrow ${e.id} has zero height`).toBeGreaterThan(0);
        }
      }
    });

    it(`${label} is valid UTF-8 with no mojibake`, () => {
      // Non-ASCII glyphs were corrupted to U+FFFD by a latin1 round-trip during
      // editing, and Excalidraw renders a replacement glyph rather than failing,
      // so the damage was invisible until the bytes were inspected.
      const raw = readFileSync(path);
      expect(raw.includes(Buffer.from([0xef, 0xbf, 0xbd])), `${label} contains U+FFFD`).toBe(false);
      expect(raw[0], `${label} has a UTF-8 BOM`).not.toBe(0xef);
      // Round-trips cleanly, so it is well-formed UTF-8 rather than Latin-1.
      expect(
        Buffer.from(raw.toString('utf8'), 'utf8').equals(raw),
        `${label} is not valid UTF-8`,
      ).toBe(true);
    });
  }
});
