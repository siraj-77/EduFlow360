/**
 * ARC-01 — renders the ERD as Excalidraw elements from `schema-source.mjs`.
 *
 * The field lists, the relation edges and the free-floating tables all come
 * from the same objects that produce `schema.prisma`. A field added to a model
 * appears in the picture; a relation removed from the schema loses its arrow.
 * That is the whole point — D22 deferred the schema because a plausible-looking
 * ERD and a plausible-looking schema would eventually disagree, and a reviewer
 * would have to decide which was right.
 *
 * Edge vocabulary, because the distinction is the interesting part:
 *   solid  — a declared foreign key with a constraint behind it
 *   dashed — a reference by value, no foreign key, on purpose
 *   SchoolSettings, License and ModuleRegistry have NO outgoing edge at all,
 *   because they have no foreign key to declare.
 *
 * Arrows are UNBOUND and carry explicit orthogonal waypoints through the gaps
 * between columns. Bound arrows re-route themselves to the nearest edge, which
 * put eleven of thirteen straight through unrelated boxes on the first pass;
 * a diagram whose relations cross the labels is not readable, so the routing
 * is authored instead of inferred.
 */
import { modelsWithSchoolId, FK_FREE_MODELS } from './schema-source.mjs';

const MONO = 3;
const W = 400;
const PAD = 14;
const BOTTOM_PAD = 10;
const TITLE_H = 44;
const LINE_H = 16;
const FIELD_FONT = 11;
const TITLE_FONT = 15;

const CLUSTER = {
  Permission: 'RBAC',
  RolePermission: 'RBAC',
  Role: 'RBAC',
  User: 'Identity',
  Session: 'Identity',
  RefreshToken: 'Identity',
  AuditRecord: 'Compliance',
  ErrorLog: 'Compliance',
  SchoolSettings: 'Configuration',
  ModuleRegistry: 'Configuration',
  License: 'Configuration',
  NotificationPreference: 'Messaging & files',
  NotificationDelivery: 'Messaging & files',
  StoredFile: 'Messaging & files',
};

const CLUSTER_STYLE = {
  RBAC: { stroke: '#7c3aed', background: '#f3edff' },
  Identity: { stroke: '#4f46e5', background: '#e8ebff' },
  Compliance: { stroke: '#dc2626', background: '#ffeaea' },
  Configuration: { stroke: '#0e7490', background: '#e0f5fa' },
  'Messaging & files': { stroke: '#047857', background: '#e2f6ec' },
};

// Boxes start below the header. The canvas draws its own toolbar across the
// top of the viewport, so a header at y=0 is legible in the exported file and
// invisible in the app that renders it.
const HEADER_Y = 130;

function maxBottom(boxes) {
  return Math.max(...[...boxes.values()].map((b) => b.y + b.height));
}

function text(x, y, w, lines, size, colour, { align = 'left' } = {}) {
  return {
    type: 'text',
    x,
    y,
    width: w,
    height: lines.length * LINE_H,
    text: lines.join('\n'),
    fontSize: size,
    fontFamily: MONO,
    textAlign: align,
    verticalAlign: 'top',
    strokeColor: colour,
    backgroundColor: 'transparent',
  };
}

/** `name  Type` with a PK / FK marker, sized to fit the box. */
function erdLine(f) {
  if (f.kind === 'id') return `PK  ${f.name}`;
  if (f.kind === 'softref') return `▶  ${f.name} → ${f.to}  (no FK)`;
  if (f.kind === 'relation') return `▶  ${f.name} → ${f.to}`;
  return `${f.name}  ${f.type}`;
}

function boxHeight(model) {
  return TITLE_H + PAD + model.fields.filter((f) => !f.invisible).length * LINE_H + BOTTOM_PAD;
}

/**
 * Route an edge orthogonally: leave the box on the side facing the target,
 * travel down the clear channel between the two columns, enter the target on
 * its facing side.
 *
 * Two rules make this readable rather than merely orthogonal:
 *
 *  - The channel is a GAP, never a column. Centre-to-centre midpoints were
 *    tried first and put eleven of thirteen arrows through unrelated boxes,
 *    because a three-column hop's midpoint lands in the middle column.
 *  - Arrows sharing a channel are spread across it by index. Five edges leave
 *    `users` for the right-hand column; without the offset they draw on top of
 *    each other and only the last one is visible.
 *
 * Same-column pairs bulge into the empty channel to the right, because a
 * straight vertical line would run through the box they are routed past.
 */
