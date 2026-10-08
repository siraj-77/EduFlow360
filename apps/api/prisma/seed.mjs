/**
 * Bootstrap seed — development and integration tests only.
 *
 * WHY THERE IS ONE SOURCE OF TRUTH
 * ---------------------------------
 * This script used to carry its own hand-written array of eight permission keys. That was a
 * second, unreconciled copy of the permission vocabulary, and it shipped a defect:
 * `GET /auth/oidc/link` gates on `AUTH_LINK_EXTERNAL_IDENTITY`, which was **not** among the
 * eight — so the only permission-gated route in the repository returned **403 for the
 * bootstrap administrator**. Correct fail-closed behaviour, on a route nobody could reach.
 *
 * Nothing caught it because nothing compared the two lists. Now both the permissions and the
 * roles are **imported from `src/`**, so this file cannot drift from what the code gates on:
 *
 *   PERMISSION_CATALOGUE  ->  src/modules/rbac/domain/permission-catalogue.ts   (`ADR-012`)
 *   SYSTEM_ROLES          ->  src/modules/rbac/domain/system-roles.ts           (corpus §DoR)
 *
 * `permission-catalogue.spec.ts` reconciles the catalogue against every key the real
 * controllers declare, in both directions, so the chain is: route -> catalogue -> seed.
 *
 * WHY A `.mjs` FILE READS `.ts` SOURCE
 * -----------------------------------
 * It does not import it — there is no TypeScript loader at runtime and adding one to a seed
 * script is a larger change than the problem deserves. It **transpiles** the declaration with
 * the `typescript` compiler that is already in the workspace, then evaluates the result.
 *
 * The first attempt extracted the array literal and evaluated it directly. That does not work,
 * and the reason is worth recording: a TypeScript `as const satisfies readonly X[]` literal
 * contains **TypeScript syntax** (`as const`, `as readonly PermissionKey[]`), so plain `new
 * Function` fails with `Unexpected token ')'`. A regex that strips the type annotations would
 * be a second parser to keep correct forever.
 *
 * `ts.transpileModule` is the actual compiler doing the job it is for, so `as const` narrows the
 * keys to their literals exactly as it does for the application — which is the whole reason
 * `PermissionKey` is a real union.
 *
 * `typescript` is a **devDependency**, which is correct here: this script seeds development
 * and CI databases and never runs in a production process.
 *
 * `seed-source.spec.ts` asserts that what the extractor produces equals what the modules
 * actually export, so a declaration that stopped being extractable fails as a named shape
 * error rather than a confusing one.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { readConstArray } from './read-declaration.mjs';

/**
 * Load the repository root `.env`, if there is one.
 *
 * `DATABASE_URL` lives in the git-ignored `.env` at the root and **nothing loads it for this
 * script**. Without this, `node prisma/seed.mjs` fails with
 * `PrismaClientInitializationError: Environment variable not found: DATABASE_URL` — a message
 * that names the variable correctly and then tells the developer to do something no tool in
 * this repository does.
 *
 * Node's built-in `process.loadEnvFile()` rather than `dotenv`, for the reason
 * `vitest.integration.config.ts` gives: no dependency added, and no second `.env` parser that
 * could disagree with the first about precedence.
 *
 * Tolerated when absent, because a deployment may inject `DATABASE_URL` through the
 * environment instead — and `process.loadEnvFile` throws when the file is missing. A genuinely
 * missing variable is Prisma's error to raise, with a better message than this could write.
 */
try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env'));
} catch {
  // No root .env. The variable must come from the environment; Prisma will say so if it does not.
}

const prisma = new PrismaClient();

/** Every permission the catalogue declares (`ADR-012`). */
const PERMISSIONS = readConstArray('permission-catalogue.ts', 'PERMISSION_CATALOGUE');

/** The five system roles and their grants (corpus §DoR, `ADR-003`). */
const SYSTEM_ROLES = readConstArray('system-roles.ts', 'SYSTEM_ROLES');

/** The bootstrap role, and the only one with grants today. */
const BOOTSTRAP_ROLE = 'SCHOOL_ADMIN';

/**
 * `schoolId` is metadata only, per ADR-003: one database per school, no query is scoped by
 * it and no guard reads it. It is still written because uniqueness constraints are scoped
 * within the school's database, and because it is what makes a row portable if a licence is
 * transferred.
 */
