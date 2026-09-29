/**
 * ARC-01 — renders `apps/api/prisma/schema.prisma` from `schema-source.mjs`.
 *
 * Pure function: same source in, byte-identical text out. `prisma-schema.spec.ts`
 * asserts that determinism, so an edit to the source that produces an unstable
 * schema fails the gate instead of producing a spurious diff.
 */
import { modelsWithSchoolId, ENUMS } from './schema-source.mjs';

const HEADER = `// EduFlow Prisma schema — GENERATED. Do not edit by hand.
//
// Source of truth: apps/api/prisma/schema-source.mjs
// Diagram:        docs/diagrams/ERD_PLATFORM_CORE.excalidraw
// Decision record:docs/diagrams/ERD_PLATFORM_CORE.md
// Gate:           apps/api/src/config/prisma-schema.spec.ts
//
// Regenerate with:  pnpm --filter @eduflow/api generate:schema
//
// WHY GENERATED RATHER THAN HAND-WRITTEN
// -------------------------------------
// D22 left this file empty because "a plausible-but-invented schema is worse
// than none". Generating it from the same source the ERD is drawn from means
// the diagram and the schema cannot describe two different systems — which is
// the drift AGENTS.md §6 calls the most common way this codebase goes wrong.
// The invariants below are therefore enforced by a test that fails, not by a
// reviewer who has to remember them.
//
// FIVE INVARIANTS, EACH WITH A TEST THAT WATCHES IT FIRE
// ----------------------------------------------------
//  1. One PostgreSQL database per school (ADR-003, AGENTS.md §2.1). Data
//     isolation is PHYSICAL, so a missing WHERE clause cannot leak across
//     schools and tenant-scoping machinery would defend against nothing.
//     Every model carries school_id as METADATA — for auditability and
//     licence portability — and it is NOT a foreign key, because there is no
//     School table and inventing one would be a second tenancy concept.
//     There is no SUPER_ADMIN cross-tenant role: there is nothing cross-tenant
//     to administer, and the highest role is an in-school administrator.
//
//  2. Money is integer minor units with an explicit currency (ADR-002,
//     AGENTS.md §2.5). No Float and no Decimal appears anywhere in this file,
//     and the gate fails if one is added. Scale and rounding mode are
//     per-school settings on school_settings, never constants.
//
//  3. Uniqueness is scoped WITHIN one school's database, never assumed global
//     (ADR-003). Every unique constraint therefore leads with school_id. The
//     legacy app's 14 global @unique constraints assumed a shared database and
//     are on the do-not-reuse list.
//
//  4. audit_records is APPEND-ONLY (AGENTS.md §2.7). No updatedAt, no deletedAt,
//     no foreign key to users. UPDATE and DELETE are revoked from the
//     application role by apps/api/prisma/hardening/audit-immutability.sql —
//     a rule nothing enforces is a suggestion.
//
//  5. Exactly fourteen entities, listed in docs/work/TODO.md item 3. No
//     Student, Class or Teacher: PLT-203 and PLT-801 build ownership and
//     file-access policies against abstract ports with fakes, so inventing
//     those rows here would be a second source of truth for a module that
//     does not exist yet.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;

const snake = (pascal) =>
  pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

function wrapComment(lines, indent) {
  const arr = typeof lines === 'string' ? [lines] : lines;
  return arr.map((l) => `${indent}/// ${l}`.trimEnd()).join('\n');
}

function renderField(f) {
  const optional = f.attrs.includes('?') && !f.type.endsWith('?');
  const type = optional ? `${f.type}?` : f.type;
  const attrs = f.attrs.filter((a) => a !== '?');
  // Derive @map when the column name differs, so no field can be added without
  // its snake_case name. Hand-written @map on each field was tried first and
  // three were forgotten within one draft — which is how `audit_records`
  // silently became `audit_record` and made the REVOKE statement a lie.
  const column = snake(f.name);
  // Prisma forbids @map on a relation field, so only scalar columns are mapped.
  if (f.kind !== 'relation' && column !== f.name && !attrs.some((a) => a.startsWith('@map('))) {
    attrs.push(`@map("${column}")`);
  }
  const line = [f.name, type, ...attrs].join(' ').replace(/\s+/g, ' ').trim();
  // The doc comment must end in a newline, or its last line swallows the
  // field declaration and Prisma reports the field as missing.
  const prefix = f.comment ? `${wrapComment(f.comment, '  ')}\n  ` : '  ';
  return `${prefix}${line}`;
}

function renderEnum(e) {
  return `${wrapComment(e.comment, '')}\nenum ${e.name} {\n${e.values
    .map((v) => `  ${v}`)
    .join('\n')}\n}`;
}

function renderModel(m) {
  const lines = [];
  // Every field is emitted. `invisible` means "not labelled in the ERD", which
  // is true of a relation's inverse side — but it is still a real column or
  // relation as far as Prisma is concerned, and dropping it breaks the pair.
  for (const f of m.fields) {
    lines.push(renderField(f));
  }
  for (const i of m.indexes ?? []) lines.push(`  ${i}`);
  if (m.idAttr) lines.push(`  ${m.idAttr}`);
  for (const u of m.uniques ?? []) lines.push(`  ${u}`);
  // The table name is written out in the source, not pluralised by a rule:
  // `Person` -> `people` is why guessed plurals are wrong, and this name is
  // the one the REVOKE statement and every GRANT refer to.
  lines.push(`  @@map("${m.table}")`);
  return `${wrapComment(m.comment, '')}\nmodel ${m.name} {\n${lines.join('\n')}\n}`;
}

export function renderPrismaSchema() {
  const parts = [HEADER];
  for (const e of ENUMS) parts.push(renderEnum(e));
  for (const m of modelsWithSchoolId()) parts.push(renderModel(m));
  return `${parts.join('\n\n')}\n`;
}
