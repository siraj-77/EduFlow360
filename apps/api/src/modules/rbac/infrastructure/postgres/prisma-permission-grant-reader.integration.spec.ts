import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPermissionGrantReader } from './prisma-permission-grant-reader.js';

/**
 * The permission lookup, proved against a real PostgreSQL.
 *
 * ## Why this cannot be a mocked repository
 *
 * Every claim this file makes is about what the SCHEMA will allow. A fake repository
 * returns whatever the test tells it to, so a mock could prove the guard calls a
 * method and nothing about whether the join is right — and the join is the entire
 * security property. If `Role.users` were filtered on the wrong column, a user would
 * inherit every other user's grants and every unit test in the repository would still
 * be green.
 *
 * So: real PostgreSQL, and every assertion goes through the reader rather than
 * through Prisma, because the reader is the thing whose query is in question.
 *
 * ## One school per suite
 *
 * `AGENTS.md` 2.1: one database per school. A shared `schoolId` would mean one
 * school's roles answering another's questions, which is exactly the confusion these
 * tests must not have.
 */
const SCHOOL_ID = randomUUID();

let prisma: PrismaClient;
let reader: PrismaPermissionGrantReader;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    // Refusing to skip is the rule the rest of this repository follows: a skipped test
    // reporting success is the exact defect class AUD-30-02 removed.
    throw new Error(
      'DATABASE_URL is not set. This suite needs a real PostgreSQL - the claim under test is ' +
        'that the role/permission join is right, and a mocked reader cannot demonstrate a join.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
  reader = new PrismaPermissionGrantReader(prisma, SCHOOL_ID);
});

afterAll(async () => {
  await prisma?.$disconnect();
});

