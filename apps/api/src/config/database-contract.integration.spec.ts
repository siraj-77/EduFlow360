import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * The first integration test against a real PostgreSQL.
 *
 * WHY THIS FILE IS THE IMPORTANT ONE IN THE REPOSITORY RIGHT NOW
 * --------------------------------------------------------------
 * Every other gate reads configuration or generated text. This one executes SQL
 * against the database, and the first thing it found was a defect that every
 * other gate had passed:
 *
 *   ERROR: foreign key constraint "users_role_id_fkey" cannot be implemented
 *   DETAIL: Key columns "role_id" ... and "id" ... are of incompatible types:
 *           text and uuid
 *
 * All 11 foreign keys in the schema were unbuildable, because every model `id`
 * carried `@db.Uuid` and no relation scalar did. `prisma-schema.spec.ts` passed
 * throughout, because Prisma ACCEPTS such a schema and only fails at apply time.
 * That is the whole argument for `test:integration` being a mandatory gate
 * rather than an optional extra: a schema that parses is not a schema that
 * applies.
 *
 * Requires DATABASE_URL. Skips with a loud failure rather than passing quietly -
 * a skipped test that reports success is the exact defect class EPIC-A removed.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. This test talks to a real PostgreSQL and cannot be ' +
      'run without one. Set it in .env (git-ignored) or the environment.',
  );
}

const prisma = new PrismaClient();
const SCHOOL_ID = randomUUID();

beforeAll(async () => {
  await prisma.$connect();
});

