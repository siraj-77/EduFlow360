/**
 * Bootstrap seed - development only.
 *
 * WHY THE USER HAS NO PASSWORD
 * ----------------------------
 * `User.passwordHash` is nullable and `User.status` defaults to `INVITED`,
 * because (schema.prisma, ADR-007) "an INVITED user has no password yet and
 * `PLT-104` OTP is milestone 2". This seed relies on exactly that: it creates
 * the bootstrap administrator as INVITED, with no credential.
 *
 * That is deliberate, not a shortcut. Seeding a password here would mean
 * choosing an argon2id implementation, and `PLT-101` owns
 * `IPasswordHasher`. Two hashers in one repository means login can never be
 * verified against the seeded hash, because the two implementations would
 * disagree about parameters. So the seed creates the ROLE and the PERMISSIONS -
 * the parts that are pure data - and leaves the credential to `PLT-107`, whose
 * one-time setup token is the designed way a real deployment obtains its first
 * administrator.
 *
 * CONSEQUENCE, stated plainly: after seeding, there is nothing to log in with.
 * There is also no login endpoint - `PLT-101` has not been built, and
 * `@node-rs/argon2` is not installed. "Can the seeded admin log in?" is not
 * answerable until PLT-101 exists. What this seed makes answerable is "does the
 * schema apply, and does the RBAC graph hold?" - which is what the first
 * integration test asserts.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not the production bootstrap. A real deployment gets its first administrator
 * through `PLT-107`'s single-use setup token, which is audited. This script is
 * for local development and for integration tests, and it is deliberately
 * idempotent so it can run on every `db push`.
 *
 * SCOPE NOTE (ADR-003)
 * -------------------
 * `Role.isSystemRole` carries the comment "the highest role is an in-school
 * administrator; there is no cross-tenant super admin". This seed therefore
 * creates `SCHOOL_ADMIN`, not a superadmin. The instance-level capabilities the
 * bootstrap account needs - enable modules, apply a licence, upgrade - are
 * granted as `MODULE_ACTION` PERMISSIONS on that role, which is what
 * `AGENTS.md` 2.3 requires every route to check. A role that carries everything
 * by virtue of being a role bypasses the permission system; a role holding the
 * right permission keys uses it.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * The bootstrap administrator's capabilities. Keys are `MODULE_ACTION`
 * (ADR-012). These are the things that must work before any module is enabled:
 * without them the instance cannot be set up at all.
 */
const BOOTSTRAP_PERMISSIONS = [
  {
    key: 'PLATFORM_MODULE_MANAGE',
    module: 'PLATFORM',
    action: 'MODULE_MANAGE',
    description: 'Enable and disable licensed modules (PLT-EPIC-06).',
  },
  {
    key: 'LICENCE_APPLY',
    module: 'LICENCE',
    action: 'APPLY',
    description: 'Apply a signed licence certificate (PLT-EPIC-03).',
  },
  {
    key: 'LICENCE_UPGRADE',
    module: 'LICENCE',
    action: 'UPGRADE',
    description: 'Upgrade the applied licence edition (PLT-EPIC-03).',
  },
  {
    key: 'USER_CREATE',
    module: 'USER',
    action: 'CREATE',
    description: 'Create another user (PLT-EPIC-01).',
  },
  {
    key: 'USER_INVITE',
    module: 'USER',
    action: 'INVITE',
    description: 'Invite a user who sets their own credential (PLT-104).',
  },
  {
    key: 'PERMISSION_ASSIGN',
    module: 'RBAC',
    action: 'ASSIGN',
    description: 'Grant permissions to roles (PLT-EPIC-02).',
  },
  {
    key: 'SCHOOL_SETTINGS_MANAGE',
    module: 'SETTINGS',
    action: 'MANAGE',
    description: 'Change school settings (PLT-EPIC-06).',
  },
  {
    key: 'AUDIT_READ',
    module: 'AUDIT',
    action: 'READ',
    description: 'Read audit records (PLT-EPIC-04).',
  },
];

/**
 * `schoolId` is metadata only, per ADR-003: one database per school, no query is
 * scoped by it and no guard reads it. It is still written because uniqueness
 * constraints are scoped within the school's database, and because it is what
 * makes a row portable if a licence is transferred.
 */
const SCHOOL_ID = process.env.SEED_SCHOOL_ID ?? '00000000-0000-4000-8000-000000000001';

async function seed() {
  for (const permission of BOOTSTRAP_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { schoolId_key: { schoolId: SCHOOL_ID, key: permission.key } },
      update: {
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
      create: { schoolId: SCHOOL_ID, ...permission },
    });
  }
  console.log(`  permissions: ${BOOTSTRAP_PERMISSIONS.length} upserted`);

  const role = await prisma.role.upsert({
    where: { schoolId_name: { schoolId: SCHOOL_ID, name: 'SCHOOL_ADMIN' } },
    update: {
      description: 'Bootstrap administrator for this school instance.',
      isSystemRole: true,
    },
    create: {
      schoolId: SCHOOL_ID,
      name: 'SCHOOL_ADMIN',
      description: 'Bootstrap administrator for this school instance.',
      isSystemRole: true,
    },
  });
  console.log(`  role: SCHOOL_ADMIN ${role.id} (isSystemRole=${role.isSystemRole})`);

  const held = await prisma.rolePermission.findMany({
    where: { schoolId: SCHOOL_ID, roleId: role.id },
  });
  for (const permission of BOOTSTRAP_PERMISSIONS) {
    const permissionRow = await prisma.permission.findUniqueOrThrow({
      where: { schoolId_key: { schoolId: SCHOOL_ID, key: permission.key } },
    });
    await prisma.rolePermission.upsert({
      where: {
        schoolId_roleId_permissionId: {
          schoolId: SCHOOL_ID,
          roleId: role.id,
          permissionId: permissionRow.id,
        },
      },
      update: {},
      create: { schoolId: SCHOOL_ID, roleId: role.id, permissionId: permissionRow.id },
    });
  }
  console.log(
    `  role_permissions: ${held.length} existing, ${BOOTSTRAP_PERMISSIONS.length} ensured`,
  );

  // INVITED with no passwordHash - see the header. `mustChangePassword` is not
  // meaningful for a user who has no password to change yet.
  //
  // `D-4.1`: roles are a JOIN, so the grant is a nested write rather than a
  // `roleId` column. `schoolId` is restated on the join row because it is
  // required there - `connect` is not an option, since `UserRole`'s unique input
  // is the composite (schoolId, userId, roleId) and userId does not exist yet.
  const email = process.env.SEED_ADMIN_EMAIL;
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';

  if (!email) {
    console.log('  admin: SKIPPED - set SEED_ADMIN_EMAIL to create the bootstrap account.');
    console.log('          This is expected locally; CI and integration tests set it.');
    return { role, user: null };
  }

  const user = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: SCHOOL_ID, username } },
    update: {},
    create: {
      schoolId: SCHOOL_ID,
      email,
      username,
      status: 'INVITED',
      roles: { create: [{ schoolId: SCHOOL_ID, roleId: role.id }] },
    },
  });
  const grants = await prisma.userRole.count({ where: { userId: user.id } });
  console.log(
    `  admin: ${user.username} <${user.email}> status=${user.status} passwordHash=${user.passwordHash === null ? 'null' : 'SET'} roles=${grants}`,
  );
  return { role, user };
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