/** A user in this school, holding no role. */
async function aUser(label: string): Promise<string> {
  return (
    await prisma.user.create({
      data: {
        schoolId: SCHOOL_ID,
        email: `${label}-${randomUUID()}@example.test`,
        username: `${label}-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;
}

/** A `Permission` row carrying a real `MODULE_ACTION` key. */
async function aPermission(key: string): Promise<string> {
  const [module, ...rest] = key.split('_');
  return (
    await prisma.permission.create({
      data: {
        schoolId: SCHOOL_ID,
        key,
        module: module ?? 'UNKNOWN',
        action: rest.join('_') || key,
      },
      select: { id: true },
    })
  ).id;
}

/** A role, optionally a system role, optionally holding the named permissions. */
async function aRole(
  name: string,
  permissionIds: readonly string[] = [],
  isSystemRole = false,
): Promise<string> {
  const roleId = (
    await prisma.role.create({
      data: { schoolId: SCHOOL_ID, name: `${name}-${randomUUID()}`, isSystemRole },
      select: { id: true },
    })
  ).id;

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.create({
      data: { schoolId: SCHOOL_ID, roleId, permissionId },
    });
  }

  return roleId;
}

/** Give a user a role. */
async function grant(userId: string, roleId: string): Promise<void> {
  await prisma.userRole.create({ data: { schoolId: SCHOOL_ID, userId, roleId } });
}

const held = (userId: string, permissionKey: string): Promise<boolean> =>
  reader.isGranted({ userId, permissionKey });

// ═══════════════════════════════════════════════════════════════════════════
// The positive claim: exactly what the role grants.
// ═══════════════════════════════════════════════════════════════════════════
describe('a grant that exists', () => {
  it('is held, and only for the key it names', async () => {
    const userId = await aUser('holder');
    const permissionId = await aPermission('FINANCE_INVOICE_REVERSE');
    await grant(userId, await aRole('accountant', [permissionId]));

    expect(await held(userId, 'FINANCE_INVOICE_REVERSE')).toBe(true);
    // The neighbouring key on the same module. A `startsWith` or a module-only
    // comparison would answer this `true`, which is the difference between a
    // permission and a capability.
    expect(await held(userId, 'FINANCE_INVOICE_CREATE')).toBe(false);
  });

  it('is held through SEVERAL roles at once, because the schema has no primary role', async () => {
    // `D-4.1`: permissions UNION across every `UserRole` row, and `UserRole` carries
    // no `isPrimary` column precisely so there is no second answer to this question.
    const userId = await aUser('multi');
    const readId = await aPermission('STUDENT_READ');
    const writeId = await aPermission('STUDENT_WRITE');
    await grant(userId, await aRole('reader', [readId]));
    await grant(userId, await aRole('writer', [writeId]));

    expect(await held(userId, 'STUDENT_READ')).toBe(true);
    expect(await held(userId, 'STUDENT_WRITE')).toBe(true);
    // And a third key that neither role names.
    expect(await held(userId, 'STUDENT_DELETE')).toBe(false);
  });

  it('survives the user also holding an unrelated role', async () => {
    const userId = await aUser('mixed');
    const wanted = await aPermission('AUDIT_RECORD_READ');
    await grant(userId, await aRole('auditor', [wanted]));
    await grant(userId, await aRole('librarian'));

    expect(await held(userId, 'AUDIT_RECORD_READ')).toBe(true);
  });

  it('follows a REVOKED grant, so removing the row removes the access', async () => {
    // A reader that cached, or that filtered on the role rather than the grant row,
    // would keep answering `true` here.
    const userId = await aUser('revoked');
    const permissionId = await aPermission('GRADE_PUBLISH');
    const roleId = await aRole('teacher', [permissionId]);
    await grant(userId, roleId);
    expect(await held(userId, 'GRADE_PUBLISH')).toBe(true);

    await prisma.rolePermission.deleteMany({
      where: { schoolId: SCHOOL_ID, roleId, permissionId },
    });

    expect(await held(userId, 'GRADE_PUBLISH')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The negative claims. Each is a way the join could be too generous.
// ═══════════════════════════════════════════════════════════════════════════
describe('a grant that does not exist', () => {
  it('is refused for a user holding no role at all', async () => {
    // The fail-closed case, and the one the whole guard leans on. A reader that
    // defaulted to `true` on an empty result would make every unassigned account an
    // administrator.
    //
    // The permission EXISTS in this school's catalogue, so the refusal can only come
    // from the user holding no role. A distinct key because `Permission` is unique on
    // `(school_id, key)` and this suite shares one school — a collision here is the
    // database asserting the constraint rather than the test failing for its own sake.
    const userId = await aUser('roleless');
    await aPermission('RODENT_FEED_MANAGE');

    expect(await held(userId, 'RODENT_FEED_MANAGE')).toBe(false);
  });

  it('is refused for a user whose role grants something ELSE', async () => {
    const userId = await aUser('wrong-key');
    const otherId = await aPermission('FINANCE_INVOICE_CREATE');
    await grant(userId, await aRole('clerk', [otherId]));

    expect(await held(userId, 'FINANCE_INVOICE_REVERSE')).toBe(false);
  });

  it('is refused for a role holding no permission at all', async () => {
    const userId = await aUser('empty-role');
    await grant(userId, await aRole('no-permissions'));

    expect(await held(userId, 'STUDENT_READ')).toBe(false);
  });

  it('is refused when the permission key is one no Permission row carries', async () => {
    // A typo in `@RequirePermission`, or a catalogue entry the deploy-time sync has
    // not written yet. Both must refuse; answering `true` for an unknown key would
    // make a typo into a wildcard.
    const userId = await aUser('unknown-key');
    const permissionId = await aPermission('ATTENDANCE_MARK');
    await grant(userId, await aRole('registrar', [permissionId]));

    expect(await held(userId, 'ATTENDANCE_MARK_UNKNOWABLE')).toBe(false);
    expect(await held(userId, 'TYPO_ATTENDANCE_MARK')).toBe(false);
  });

  it('is refused for a blank key, which matches no Permission row', async () => {
    // The rule already refuses a blank key before it asks. Asserted here too because
    // an empty string is a *findable* `Permission.key` the day somebody seeds one, and
    // this layer is the last place that could be stopped from behaving like a wildcard.
    const userId = await aUser('blank-key');
    await grant(userId, await aRole('anything'));

    expect(await held(userId, '')).toBe(false);
    expect(await held(userId, '   ')).toBe(false);
  });

  it('does NOT grant by virtue of being a system role', async () => {
    // `isSystemRole` marks a role immutable (`ADR-012`). It is not a grant, and a
    // reader treating it as one would hand every power to any built-in role.
    const userId = await aUser('sysadmin');
    await grant(userId, await aRole('system-role-with-no-grants', [], true));

    expect(await held(userId, 'FINANCE_INVOICE_REVERSE')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The isolation claim. This is the one that must never regress.
// ═══════════════════════════════════════════════════════════════════════════
describe("one user's grants are not another's", () => {
  it('refuses a key granted only to a DIFFERENT user', async () => {
    const holderId = await aUser('holder');
    const strangerId = await aUser('stranger');
    const permissionId = await aPermission('PAYROLL_READ');
    await grant(holderId, await aRole('payroll', [permissionId]));

    expect(await held(holderId, 'PAYROLL_READ')).toBe(true);
    // The security-critical row. A join that filtered on the permission but not on
    // the user would answer this `true` and hand a stranger the payroll.
    expect(await held(strangerId, 'PAYROLL_READ')).toBe(false);
  });

  it('refuses when the stranger holds a DIFFERENT role that lacks the key', async () => {
    const holderId = await aUser('holder2');
    const strangerId = await aUser('stranger2');
    const permissionId = await aPermission('CANCELTION_REQUEST_APPROVE');
    await grant(holderId, await aRole('approver', [permissionId]));
    await grant(strangerId, await aRole('requester'));

    expect(await held(strangerId, 'CANCELTION_REQUEST_APPROVE')).toBe(false);
  });

  it('refuses a key held by a user who does not exist', async () => {
    const permissionId = await aPermission('GHOST_READ');
    await grant(await aUser('real'), await aRole('ghost-role', [permissionId]));

    expect(await held(randomUUID(), 'GHOST_READ')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// `schoolId`
// ═══════════════════════════════════════════════════════════════════════════
describe('schoolId', () => {
  it('is part of every write, because the composite keys require it', async () => {
    // `AGENTS.md` 2.1 calls `schoolId` metadata, not a security control — isolation is
    // physical, one database per school. It is still carried on every row here, as
    // every sibling repository does, because `UserRole` and `RolePermission` both have
    // composite primary keys that include it and a row written without it would
    // satisfy no constraint.
    const permissionId = await aPermission('METADATA_CHECK');
    const roleId = (
      await prisma.role.create({
        data: { schoolId: SCHOOL_ID, name: `metadata-${randomUUID()}` },
        select: { id: true },
      })
    ).id;

    const row = await prisma.rolePermission.create({
      data: { schoolId: SCHOOL_ID, roleId, permissionId },
      select: { schoolId: true },
    });

    expect(row.schoolId).toBe(SCHOOL_ID);
  });

  it('is the school this reader answers for, so a row from another school is invisible', async () => {
    // One database can hold rows for more than one `schoolId` in a test run, and the
    // reader is constructed with one. This asserts the filter is real rather than
    // assumed — the same "no other school's rows" property `AGENTS.md` 2.1 buys with a
    // separate database per school, checked here because a test database is shared.
    const otherSchoolId = randomUUID();
    const otherPermissionId = (
      await prisma.permission.create({
        data: {
          schoolId: otherSchoolId,
          key: 'CROSS_SCHOOL_READ',
          module: 'CROSS',
          action: 'READ',
        },
        select: { id: true },
      })
    ).id;
    const otherRoleId = (
      await prisma.role.create({
        data: { schoolId: otherSchoolId, name: `cross-${randomUUID()}` },
        select: { id: true },
      })
    ).id;
    await prisma.rolePermission.create({
      data: { schoolId: otherSchoolId, roleId: otherRoleId, permissionId: otherPermissionId },
    });

    const userId = await aUser('crosser');
    await prisma.userRole.create({
      data: { schoolId: otherSchoolId, userId, roleId: otherRoleId },
    });

    // The reader is scoped to SCHOOL_ID, so the other school's grant does not answer.
    expect(await held(userId, 'CROSS_SCHOOL_READ')).toBe(false);
  });
});