function route(from, to, index) {
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const spread = ((index % 5) - 2) * 13;

  if (Math.abs(from.x - to.x) < 1) {
    const exit = { x: from.x + from.width, y: a.y };
    const entry = { x: to.x + to.width, y: b.y };
    const laneX = from.x + from.width + 26 + (index % 3) * 18;
    return {
      x: exit.x,
      y: exit.y,
      points: [
        [0, 0],
        [laneX - exit.x, 0],
        [laneX - exit.x, entry.y - exit.y],
        [entry.x - exit.x, entry.y - exit.y],
      ],
    };
  }

  const rightwards = b.x > a.x;
  const exit = { x: rightwards ? from.x + from.width : from.x, y: a.y };
  const entry = { x: rightwards ? to.x : to.x + to.width, y: b.y };
  const laneX = (exit.x + entry.x) / 2 + spread;
  return {
    x: exit.x,
    y: exit.y,
    points: [
      [0, 0],
      [laneX - exit.x, 0],
      [laneX - exit.x, entry.y - exit.y],
      [entry.x - exit.x, entry.y - exit.y],
    ],
  };
}

export function renderErdElements() {
  const models = modelsWithSchoolId();

  const boxes = new Map();
  for (const m of models) {
    const style = CLUSTER_STYLE[CLUSTER[m.name]];
    boxes.set(m.name, {
      id: `box_${m.name}`,
      type: 'rectangle',
      x: m.erd.x,
      y: m.erd.y + HEADER_Y,
      width: W,
      height: boxHeight(m),
      strokeColor: style.stroke,
      backgroundColor: style.background,
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      roundness: { type: 3 },
      fillStyle: 'solid',
      _name: m.name,
    });
  }

  const edges = [];
  for (const m of models) {
    for (const f of m.fields) {
      if (f.inverse || f.self || !f.to || !boxes.has(f.to)) continue;
      const dashed = f.kind === 'softref';
      if (!dashed && !f.fk) continue;
      edges.push({ from: m.name, to: f.to, dashed, id: `edge_${m.name}_${f.name}` });
    }
  }

  const out = [];

  out.push(
    text(0, HEADER_Y, 1400, ['EduFlow — Platform Core ERD'], 30, '#161a23'),
    text(
      0,
      HEADER_Y + 40,
      1600,
      [
        'One PostgreSQL database per school · physical isolation · no tenant scoping · no cross-tenant role',
        'Generated from apps/api/prisma/schema-source.mjs — the same source that generates schema.prisma',
        'Every unique constraint is scoped by school_id. audit_records is append-only and has no foreign key to users.',
      ],
      14,
      '#5b6270',
    ),
  );

  for (const m of models) {
    const b = boxes.get(m.name);
    const style = CLUSTER_STYLE[CLUSTER[m.name]];
    out.push(b);

    out.push(
      text(b.x + PAD, b.y + 8, W - PAD * 2, [m.name], TITLE_FONT, style.stroke),
      text(b.x + PAD, b.y + 28, W - PAD * 2, [m.table], 11, '#5b6270'),
    );

    out.push(
      text(
        b.x + PAD,
        b.y + TITLE_H,
        W - PAD * 2,
        m.fields.filter((f) => !f.invisible).map(erdLine),
        FIELD_FONT,
        '#161a23',
      ),
    );
  }

  for (const [i, e] of edges.entries()) {
    const from = boxes.get(e.from);
    const to = boxes.get(e.to);
    const r = route(from, to, i);
    const last = r.points[r.points.length - 1];
    out.push({
      id: e.id,
      type: 'arrow',
      x: r.x,
      y: r.y,
      width: last[0],
      height: last[1],
      points: r.points,
      strokeColor: e.dashed ? '#8a8f98' : '#4f46e5',
      backgroundColor: 'transparent',
      strokeWidth: e.dashed ? 1 : 2,
      strokeStyle: e.dashed ? 'dashed' : 'solid',
      roughness: 0,
      startArrowhead: null,
      endArrowhead: 'arrow',
      _name: `${e.from}->${e.to}`,
    });
  }

  out.push(...legend(maxBottom(boxes) + 60));

  return out;
}

function legend(y) {
  const rows = [
    ['solid arrow', 'declared foreign key, with a constraint behind it'],
    ['dashed arrow', 'reference by value — no foreign key, on purpose'],
    [
      'no arrow at all',
      `${FK_FREE_MODELS.map((m) => m.model).join(', ')} — no foreign key to declare`,
    ],
    ['replacedByTokenId', 'self-pointer, not a Prisma relation: a rotation chain is a DAG'],
    ['▶ / PK', 'foreign key column / primary key'],
  ];
  const x = 0;
  const w = 1560;
  return [
    {
      type: 'rectangle',
      x,
      y,
      width: w,
      height: 60 + rows.length * 20,
      strokeColor: '#c9ced8',
      backgroundColor: '#f7f8fb',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 0,
      roundness: { type: 3 },
      fillStyle: 'solid',
    },
    text(x + 18, y + 12, w - 36, ['Edge vocabulary — how to read the arrows'], 14, '#161a23'),
    ...rows.map((r, i) =>
      text(x + 18, y + 38 + i * 20, w - 36, [`${r[0]}  —  ${r[1]}`], 12, '#3a4150'),
    ),
  ];
}

export { FK_FREE_MODELS, CLUSTER_STYLE };
