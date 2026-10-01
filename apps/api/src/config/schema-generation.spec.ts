/**
 * ARC-01 — the anti-drift half of the schema gate.
 *
 * `prisma-schema.spec.ts` checks that schema.prisma satisfies the constraints.
 * This file checks three things that constrain the *process* around it:
 *
 *   1. schema.prisma is byte-identical to freshly generated output, so nobody
 *      hand-edits the generated file. Without this, the generated header is a
 *      lie within one commit.
 *   2. The generator is deterministic. A schema whose text changes between
 *      runs on an unchanged source produces a diff nobody can review, and it
 *      would silently defeat (1) by making the checked-in file always stale.
 *   3. The ERD is drawn from the same field lists, so the picture and the
 *      schema cannot describe two different systems. This is the specific
 *      failure D22 deferred the schema to avoid.
 *
 * Plus the one constraint Prisma itself cannot express: `audit_records` is
 * append-only, and that is a database privilege, not a schema attribute.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(API_ROOT, '..', '..');
const PRISMA_DIR = join(API_ROOT, 'prisma');
const SCHEMA_PATH = join(PRISMA_DIR, 'schema.prisma');
const HARDENING_PATH = join(PRISMA_DIR, 'hardening', 'audit-immutability.sql');

describe('generated artefacts cannot drift from their source', () => {
  it('produces the same schema text on every run', async () => {
    const { renderPrismaSchema } = await import(join(PRISMA_DIR, 'render-prisma.mjs'));
    expect(renderPrismaSchema()).toBe(renderPrismaSchema());
  });

  it('has a checked-in schema.prisma that matches the source exactly', async () => {
    const { renderPrismaSchema } = await import(join(PRISMA_DIR, 'render-prisma.mjs'));
    const { formatSchema } = await import(join(PRISMA_DIR, 'generate.mjs'));
    // Compared against the generator's real output, `prisma format` included.
    // Comparing against the raw renderer instead would fail the moment anyone
    // ran `prisma format` — which is exactly the drift this gate is for, so
    // the fix belongs in the generator, not in a weakened assertion.
    const scratch = join(mkdtempSync(join(tmpdir(), 'eduflow-arc01-')), 'schema.prisma');
    writeFileSync(scratch, renderPrismaSchema(), 'utf8');
    expect(formatSchema(scratch), 'prisma CLI must be available to canonicalise the schema').toBe(
      true,
    );

    const checkedIn = readFileSync(SCHEMA_PATH, 'utf8');
    expect(
      checkedIn,
      'schema.prisma is generated — run `pnpm --filter @eduflow/api generate:schema` and commit the result',
    ).toBe(readFileSync(scratch, 'utf8'));
  });

  it('has a checked-in ERD element list that matches the source exactly', async () => {
    const { renderErdElements } = await import(join(PRISMA_DIR, 'render-erd.mjs'));
    const path = join(REPO_ROOT, 'docs', 'diagrams', 'ERD_PLATFORM_CORE.elements.json');
    expect(existsSync(path), `${path} must exist — run the generator`).toBe(true);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(renderErdElements());
  });
});

describe('the ERD is drawn from the schema, not maintained beside it', () => {
  it('draws one box per model, titled with the model name', async () => {
    const { modelsWithSchoolId } = await import(join(PRISMA_DIR, 'schema-source.mjs'));
    const { renderErdElements } = await import(join(PRISMA_DIR, 'render-erd.mjs'));
    const elements = renderErdElements();
    // The title and the table name are separate text elements on separate
    // lines. They were one line until `NotificationPreference  ·
    // notification_preferences` overflowed its box, which is why the box
    // width is a test-visible concern rather than a styling detail.
    const titles = elements
      .filter((e) => e.type === 'text' && e.fontSize === 15)
      .map((e) => e.text);

    expect(titles.sort()).toEqual(
      modelsWithSchoolId()
        .map((m) => m.name)
        .sort(),
    );
  });

  it('labels every box with the fields the schema declares, and the labels fit', async () => {
    const { modelsWithSchoolId } = await import(join(PRISMA_DIR, 'schema-source.mjs'));
    const { renderErdElements } = await import(join(PRISMA_DIR, 'render-erd.mjs'));
    const elements = renderErdElements();
    const models = modelsWithSchoolId();

    const boxWidth = new Map(
      elements.filter((e) => e.type === 'rectangle' && e._name).map((e) => [e._name, e.width]),
    );
    const blocks = elements.filter(
      (e) => e.type === 'text' && e.fontSize === 11 && e.text.includes('\n'),
    );
    expect(blocks.length).toBe(models.length);

    // Excalidraw's monospace advance width is 0.6em. A label wider than its
    // box is clipped in the render and invisible in the file, which is the
    // failure this asserts against: it was found by looking at a screenshot,
    // and it would be easy to reintroduce by adding one long field name.
    const ADVANCE = 0.6;
    for (const [i, model] of models.entries()) {
      const lines = blocks[i].text.split('\n');
      expect(
        lines.length,
        `${model.name} is labelled with ${lines.length} fields but the schema has ${
          model.fields.filter((f) => !f.invisible).length
        }`,
      ).toBe(model.fields.filter((f) => !f.invisible).length);

      const longest = Math.max(...lines.map((l) => l.length));
      const needed = longest * blocks[i].fontSize * ADVANCE;
      expect(
        needed,
        `${model.name}: longest label is ${longest} chars (${needed.toFixed(0)}px) but the box inner width is ${
          (boxWidth.get(model.name) as number) - 28
        }px — shorten the label or widen the box`,
      ).toBeLessThanOrEqual((boxWidth.get(model.name) as number) - 28);
    }
  });

  it('draws an edge only where a relation is declared or a reference is deliberate', async () => {
    const { modelsWithSchoolId } = await import(join(PRISMA_DIR, 'schema-source.mjs'));
    const { renderErdElements } = await import(join(PRISMA_DIR, 'render-erd.mjs'));
    const elements = renderErdElements();

    const declared = modelsWithSchoolId().flatMap((m) =>
      m.fields
        .filter((f) => f.kind === 'relation' && f.fk && !f.inverse && !f.self)
        .map((f) => `${m.name}->${f.to}`),
    );
    const soft = modelsWithSchoolId().flatMap((m) =>
      m.fields.filter((f) => f.kind === 'softref').map((f) => `${m.name}->${f.to}`),
    );

    // The diagram derives its edges from the field lists, so the counts cannot
    // drift; asserting the exact set pins the intent — that no edge is
    // decorative, and that a new relation has to be counted here.
    expect(declared.sort()).toEqual([
      /**
       * `PLT-101`: the lookup key is the provider's immutable subject, but the
       * edge is to the local `User`, because an identity row has no meaning on
       * its own. Deleting the user cascades the credential away.
       */
      'ExternalIdentity->User',
      'NotificationDelivery->NotificationPreference',
      'NotificationDelivery->User',
      'NotificationPreference->User',
      'RefreshToken->Session',
      'RefreshToken->User',
      'RolePermission->Permission',
      'RolePermission->Role',
      'SchoolSettings->User',
      'Session->User',
      'StoredFile->User',
      /**
       * `D-4.1`: `User->Role` is GONE. It is replaced by two edges through the
       * join — the relation did not multiply, it was routed. The old single-FK
       * edge appearing here again would mean the join is decorative.
       */
      'UserRole->Role',
      'UserRole->User',
    ]);
    expect(soft.sort()).toEqual(['AuditRecord->User', 'ErrorLog->User']);
    expect(elements.filter((e) => e.type === 'arrow').length).toBe(declared.length + soft.length);
  });
});

