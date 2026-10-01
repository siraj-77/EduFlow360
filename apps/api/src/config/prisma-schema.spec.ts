/**
 * ARC-01 — Platform Core schema contract gate.
 *
 * `schema.prisma` is GENERATED from `prisma/schema-source.mjs`, which is also
 * the source of the ERD. Nothing here hand-checks the text: every assertion
 * below encodes a rule stated in a governing document, so a change that breaks
 * the contract fails here instead of at review.
 *
 * Source of the rules (nothing in this file is invented):
 *   ADR-002  money is integer minor units + explicit currency; never float
 *   ADR-003  one database per school; schoolId is METADATA, not a security
 *            control; no cross-tenant role; no tenant scoping
 *   ADR-007  argon2id behind IPasswordHasher; hash never returned or logged
 *   ADR-008  server-side Session; rotating refresh tokens in a family
 *   ADR-009  expired / invalid-signature / schema-error are three states
 *   ADR-011  install id, not MAC address
 *   ADR-012  permissions are a code catalogue synced to the database
 *   ADR-013  audit row is written in the caller's transaction
 *   ADR-015  private buckets, file-scope tagging, signed URLs
 *   ADR-018  @Public is the only exemption from @RequirePermission
 *   AGENTS.md 2.1  one PostgreSQL database per school
 *   AGENTS.md 2.5  money is never a float
 *   AGENTS.md 2.7  audit records are append-only, UPDATE/DELETE revoked
 *   AGENTS.md 8    never hard-code a school value
 *   PLT-101/201/301/401/601/602/701/801  the entity fields each story names
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA_PATH = join(API_ROOT, 'prisma', 'schema.prisma');
const SCHEMA = readFileSync(SCHEMA_PATH, 'utf8');

/**
 * The schema with every `///` documentation line removed.
 *
 * Prohibitions are checked against this, not against the raw file. The header
 * has to explain that there is no SUPER_ADMIN role and why; a prohibition that
 * trips on its own explanation is a prohibition nobody can satisfy, so it would
 * be deleted and the protection lost with it.
 */
const SCHEMA_CODE = SCHEMA.replace(/^\s*\/\/\/.*$/gm, '').replace(/^\s*\/\/[^/].*$/gm, '');

/**
 * The requirement, not an implementation detail: exactly these fourteen
 * entities, and no others. This list is the test's own copy on purpose — it is
 * `docs/work/TODO.md` item 3, and it is what makes "do not invent
 * Student/Class/Teacher" (`AGENTS.md` §13) a checkable rule rather than a
 * reviewer's memory. If a new model appears, this test fails and a human has
 * to decide whether the ERD moved on purpose.
 */
const PLATFORM_CORE_MODELS = [
  'AuditRecord',
  'ErrorLog',
  'License',
  'ModuleRegistry',
  'NotificationDelivery',
  'NotificationPreference',
  'Permission',
  'RefreshToken',
  'Role',
  'RolePermission',
  'SchoolSettings',
  'Session',
  'StoredFile',
  'User',
  /**
   * `D-4.1`, decided by the owner 2026-09-30: a user may hold MULTIPLE roles.
   *
   * Until then this list had 14 entries, and two separate tripwires asserted it:
   * this one, and `PLATFORM_CORE_ENTITIES` in `apps/api/erd/project-erd-source.mjs`
   * which `project-erd.spec.ts` compares the schema against. Adding a fifteenth
   * model without updating BOTH fails `pnpm test` - which is the intended
   * behaviour, not an obstacle. The tripwire exists to catch a second tenancy
   * concept, so it is satisfied, never silenced.
   */
  'UserRole',
] as const;

function models(): string[] {
  return [...SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1] as string).sort();
}

const snake = (pascal: string): string =>
  pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/**
 * Precondition for EVERY test in this file, including the negative ones.
 *
 * `expect(SCHEMA).not.toMatch(/SUPER_ADMIN/i)` passes trivially against an
 * empty schema — which is exactly the trap this file walks into: a suite of
 * prohibitions can be 100% green while the thing it prohibits is simply
 * absent. So each test first asserts the fourteen models are actually there.
 * A prohibition is only evidence once there is something it could have
 * prohibited.
 */
function expectPlatformCoreModels(): string[] {
  const found = models();
  expect(found, 'schema.prisma defines no models at all').toEqual([...PLATFORM_CORE_MODELS]);
  return found;
}

function bodyOf(model: string): string {
  const start = SCHEMA.indexOf(`model ${model} {`);
  expect(start, `model ${model} must exist in schema.prisma`).toBeGreaterThan(-1);
  const end = SCHEMA.indexOf('\n}', start);
  return SCHEMA.slice(start, end);
}

/** Prisma scalar/column types that would silently lose money. */
const NUMERIC_TYPES = /\b(Float|Decimal)\b/;

