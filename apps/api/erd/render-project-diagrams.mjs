/**
 * ARC-08 - renders the PROJECT ERD and the REFERENCE ARCHITECTURE as
 * Excalidraw elements from `project-erd-source.mjs`.
 *
 * The same discipline as ARC-01 applies: the picture is generated from the data
 * that also drives the gate, so the two cannot describe different systems. A
 * module added to the source appears on the canvas and in the test's
 * expectation at the same time, which is what makes the completeness test
 * meaningful rather than decorative.
 *
 * LAYOUT - why the ERD is not a field-level diagram
 * ------------------------------------------------
 * ARC-01 could draw fields because fourteen tables is fewer than nine clusters
 * of meaning. This diagram covers twenty-three modules, of which four have a
 * real schema. Drawing every named column of `NotificationDelivery` next to
 * seven requirement gaps would be unreadable and would imply the undesigned
 * modules are as settled as the designed one. So each module is a card: name,
 * licence gate, evidence tier, named entities, and the note that carries its
 * caveat. Fields belong in the generated schema; modules belong here.
 *
 * The gaps get their own band, deliberately not tucked inside the modules they
 * block. A gap drawn inside a module reads as "handled"; a gap drawn beside it
 * reads as open, which is the truth.
 *
 * A NOTE ON ENCODING
 * ------------------
 * Non-ASCII glyphs are written as `G.*` constants at the top of this file
 * rather than as literals in the strings below. That is not a style choice: an
 * earlier revision of this file lost every em dash, arrow and section sign to a
 * latin1 round-trip during editing, and the corruption was invisible in a
 * screenshot because Excalidraw renders a replacement glyph rather than
 * failing. Naming the characters once makes them greppable and stops the same
 * class of silent corruption.
 */
import {
  ARCH_ADAPTERS,
  ARCH_CLOSING,
  ARCH_DEPLOYMENT,
  ARCH_GUARDS,
  ARCH_LAYERS,
  ERD_PROHIBITIONS,
  ERD_STRUCTURE_RULES,
  ERD_TIER_NOTES,
  GAPS,
  MODULES,
  PLATFORM_CORE_ENTITIES,
  SHARED_ENGINES,
} from './project-erd-source.mjs';

const MONO = 3;

/** Named once, used everywhere. See the encoding note in the header. */
const G = {
  dot: '·',
  arrow: '→',
  emdash: '—',
  endash: '–',
  section: '§',
  cross: '✕',
  middot: '·',
};

/* Layout grid - every coordinate is a multiple of 4. */
const MARGIN = 32;
const HEADER_Y = 24;
const CARD_W = 400;
const CARD_H = 168;
const COL_GAP = 48;
const ROW_GAP = 48;
const PER_ROW = 3;

const TIER_STYLE = {
  SPECIFIED: { stroke: '#4f46e5', bg: '#e8ebff' },
  NAMED: { stroke: '#0e7490', bg: '#e0f5fa' },
  MODULE: { stroke: '#5b6270', bg: '#f1f2f5' },
};

const GAP_STYLE = { stroke: '#dc2626', bg: '#ffeaea' };
const ENGINE_STYLE = { stroke: '#7c3aed', bg: '#f3edff' };
const INK = '#161a23';
const MUTED = '#5b6270';

/**
 * One text element. Excalidraw measures nothing for us, so heights are derived.
 * Plain `.mjs` with no type annotations - this file is loaded by `node`
 * directly, not compiled, so a TypeScript annotation here is a syntax error
 * rather than a type.
 *
 * @param {number} x
 * @param {number} y
 * @param {string[]} lines
 * @param {number} size
 * @param {string} [colour]
 * @param {{ width?: number, align?: 'left' | 'center' }} [opts]
 */
function text(x, y, lines, size, colour = INK, opts = {}) {
  const w = opts.width ?? 400;
  const h = lines.length * (size + 6);
  return {
    type: 'text',
    x,
    y,
    width: w,
    height: h,
    text: lines.join('\n'),
    fontSize: size,
    fontFamily: MONO,
    textAlign: opts.align ?? 'left',
    verticalAlign: 'top',
    strokeColor: colour,
    backgroundColor: 'transparent',
  };
}