describe('audit_records is append-only at the database, not only in code', () => {
  // AGENTS.md 2.7 and PLT-401. The repository exposes only create() and
  // query(), which is a convention. A convention is bypassed by anyone with
  // database access — including a future migration, a support session, or the
  // application's own connection. Prisma cannot express a GRANT, so the
  // protection lives in SQL and this test is what stops it going missing.
  it('ships a hardening script that revokes UPDATE and DELETE', () => {
    expect(
      existsSync(HARDENING_PATH),
      `${HARDENING_PATH} must exist — audit immutability is enforced by a privilege, not a comment`,
    ).toBe(true);
    const sql = readFileSync(HARDENING_PATH, 'utf8');
    // Strip line comments before matching: the script has to explain WHY, and a
    // check that trips on its own explanation gets deleted along with the
    // protection.
    const statements = sql.replace(/^\s*--.*$/gm, '');

    const revoke = statements.match(/REVOKE\s+([^;]*?)\s+ON\s+(?:TABLE\s+)?public\.audit_records/i);
    expect(revoke, 'no REVOKE ... ON public.audit_records found').not.toBeNull();
    expect(revoke?.[1]).toMatch(/\bUPDATE\b/i);
    expect(revoke?.[1]).toMatch(/\bDELETE\b/i);
    // TRUNCATE empties the table just as effectively, and a protection
    // bypassable with the statement next door is not a protection.
    expect(revoke?.[1]).toMatch(/\bTRUNCATE\b/i);

    // And the application must still be able to do its job: PLT-401 needs
    // INSERT, PLT-403 needs SELECT.
    const grant = statements.match(/GRANT\s+([^;]*?)\s+ON\s+(?:TABLE\s+)?public\.audit_records/i);
    expect(grant?.[1], 'audit records cannot be written without INSERT').toMatch(/\bINSERT\b/i);
    expect(grant?.[1], 'PLT-403 cannot search the trail without SELECT').toMatch(/\bSELECT\b/i);
  });

  it('blocks mutation even for the table owner, because REVOKE alone is not enough', () => {
    // A privilege only binds the role it is revoked FROM. Prisma migrations run
    // as the table owner, so a GRANT to the app role would be the only
    // protection and the owner could still rewrite history. A BEFORE trigger
    // that raises closes that gap, and it is why the script has a second half.
    const sql = readFileSync(HARDENING_PATH, 'utf8');
    expect(sql).toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i);
    expect(sql).toMatch(/RETURNS\s+trigger/i);
    expect(sql).toMatch(/CREATE\s+TRIGGER/i);
    expect(sql).toMatch(/BEFORE\s+UPDATE\s+OR\s+DELETE/i);
    expect(sql).toMatch(/RAISE\s+EXCEPTION/i);
  });

  it('names the application role explicitly instead of assuming one', () => {
    // Revoking from PUBLIC is a different act from revoking from the role the
    // application connects as, and only the second does anything. An
    // unparameterised REVOKE looks like protection and is not.
    const sql = readFileSync(HARDENING_PATH, 'utf8');
    expect(sql).toMatch(/current_user|'eduflow_app'|eduflow_app/i);
    expect(sql).not.toMatch(/^\s*REVOKE[^;]*FROM\s+PUBLIC\s*;/im);
  });
});