describe('schema.prisma — ARC-01 Platform Core data model', () => {
  it('is a file the Prisma CLI accepts', () => {
    expectPlatformCoreModels();
    expectPlatformCoreModels();
    // `prisma validate` parses and resolves; it opens no connection. The
    // placeholder URL is therefore not a credential and nothing dials it.
    // A real DATABASE_URL is deliberately NOT read, so the gate behaves the
    // same on a developer machine and in CI.
    // The CLI is invoked as `node node_modules/prisma/build/index.js` rather
    // than through the .bin shim: spawnSync cannot execute a .cmd on Windows
    // without a shell, and a shell that fails to launch produces a status of
    // null with no output at all — a red gate that reports nothing.
    const cli = join(API_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
    expect(existsSync(cli), `${cli} must exist — prisma is a devDependency of @eduflow/api`).toBe(
      true,
    );

    // `prisma validate` reports on stderr, not stdout, so both are read.
    // A non-zero status is itself the failure, and the message is kept in the
    // error so a broken schema does not just read "expected is valid".
    const res = spawnSync(process.execPath, [cli, 'validate', '--schema', SCHEMA_PATH], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://schema_gate:schema_gate@127.0.0.1:5432/schema_gate',
      },
    });
    const report = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(res.status, `prisma validate failed:\n${report}`).toBe(0);
    expect(report).toMatch(/is valid/);
  });

  it('expresses multi-role as a UserRole join, because one role per user cannot be (D-4.1)', () => {
    // ERD:84 said it plainly: "a teacher who is also a parent cannot be
    // expressed". One `roleId` foreign key cannot represent that, and the gap
    // is not cosmetic - a teacher who is also a parent was simply unable to log
    // in as both.
    expectPlatformCoreModels();

    // The single FK is GONE from User. An earlier draft of this test asserted
    // `roleId String[]` instead, which would have kept a role column on User and
    // made the join table decorative. The grant belongs on the join row, so
    // User carries only the list.
    expect(bodyOf('User'), 'User must not keep a single roleId foreign key').not.toMatch(
      /roleId\s+String\s+@map\("role_id"\)/,
    );
    expect(bodyOf('User'), 'User navigates to the join, not straight to Role').not.toMatch(
      /\brole\s+Role\b/,
    );
    expect(bodyOf('User')).toMatch(/roles\s+UserRole\[\]/);

    // And a join table exists to back it.
    const join = bodyOf('UserRole');
    expect(join).toMatch(/userId/);
    expect(join).toMatch(/roleId/);
  });

  it('gives UserRole a composite key, so the same grant cannot be inserted twice', () => {
    expectPlatformCoreModels();
    // Same shape as `RolePermission`: a duplicate row would be invisible in a
    // role listing and would double-count a permission audit.
    expect(bodyOf('UserRole')).toMatch(/@@id\(\[schoolId, userId, roleId\]\)/);
  });

  it('stores both UserRole foreign keys as uuid, matching the ids they reference', () => {
    // `42d2522`: every relation scalar in this schema was `String` while every
    // id was `@db.Uuid`, which made all eleven foreign keys unbuildable.
    // Prisma ACCEPTS the mismatch and only refuses at `db push`, so a new join
    // table is exactly where it recurs. This assertion is the guard.
    expectPlatformCoreModels();
    const join = bodyOf('UserRole');

    expect(join, 'UserRole.userId must be uuid').toMatch(
      /userId\s+String\s+@map\("user_id"\)\s+@db\.Uuid/,
    );
    expect(join, 'UserRole.roleId must be uuid').toMatch(
      /roleId\s+String\s+@map\("role_id"\)\s+@db\.Uuid/,
    );
  });

  it('carries no primary-role flag, because permissions union across roles', () => {
    expectPlatformCoreModels();
    // Owner decision 2026-09-30: a user with three roles holds the UNION of
    // their permissions. A `isPrimary` flag would introduce a second source of
    // truth for "what can this user do", and AGENTS.md 2.3 makes the permission
    // the only thing that gates a route. Asserted absent so adding one later is
    // a deliberate change rather than an accident.
    expect(bodyOf('UserRole'), 'no primary-role flag: the union is the rule').not.toMatch(
      /isPrimary|primary/i,
    );
    expect(bodyOf('User'), 'no primary-role flag on User either').not.toMatch(/isPrimary|primary/i);
  });

  it('defines exactly the fourteen Platform Core entities and nothing else', () => {
    expectPlatformCoreModels();
    expect(models()).toEqual([...PLATFORM_CORE_MODELS]);
  });

  it('does not invent Student, Class, Teacher or any other domain entity', () => {
    expectPlatformCoreModels();
    // PLT-203 / PLT-801 build ownership and file-access policies against
    // abstract ports with fakes. A Student row written here would be a second
    // source of truth for the Academic module's shape.
    for (const forbidden of [
      'Student',
      'Class',
      'Section',
      'Teacher',
      'Guardian',
      'Fee',
      'Invoice',
    ]) {
      expect(models()).not.toContain(forbidden);
    }
  });

  it('carries school_id on every table as metadata, never as a scoping mechanism', () => {
    expectPlatformCoreModels();
    // ADR-003: one database per school, so isolation is physical. school_id is
    // kept for auditability and licence portability. The absence of a
    // foreign key is the point — there is no `School` table to point at, and
    // inventing one would be a second tenancy concept.
    for (const model of models()) {
      expect(bodyOf(model), `${model} must carry school_id`).toMatch(
        /schoolId\s+String\s*@map\("school_id"\)/,
      );
    }
    expect(SCHEMA_CODE).not.toMatch(/relation\s+"school/i);
    expect(SCHEMA).not.toMatch(/model\s+School\b/);
  });

  it('never uses a float or decimal column, because money is integer minor units', () => {
    expectPlatformCoreModels();
    // AGENTS.md 2.5 / ADR-002. There is no money column in Platform Core;
    // what this prevents is the first one arriving as `amount Float` when
    // Finance is built, on the grounds that "the amount is small".
    const offending = models().filter((m) => NUMERIC_TYPES.test(bodyOf(m)));
    expect(offending, `float/decimal found in: ${offending.join(', ')}`).toEqual([]);
  });

  it('reads the school currency, minor-unit scale and rounding mode from settings', () => {
    expectPlatformCoreModels();
    // ADR-002: rounding mode and minor-unit scale are a per-school setting.
    // AGENTS.md 8 forbids hard-coding a school's currency, so these are
    // columns on the one canonical settings row rather than constants.
    const settings = bodyOf('SchoolSettings');
    expect(settings).toMatch(/currencyCode\s+String\s*@map\("currency_code"\)/);
    expect(settings).toMatch(/minorUnitScale\s+Int\s*@map\("minor_unit_scale"\)/);
    expect(settings).toMatch(/roundingMode\s+RoundingMode\s*@map\("rounding_mode"\)/);
    expect(SCHEMA).toMatch(/enum\s+RoundingMode\s*\{/);
  });

  it('scopes every uniqueness constraint within this one school database', () => {
    expectPlatformCoreModels();
    // ADR-003 rejects the legacy app's 14 global @unique constraints: they
    // assumed a shared database. Here one database IS one school, so a
    // single-column unique is unique school-wide by accident. Composing
    // school_id into every unique makes the scope legible in the schema, so
    // a future reader cannot mistake it for a cross-school guarantee.
    const single = [...SCHEMA.matchAll(/@unique\(\s*\[?\s*(?!schoolId)([\w, ]+?)\s*\]?\s*\)/g)].map(
      (m) => m[0],
    );
    expect(single, `uniqueness not scoped by school_id: ${single.join(' ')}`).toEqual([]);

    for (const model of models()) {
      for (const block of bodyOf(model).matchAll(/@@unique\(\[([^\]]*)\]/g)) {
        expect(block[1], `${model}: @@unique([${block[1]}]) must start with school_id`).toMatch(
          /^\s*schoolId/,
        );
      }
    }
  });

  it('keeps audit_records append-only — no updated_at, and no mutable columns at all', () => {
    expectPlatformCoreModels();
    // AGENTS.md 2.7: the repository exposes only create() and query(). A
    // timestamp that changes is the first step towards an update path.
    const audit = bodyOf('AuditRecord');
    expect(audit).not.toMatch(/updatedAt/);
    expect(audit).not.toMatch(/deletedAt/);
    expect(audit).toMatch(/@map\("occurred_at"\)/);
    expect(audit).toMatch(/beforeValue\s+Json\?/);
    expect(audit).toMatch(/afterValue\s+Json\?/);
  });

  it('records the audit actor by value, so append-only survives user deletion', () => {
    expectPlatformCoreModels();
    // A foreign key to `users` would either block a user delete or cascade the
    // audit row away. Both destroy evidence. The id and the role are
    // denormalised snapshots for the same reason.
    const audit = bodyOf('AuditRecord');
    expect(audit).toMatch(/actorId\s+String\?/);
    expect(audit).toMatch(/actorRole\s+String\?/);
    expect(audit).not.toMatch(/@relation/);
  });

  it('distinguishes expired from invalid from unrevoked on the licence', () => {
    expectPlatformCoreModels();
    // ADR-009: they are three different administrative states with three
    // different remedies, and must never collapse into one error.
    const license = bodyOf('License');
    expect(license).toMatch(/status\s+LicenseStatus/);
    for (const value of ['ACTIVE', 'GRACE', 'EXPIRED', 'INVALID', 'REVOKED']) {
      expect(SCHEMA).toMatch(new RegExp(`\\b${value}\\b`));
    }
  });

  it('stores the edition as data, not as a hard-coded enumeration', () => {
    expectPlatformCoreModels();
    // ADR-009: no edition name is hard-coded in a guard, so a new edition must
    // not need a migration either. An enum would make the four Master Plan
    // editions a compile-time constant in the database.
    expect(bodyOf('License')).toMatch(/edition\s+String/);
    expect(SCHEMA_CODE).not.toMatch(/enum\s+Edition/);
  });

  it('keeps the rotation family on refresh tokens so reuse is detectable', () => {
    expectPlatformCoreModels();
    // ADR-008: a replayed rotated token must revoke the whole family, and a
    // concurrent refresh race must not. Neither is expressible without
    // familyId plus the used/replaced marker.
    const token = bodyOf('RefreshToken');
    expect(token).toMatch(/familyId\s+String\s*@map\("family_id"\)/);
    expect(token).toMatch(/usedAt\s+DateTime\?\s*@map\("used_at"\)/);
    expect(token).toMatch(/replacedByTokenId\s+String\?/);
    expect(token).toMatch(/tokenHash\s+String\s*@map\("token_hash"\)/);
  });

  it('hashes credentials and never carries a recoverable secret', () => {
    expectPlatformCoreModels();
    // ADR-007: argon2id, parameters in settings, hash never returned or
    // logged. The schema stores the hash and the algorithm label so a
    // verify-and-rehash migration can run without a second column.
    const user = bodyOf('User');
    expect(user).toMatch(/passwordHash\s+String\?\s*@map\("password_hash"\)/);
    expect(user).toMatch(/passwordAlgorithm\s+String\?\s*@map\("password_algorithm"\)/);
    expect(user).not.toMatch(/password\s+String/);
    expect(SCHEMA_CODE).not.toMatch(/licensePrivateKey/);
  });

  it('identifies the deployment by install id, never by MAC address', () => {
    expectPlatformCoreModels();
    // ADR-011: a container gets a new MAC on every restart, so a MAC-bound
    // licence breaks on a routine infrastructure restart.
    // Nullable on purpose: the licence row is written at activation, before
    // the deployment's install id is known. `PLT-304` binds it when an offline
    // request token is imported, and `ADR-011` treats the binding as advisory
    // rather than a hard lock so a rescheduled VM does not lock a school out.
    expect(bodyOf('License')).toMatch(/installId\s+String\?\s*@map\("install_id"\)/);
    expect(SCHEMA_CODE).not.toMatch(/mac[A-Z]/);
  });

  it('carries no cross-tenant role and no school_id equality branch', () => {
    expectPlatformCoreModels();
    // ADR-003 / AGENTS.md 2.1: there is nothing cross-tenant to administer,
    // so the highest role is an in-school administrator.
    expect(SCHEMA_CODE).not.toMatch(/SUPER_?ADMIN/i);
    expect(SCHEMA_CODE).not.toMatch(/tenant/i);
  });

  it('names every table explicitly in snake_case, so grants name a real table', () => {
    // AGENTS.md 2.7 revokes privileges by table name. If the physical name were
    // derived from the Prisma model name, `REVOKE ... ON TABLE audit_records`
    // would be revoking on a table that does not exist. The names are written
    // out in the source rather than pluralised by a rule, because `Person` ->
    // `people` is why guessed plurals go wrong.
    for (const model of expectPlatformCoreModels()) {
      const map = bodyOf(model).match(/@@map\("([^"]+)"\)/);
      expect(map, `${model} must declare @@map`).not.toBeNull();
      expect(map?.[1], `${model} table name must be explicit lowercase snake_case`).toMatch(
        /^[a-z][a-z0-9_]*$/,
      );
    }
    // The names the hardening SQL and every GRANT actually depend on.
    expect(SCHEMA_CODE).toMatch(/@@map\("audit_records"\)/);
    expect(SCHEMA_CODE).toMatch(/@@map\("role_permissions"\)/);
    expect(SCHEMA_CODE).toMatch(/@@map\("refresh_tokens"\)/);
  });

  it('gives every column an explicit snake_case name', () => {
    // A camelCase column would make the generated SQL disagree with the table
    // definition the hardening script and the grants are written against.
    for (const model of expectPlatformCoreModels()) {
      for (const line of bodyOf(model)
        .split('\n')
        .filter((l) => /^\s{2}\w+\s+[\w?]+/.test(l) && !l.trim().startsWith('///'))) {
        // Prisma forbids @map on a relation field; those are checked by the
        // foreign-key tests instead.
        if (line.includes('@relation(')) continue;
        const field = line.trim().split(/\s+/)[0] as string;
        const column = snake(field);
        if (column === field) continue;
        expect(line, `${model}.${field} must map to ${column}`).toContain(`@map("${column}")`);
      }
    }
  });
});