const SCHOOL_ID = process.env.SEED_SCHOOL_ID ?? '00000000-0000-4000-8000-000000000001';
async function seed() {
  // --- permissions -------------------------------------------------------------------
  // Upserted, not created: the script runs on every `db push`, and a catalogue that must be
  // deleted first would make a second run fail.
  //
  // `reservedFor` is destructured OFF rather than spread in. It is documentation for the
  // usage test and the next author, not a column on `Permission`, and `create: { ...permission }`
  // sends Prisma every field on the object — so the spread fails with
  // `Unknown argument 'reservedFor'`. Only the four real columns are written.
  for (const { key, module, action, description } of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { schoolId_key: { schoolId: SCHOOL_ID, key } },
      update: { module, action, description },
      create: { schoolId: SCHOOL_ID, key, module, action, description },
    });
  }
  console.log(`  permissions: ${PERMISSIONS.length} upserted (from permission-catalogue.ts)`);

  // --- roles -------------------------------------------------------------------------
  // All five, not one. `PLT-205` needs a role dimension for its matrix to have any denials in
  // it, and the corpus §DoR names these five with `Super Admin` removed (ADR-003).
  const roles = new Map();

  for (const definition of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { schoolId_name: { schoolId: SCHOOL_ID, name: definition.name } },
      update: {
        description: definition.description,
        // Re-asserted on every run so a role a previous version created with the flag unset
        // is corrected rather than persisting as a deletable custom role.
        isSystemRole: true,
      },
      create: {
        schoolId: SCHOOL_ID,
        name: definition.name,
        description: definition.description,
        isSystemRole: true,
      },
    });
    roles.set(definition.name, role);
  }
  console.log(`  roles: ${[...roles.keys()].join(', ')} (isSystemRole=true on all — ADR-003)`);

  // --- grants ------------------------------------------------------------------------
  // `@@unique([schoolId, roleId, permissionId])`, so the upsert is inherently idempotent and
  // a role cannot hold the same key twice.
  let granted = 0;

  for (const definition of SYSTEM_ROLES) {
    const role = roles.get(definition.name);

    for (const key of definition.permissions) {
      const permissionRow = await prisma.permission.findUniqueOrThrow({
        where: { schoolId_key: { schoolId: SCHOOL_ID, key } },
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
      granted += 1;
    }
  }

  const withheld = PERMISSIONS.length - new Set(SYSTEM_ROLES.flatMap((r) => r.permissions)).size;
  console.log(
    `  role_permissions: ${granted} granted, ${withheld} deliberately unassigned ` +
      '(PERMISSION_ASSIGN — no self-escalation; see system-roles.ts)',
  );

  // --- the bootstrap account ----------------------------------------------------------
  // INVITED with no passwordHash — see the header. `mustChangePassword` is not meaningful for
  // a user who has no password to change yet.
  //
  // `D-4.1`: roles are a JOIN, so the grant is a nested write rather than a `roleId` column.
  // `schoolId` is restated on the join row because it is required there — `connect` is not an
  // option, since `UserRole`'s unique input is the composite (schoolId, userId, roleId) and
  // userId does not exist yet.
  const email = process.env.SEED_ADMIN_EMAIL;
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';

  if (!email) {
    console.log('  admin: SKIPPED - set SEED_ADMIN_EMAIL to create the bootstrap account.');
    console.log('          This is expected locally; CI and integration tests set it.');
    return { role: roles.get(BOOTSTRAP_ROLE), user: null };
  }

  const user = await prisma.user.upsert({
    where: { schoolId_username: { schoolId: SCHOOL_ID, username } },
    update: {},
    create: {
      schoolId: SCHOOL_ID,
      email,
      username,
      status: 'INVITED',
      roles: { create: [{ schoolId: SCHOOL_ID, roleId: roles.get(BOOTSTRAP_ROLE).id }] },
    },
  });
  const userRoles = await prisma.userRole.count({ where: { userId: user.id } });
  console.log(
    `  admin: ${user.username} <${user.email}> status=${user.status} ` +
      `passwordHash=${user.passwordHash === null ? 'null' : 'SET'} roles=${userRoles}`,
  );
  return { role: roles.get(BOOTSTRAP_ROLE), user };
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