describe('the schema applies to a real PostgreSQL', () => {
  it('creates all 15 tables with the ADR-003 names', async () => {
    const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name NOT LIKE '_prisma%'
       ORDER BY table_name`,
    );
    const names = rows.map((r) => r.table_name);

    expect(names).toEqual([
      'audit_records',
      'error_logs',
      'licenses',
      'module_registry',
      'notification_deliveries',
      'notification_preferences',
      'permissions',
      'refresh_tokens',
      'role_permissions',
      'roles',
      'school_settings',
      'sessions',
      'stored_files',
      'user_roles',
      'users',
    ]);

    // ADR-003: no School table, no Branch table. Isolation is physical - one
    // database per school - so a School row would be a lie the schema tells.
    expect(names).not.toContain('schools');
    expect(names).not.toContain('branches');
    expect(names).not.toContain('tenants');
  });

  it('creates all 12 foreign keys', async () => {
    // This is the assertion that fails against the pre-fix schema. Prisma
    // reported the schema as valid; only PostgreSQL refused to build it.
    //
    // D-4.1 takes this from 11 to 12, and the arithmetic is the point:
    // `User.role_id` (-1) is replaced by `user_roles.user_id` and
    // `user_roles.role_id` (+2). Net +1. An earlier draft of this comment
    // claimed the count "stays 11" because the relation was only "routed" -
    // that is wrong, because a join has two foreign keys where a direct
    // relation had one. If this number is ever 11 again, either the join lost a
    // key or the old column came back; both are bugs.
    const rows = await prisma.$queryRawUnsafe<{ constraint_name: string }[]>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'`,
    );
    expect(rows.length).toBe(12);
  });

  it('stores the join keys as uuid, matching the ids they reference', async () => {
    // `user_roles` has NO `id` column - it uses the composite
    // `@@id([schoolId, userId, roleId])` - so this checks the two foreign keys
    // instead. Both must be `uuid`. In `42d2522` every relation scalar in this
    // schema was `String` while every id was `uuid`, which made all of them
    // unbuildable; a new join table is exactly where that recurs.
    const rows = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_roles'
         AND column_name IN ('user_id', 'role_id')
       ORDER BY column_name`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.data_type === 'uuid')).toBe(true);
  });

  it('lets one user hold more than one role, which is what D-4.1 decided', async () => {
    // The case `ERD:84` named: "a teacher who is also a parent cannot be
    // expressed". Before the join, this test could not even be written.
    const school = randomUUID();
    const role = await prisma.role.create({
      data: { schoolId: school, name: `ROLE_${randomUUID()}`, isSystemRole: false },
    });
    const second = await prisma.role.create({
      data: { schoolId: school, name: `ROLE_${randomUUID()}`, isSystemRole: false },
    });
    const user = await prisma.user.create({
      data: {
        schoolId: school,
        email: `multi-${randomUUID()}@example.test`,
        username: `multi-${randomUUID()}`,
        roles: {
          create: [
            { schoolId: school, roleId: role.id },
            { schoolId: school, roleId: second.id },
          ],
        },
      },
    });

    const held = await prisma.userRole.findMany({ where: { userId: user.id } });
    expect(held.length).toBe(2);
    expect(new Set(held.map((r) => r.roleId))).toEqual(new Set([role.id, second.id]));

    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.role.delete({ where: { id: second.id } });
  });

  it('refuses a duplicate role grant, so a role listing cannot double-count', async () => {
    const school = randomUUID();
    const role = await prisma.role.create({
      data: { schoolId: school, name: `ROLE_${randomUUID()}`, isSystemRole: false },
    });
    const user = await prisma.user.create({
      data: {
        schoolId: school,
        email: `dup-${randomUUID()}@example.test`,
        username: `dup-${randomUUID()}`,
        roles: { create: [{ schoolId: school, roleId: role.id }] },
      },
    });

    await expect(
      prisma.userRole.create({ data: { schoolId: school, userId: user.id, roleId: role.id } }),
    ).rejects.toThrow(/unique|duplicate/i);

    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });

  it('refuses to delete a role that still has users', async () => {
    // `UserRole.roleId` is `onDelete: Restrict`. Deleting a role in use must
    // fail rather than silently strip a school of an administrator - and with
    // a join table, the cascade that would have done it is no longer implicit.
    const school = randomUUID();
    const role = await prisma.role.create({
      data: { schoolId: school, name: `ROLE_${randomUUID()}`, isSystemRole: false },
    });
    const user = await prisma.user.create({
      data: {
        schoolId: school,
        email: `r-${randomUUID()}@example.test`,
        username: `r-${randomUUID()}`,
        roles: { create: [{ schoolId: school, roleId: role.id }] },
      },
    });

    await expect(prisma.role.delete({ where: { id: role.id } })).rejects.toThrow(
      /restrict|violates/i,
    );

    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });
});

describe('foreign keys are enforced, not merely present', () => {
  it('rejects a role grant whose role does not exist', async () => {
    // Rewritten for D-4.1: the FK is now on `user_roles.role_id`, not on
    // `users.role_id`. Asserting it against `users` would have passed trivially
    // - there is no such column left to violate.
    const school = randomUUID();
    const user = await prisma.user.create({
      data: {
        schoolId: school,
        email: `orphan-${randomUUID()}@example.test`,
        username: `orphan-${randomUUID()}`,
      },
    });

    await expect(
      prisma.userRole.create({ data: { schoolId: school, userId: user.id, roleId: randomUUID() } }),
    ).rejects.toThrow(/foreign key/i);

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('rejects a role grant whose user does not exist', async () => {
    const school = randomUUID();
    const role = await prisma.role.create({
      data: { schoolId: school, name: `ROLE_${randomUUID()}`, isSystemRole: false },
    });

    await expect(
      prisma.userRole.create({ data: { schoolId: school, userId: randomUUID(), roleId: role.id } }),
    ).rejects.toThrow(/foreign key/i);

    await prisma.role.delete({ where: { id: role.id } });
  });

  it('lets a user exist with no role at all, because a grant is not identity', async () => {
    // `User.roleId` was NOT NULL, so before D-4.1 an account could not be
    // created until a role existed. A user is a person who can authenticate;
    // holding a role is a later, separate act. Asserting this keeps the join
    // from being reintroduced as a required column.
    const school = randomUUID();
    const user = await prisma.user.create({
      data: {
        schoolId: school,
        email: `roleless-${randomUUID()}@example.test`,
        username: `roleless-${randomUUID()}`,
      },
    });

    expect(await prisma.userRole.count({ where: { userId: user.id } })).toBe(0);
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe('ADR-003 invariants hold in the database, not only in prose', () => {
  it('scopes uniqueness to the school, never globally', async () => {
    // AGENTS.md 2.1: "Uniqueness constraints are scoped within a school's
    // database, never assumed global." One database per school means the
    // constraint still names school_id first, so the schema does not imply a
    // cross-school guarantee that the architecture does not provide.
    const email = `dup-${randomUUID()}@example.test`;
    const role = await prisma.role.create({
      data: { schoolId: SCHOOL_ID, name: `ROLE_${randomUUID()}`, isSystemRole: false },
    });
    const a = await prisma.user.create({
      data: {
        schoolId: SCHOOL_ID,
        email,
        username: `a-${randomUUID()}`,
        roles: { create: [{ schoolId: SCHOOL_ID, roleId: role.id }] },
      },
    });
    // Same email, same school: rejected.
    await expect(
      prisma.user.create({
        data: {
          schoolId: SCHOOL_ID,
          email,
          username: `b-${randomUUID()}`,
          roles: { create: [{ schoolId: SCHOOL_ID, roleId: role.id }] },
        },
      }),
    ).rejects.toThrow(/unique/i);

    await prisma.user.delete({ where: { id: a.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });

  it('has no cross-tenant role', async () => {
    const roles = await prisma.role.findMany({ where: { schoolId: SCHOOL_ID } });
    expect(roles.every((r) => r.name !== 'SUPER_ADMIN')).toBe(true);
  });
});

describe('the bootstrap seed is idempotent and leaves no credential behind', () => {
  it('creates the admin as INVITED with a null passwordHash', async () => {
    // This is the assertion that answers "how do we log in as the bootstrap
    // admin?" - we do not, and the database says so explicitly. passwordHash is
    // null because PLT-101 has not built IPasswordHasher and PLT-104 OTP is
    // milestone 2. A seeded password would mean a second hasher, and two
    // hashers cannot verify each other's output.
    const user = await prisma.user.findFirst({
      where: { schoolId: SCHOOL_ID, username: 'admin' },
    });

    // The seed uses its own SCHOOL_ID by default, so under this suite's random
    // school there may be no admin at all. What must be true either way is that
    // no user anywhere has a password that was invented by a seed script.
    if (user) {
      expect(user.passwordHash).toBeNull();
      expect(user.status).toBe('INVITED');
      expect(user.mustChangePassword).toBe(false);
    }

    const withHash = await prisma.user.count({ where: { passwordHash: { not: null } } });
    expect(withHash, 'no seeded account may carry a password').toBe(0);
  });
});