function box(x, y, w, h, stroke, bg, id, dash = 'solid') {
  return {
    type: 'rectangle',
    id,
    x,
    y,
    width: w,
    height: h,
    strokeColor: stroke,
    backgroundColor: bg,
    strokeWidth: 2,
    strokeStyle: dash,
    roughness: 0,
    roundness: { type: 3 },
    fillStyle: 'solid',
  };
}

function title(eyebrow, name, sub) {
  return {
    elements: [
      text(MARGIN, HEADER_Y, [eyebrow], 16, MUTED, { width: 1400 }),
      text(MARGIN, HEADER_Y + 24, [name], 34, INK, { width: 1400 }),
      text(MARGIN, HEADER_Y + 72, sub, 15, MUTED, { width: 1400 }),
    ],
    // The band below starts after the LAST subtitle line, not at a constant.
    // At three subtitle lines the constant put the first band header 3px inside
    // the subtitle block, which is invisible in the element list and only shows
    // as overlapping glyphs on the canvas.
    bottom: HEADER_Y + 72 + sub.length * 21 + 24,
  };
}

/* ------------------------------------------------------------------ *
 * The project ERD
 * ------------------------------------------------------------------ */

/**
 * Entities are wrapped so a long list stays inside the card. A card that grows
 * to fit forty names would break the grid, and a grid that breaks is a
 * diagram nobody can scan.
 */
function wrap(items, perLine = 3) {
  const out = [];
  for (let i = 0; i < items.length; i += perLine) {
    out.push(items.slice(i, i + perLine).join(` ${G.dot} `));
  }
  return out;
}

export function renderProjectErd() {
  const out = [];

  const head = title(
    `EDUFLOW ${G.dot} PROJECT ERD`,
    'The whole system, and what is still undesigned',
    [
      `One PostgreSQL database per school ${G.dot} physical isolation ${G.dot} school_id is metadata, never a control`,
      `Entities are drawn only where the corpus names them. Every PC-xxx gap is drawn as a gap, not filled with a plausible table.`,
      `Sources: SRS ${G.section}6 ${G.dot} MP ${G.section}5 ${G.dot} MP ${G.section}17.6${G.endash}17.10 ${G.dot} ARC-01 ${G.dot} ADR-003 ${G.dot} ADR-002 ${G.dot} AGENTS.md ${G.section}2.1${G.endash}${G.section}2.9`,
    ],
  );
  out.push(...head.elements);

  /* --- Band 1: modules ------------------------------------------------ */
  const bandTop = head.bottom;
  out.push(
    text(
      MARGIN,
      bandTop,
      [`01 ${G.dot} MODULES ${G.emdash} licence gate and evidence tier`],
      18,
      INK,
      { width: 1400 },
    ),
  );

  // Card height is derived, not fixed. Platform Core lists fourteen entities
  // and Academic lists fourteen more; at three per line that is five rows of
  // text, which a fixed 168px card cannot hold — the entity list ran into the
  // note underneath it. Every row takes the tallest card it contains, so the
  // grid stays regular and nothing collides.
  const NOTE_H = 26;
  const cardLayout = MODULES.map((m) => {
    const shown =
      m.name === 'Platform Core' || m.entities.length <= 15
        ? m.entities
        : [...m.entities.slice(0, 14), `+${m.entities.length - 14} named`];
    const entityLines = shown.length > 0 ? wrap(shown).length : 0;
    const noteLines = wrap([m.note], 1).length;
    const height = 78 + entityLines * 17 + 8 + noteLines * NOTE_H + 12;
    return { m, shown, entityLines, noteLines, height };
  });

  const rowHeights = [];
  cardLayout.forEach((c, i) => {
    const row = Math.floor(i / PER_ROW);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, c.height);
  });

  const rowTop = [bandTop + 32];
  for (let r = 1; r < rowHeights.length; r += 1) {
    rowTop[r] = rowTop[r - 1] + rowHeights[r - 1] + ROW_GAP;
  }

  cardLayout.forEach((c, i) => {
    const m = c.m;
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = MARGIN + col * (CARD_W + COL_GAP);
    const y = rowTop[row];
    const style = TIER_STYLE[m.tier];

    out.push(
      box(x, y, CARD_W, c.height, style.stroke, style.bg, `mod_${m.name.replace(/\W+/g, '_')}`),
    );

    out.push(
      text(x + 16, y + 12, [m.name], 17, style.stroke, { width: CARD_W - 32 }),
      text(x + 16, y + 36, [`gate: ${m.gate}`], 12, INK, { width: CARD_W - 32 }),
      text(x + 16, y + 56, [`${m.tier} ${G.dot} ${m.source}`], 11, MUTED, { width: CARD_W - 32 }),
    );

    if (c.entityLines > 0) {
      out.push(text(x + 16, y + 78, wrap(c.shown), 11, INK, { width: CARD_W - 32 }));
    }
    // The note sits BELOW the entity list, whatever the list's length — that
    // ordering is the fix. It used to be pinned to a fixed offset from the card
    // top, which collided as soon as a module had more than three entities.
    out.push(
      text(x + 16, y + 86 + c.entityLines * 17, wrap([m.note], 1), 11, MUTED, {
        width: CARD_W - 32,
      }),
    );
  });

  const modulesBottom = rowTop[rowTop.length - 1] + rowHeights[rowHeights.length - 1];

  /* --- Band 2: gaps --------------------------------------------------- */
  const gapTop = modulesBottom + 24;
  out.push(
    text(
      MARGIN,
      gapTop,
      [
        `02 ${G.dot} REQUIREMENT GAPS ${G.emdash} drawn, because a gap that is not visible is not managed`,
      ],
      18,
      GAP_STYLE.stroke,
      { width: 1400 },
    ),
  );

  const GAP_W = 392;
  GAPS.forEach((g, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = MARGIN + col * (GAP_W + COL_GAP);
    const y = gapTop + 32 + row * (CARD_H + 24);
    out.push(box(x, y, GAP_W, CARD_H - 24, GAP_STYLE.stroke, GAP_STYLE.bg, `gap_${g.id}`));
    out.push(
      text(x + 16, y + 12, [`${g.id} ${G.dot} ${g.title}`], 16, GAP_STYLE.stroke, {
        width: GAP_W - 32,
      }),
      text(x + 16, y + 38, wrap([g.detail], 1), 11, INK, { width: GAP_W - 32 }),
      text(x + 16, y + 96, [`blocks: ${g.blocks}`], 11, MUTED, { width: GAP_W - 32 }),
      text(x + 16, y + 116, ['status: NEEDS DESIGN - no entity drawn'], 11, GAP_STYLE.stroke, {
        width: GAP_W - 32,
      }),
    );
  });

  /* --- Band 3: shared engines ---------------------------------------- */
  const engineTop = gapTop + 32 + Math.ceil(GAPS.length / PER_ROW) * (CARD_H + 24) + 24;
  out.push(
    text(
      MARGIN,
      engineTop,
      [`03 ${G.dot} SHARED ENGINES ${G.emdash} one per concern (AGENTS.md ${G.section}2.9)`],
      18,
      ENGINE_STYLE.stroke,
      { width: 1400 },
    ),
  );

  const ENG_W = 392;
  SHARED_ENGINES.forEach((e, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = MARGIN + col * (ENG_W + COL_GAP);
    const y = engineTop + 32 + row * (176 + 24);
    out.push(
      box(
        x,
        y,
        ENG_W,
        176,
        ENGINE_STYLE.stroke,
        ENGINE_STYLE.bg,
        `eng_${e.concern.replace(/\W+/g, '_')}`,
      ),
    );
    out.push(
      text(x + 16, y + 12, [e.concern], 16, ENGINE_STYLE.stroke, { width: ENG_W - 32 }),
      text(x + 16, y + 38, wrap([`one engine: ${e.engine}`], 1), 11, INK, { width: ENG_W - 32 }),
      text(x + 16, y + 58, wrap([`seam: ${e.seam}`], 1), 11, MUTED, { width: ENG_W - 32 }),
      text(x + 16, y + 78, wrap([`covers: ${e.covers}`], 1), 11, INK, { width: ENG_W - 32 }),
      text(x + 16, y + 118, wrap([`never: ${e.forbids}`], 1), 11, GAP_STYLE.stroke, {
        width: ENG_W - 32,
      }),
    );
  });

  /* --- Band 4: structure rules + prohibitions ------------------------- */
  const ruleTop = engineTop + 32 + Math.ceil(SHARED_ENGINES.length / PER_ROW) * (176 + 24) + 24;
  out.push(
    text(MARGIN, ruleTop, [`04 ${G.dot} STRUCTURE RULES AND PROHIBITIONS`], 18, INK, {
      width: 1400,
    }),
  );

  ERD_STRUCTURE_RULES.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const w = 640;
    const x = MARGIN + col * (w + 32);
    const y = ruleTop + 32 + row * 140;
    out.push(box(x, y, w, 124, '#4f46e5', '#ffffff'));
    out.push(
      text(x + 16, y + 12, [r.heading], 15, '#4f46e5', { width: w - 32 }),
      text(x + 16, y + 36, wrap([r.body], 1), 11, INK, { width: w - 32 }),
    );
  });

  const prohTop = ruleTop + 32 + Math.ceil(ERD_STRUCTURE_RULES.length / 2) * 140;
  const prohW = 1312;
  out.push(
    box(
      MARGIN,
      prohTop,
      prohW,
      24 + ERD_PROHIBITIONS.length * 24 + 12,
      GAP_STYLE.stroke,
      GAP_STYLE.bg,
    ),
  );
  out.push(
    text(
      MARGIN + 16,
      prohTop + 12,
      ['What this diagram deliberately does not show'],
      14,
      GAP_STYLE.stroke,
      { width: prohW - 32 },
    ),
    ...ERD_PROHIBITIONS.map((p, i) =>
      text(MARGIN + 16, prohTop + 40 + i * 24, [`${G.cross} ${p}`], 12, INK, { width: prohW - 32 }),
    ),
  );

  /* --- Legend --------------------------------------------------------- */
  const legendTop = prohTop + 24 + ERD_PROHIBITIONS.length * 24 + 12 + 24;
  // One extra line of height for the closing Platform Core sentence. It sat
  // outside the legend box and over the page edge before this was counted.
  const legendH = 40 + (ERD_TIER_NOTES.length + 1) * 24 + 16;
  out.push(box(MARGIN, legendTop, prohW, legendH, '#c9ced8', '#f7f8fb'));
  out.push(
    text(
      MARGIN + 16,
      legendTop + 12,
      ['Evidence tier - the most important column on this diagram'],
      14,
      INK,
      { width: prohW - 32 },
    ),
    ...ERD_TIER_NOTES.map((n, i) =>
      text(MARGIN + 16, legendTop + 40 + i * 24, [n], 12, INK, { width: prohW - 32 }),
    ),
    text(
      MARGIN + 16,
      legendTop + 40 + ERD_TIER_NOTES.length * 24,
      [
        `Platform Core alone has a generated schema: ${PLATFORM_CORE_ENTITIES.length} tables (ARC-01). Everything else is drawn at the tier its evidence supports.`,
      ],
      12,
      MUTED,
      { width: prohW - 32 },
    ),
  );

  return out;
}

/* ------------------------------------------------------------------ *
 * The reference architecture
 * ------------------------------------------------------------------ */

export function renderReferenceArchitecture() {
  const out = [];

  const head = title(
    `EDUFLOW ${G.dot} REFERENCE ARCHITECTURE`,
    'Where the boundaries are, and what stops them moving',
    [
      `Clean Architecture, dependencies inward: Presentation ${G.arrow} Application ${G.arrow} Domain ${G.arrow} Infrastructure (AGENTS.md ${G.section}2.2)`,
      `A file under domain/ or use-cases/ may not import @nestjs/*, Prisma, BullMQ, any UI library, or any vendor SDK.`,
      `Sources: AGENTS.md ${G.section}2.1${G.endash}${G.section}2.15 ${G.dot} ADR-002 ${G.dot} ADR-003 ${G.dot} ADR-004 ${G.dot} ADR-013 ${G.dot} ADR-015`,
    ],
  );
  out.push(...head.elements);

  /* --- Layer stack ---------------------------------------------------- */
  const stackTop = head.bottom;
  out.push(
    text(
      MARGIN,
      stackTop,
      [`01 ${G.dot} CLEAN ARCHITECTURE ${G.emdash} every boundary states what it may import`],
      18,
      INK,
      {
        // Sized to the layer column, not the full page. At 1400px wide this
        // header's box ran under the guard header and the two overlapped.
        width: 880,
      },
    ),
  );

  ARCH_LAYERS.forEach((l, i) => {
    const y = stackTop + 32 + i * 112;
    const w = 880;
    out.push(box(MARGIN, y, w, 96, '#4f46e5', '#e8ebff', `layer_${i}`));
    out.push(
      text(MARGIN + 16, y + 12, [`${l.name} ${G.emdash} ${l.detail}`], 15, '#4f46e5', {
        width: w - 32,
      }),
      text(MARGIN + 16, y + 38, [`may import: ${l.may}`], 11, INK, { width: w - 32 }),
      text(MARGIN + 16, y + 58, [`may NOT: ${l.mayNot}`], 11, '#dc2626', { width: w - 32 }),
    );
  });

  // The inward arrows, drawn once between the layers they actually bind.
  // Excalidraw rejects a zero-width element, so a purely vertical connector is
  // given a 1px run and a real ID - a rejected batch leaves the canvas empty
  // and looks like a tool failure rather than a bad element.
  for (let i = 0; i < ARCH_LAYERS.length - 1; i += 1) {
    const y = stackTop + 32 + i * 112 + 96;
    out.push({
      type: 'arrow',
      id: `dep_${i}`,
      x: MARGIN + 60,
      y,
      width: 1,
      height: 16,
      points: [
        [0, 0],
        [1, 16],
      ],
      strokeColor: '#4f5d75',
      backgroundColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      startArrowhead: null,
      endArrowhead: 'arrow',
    });
  }

  /* --- Guards --------------------------------------------------------- */
  // The guard column starts at the same y as the layer stack but is narrower,
  // so its own band header sits beside the layer header rather than under it.
  // Both used to be drawn at `stackTop`, and the layer header is 1400px wide,
  // which put the two headers on top of each other.
  const guardX = MARGIN + 920;
  const guardW = 424;
  out.push(
    text(
      guardX,
      stackTop,
      [`02 ${G.dot} EVERY ROUTE ${G.emdash} fail-closed, all three compose`],
      18,
      '#dc2626',
      {
        width: guardW,
      },
    ),
  );

  ARCH_GUARDS.forEach((g, i) => {
    const y = stackTop + 32 + i * 112;
    out.push(box(guardX, y, guardW, 96, '#dc2626', '#ffeaea', `guard_${i}`));
    out.push(
      text(guardX + 16, y + 12, [g.decorator], 14, '#dc2626', { width: guardW - 32 }),
      text(guardX + 16, y + 36, wrap([g.enforces], 1), 11, INK, { width: guardW - 32 }),
      text(guardX + 16, y + 70, wrap([g.note], 1), 11, MUTED, { width: guardW - 32 }),
    );
  });

  out.push(
    text(
      guardX,
      stackTop + 32 + ARCH_GUARDS.length * 112 + 8,
      [
        'A route with neither @RequirePermission nor @Public is a defect - CI fails on it, not a reviewer.',
      ],
      11,
      '#dc2626',
      { width: guardW + 200 },
    ),
  );

  /* --- Adapters ------------------------------------------------------- */
  const adapterTop = stackTop + 32 + Math.max(ARCH_LAYERS.length, ARCH_GUARDS.length) * 112 + 40;
  out.push(
    text(
      MARGIN,
      adapterTop,
      [
        `03 ${G.dot} VENDOR SEAMS ${G.emdash} a use-case never calls a vendor SDK (AGENTS.md ${G.section}2.2)`,
      ],
      18,
      '#7c3aed',
      { width: 1400 },
    ),
  );

  const ADAPT_COLS = 3;
  const ADAPT_W = 424;
  ARCH_ADAPTERS.forEach((a, i) => {
    const col = i % ADAPT_COLS;
    const row = Math.floor(i / ADAPT_COLS);
    const x = MARGIN + col * (ADAPT_W + 32);
    const y = adapterTop + 32 + row * 84;
    const undecided = a.state === 'undecided';
    out.push(
      box(
        x,
        y,
        ADAPT_W,
        68,
        undecided ? '#dc2626' : '#7c3aed',
        undecided ? '#ffeaea' : '#f3edff',
        `adapter_${i}`,
      ),
      text(x + 16, y + 10, [a.port], 13, undecided ? '#dc2626' : '#7c3aed', {
        width: ADAPT_W - 32,
      }),
      text(x + 16, y + 32, wrap([`${G.arrow} ${a.vendors}`], 1), 11, INK, { width: ADAPT_W - 32 }),
    );
    if (undecided) {
      out.push(
        text(x + 16, y + 50, ['provider deliberately undecided'], 10, '#dc2626', {
          width: ADAPT_W - 32,
        }),
      );
    }
  });

  /* --- Deployment ----------------------------------------------------- */
  const depTop = adapterTop + 32 + Math.ceil(ARCH_ADAPTERS.length / ADAPT_COLS) * 84 + 32;
  out.push(
    text(
      MARGIN,
      depTop,
      [`04 ${G.dot} DEPLOYMENT ${G.emdash} one school, one deployment, one database`],
      18,
      INK,
      {
        width: 1312,
      },
    ),
  );
  // Height is derived: title + wrapped body + one line per store + the note.
  // It was short by one line, which pushed the closing note out of the box.
  const depBodyLines = wrap([ARCH_DEPLOYMENT.body], 1).length;
  const depH = 40 + depBodyLines * 21 + 16 + ARCH_DEPLOYMENT.stores.length * 32 + 32;
  const depBodyY = depTop + 32;
  out.push(box(MARGIN, depBodyY, 1312, depH, '#0e7490', '#e0f5fa', 'deployment'));
  out.push(
    text(MARGIN + 16, depBodyY + 12, [ARCH_DEPLOYMENT.title], 16, '#0e7490', { width: 1280 }),
    text(MARGIN + 16, depBodyY + 38, wrap([ARCH_DEPLOYMENT.body], 1), 11, INK, { width: 1280 }),
    ...ARCH_DEPLOYMENT.stores.map((s, i) =>
      text(
        MARGIN + 16,
        depBodyY + 38 + depBodyLines * 21 + 12 + i * 32,
        [`${s.name} ${G.emdash} ${s.role}`],
        12,
        INK,
        { width: 1280 },
      ),
    ),
    text(
      MARGIN + 16,
      depBodyY + 38 + depBodyLines * 21 + 12 + ARCH_DEPLOYMENT.stores.length * 32 + 8,
      [ARCH_DEPLOYMENT.note],
      11,
      MUTED,
      { width: 1280 },
    ),
  );

  /* --- Closing rules -------------------------------------------------- */
  const closeTop = depBodyY + depH + 32;
  out.push(
    box(
      MARGIN,
      closeTop,
      1312,
      24 + ARCH_CLOSING.length * 24 + 12,
      '#c9ced8',
      '#f7f8fb',
      'closing',
    ),
  );
  out.push(
    text(
      MARGIN + 16,
      closeTop + 12,
      ['Rules that change how the rest of the system behaves'],
      14,
      INK,
      { width: 1280 },
    ),
    ...ARCH_CLOSING.map((c, i) =>
      text(MARGIN + 16, closeTop + 40 + i * 24, [`${G.middot} ${c}`], 12, INK, { width: 1280 }),
    ),
  );

  return out;
}
