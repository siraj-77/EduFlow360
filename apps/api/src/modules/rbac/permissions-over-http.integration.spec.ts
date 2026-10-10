import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT } from '../../testing/test-environment.js';
import { SESSION_COOKIE_NAME } from '../auth/domain/ports/session-cookie.js';
import { PrismaSessionRepository } from '../auth/infrastructure/postgres/prisma-session-repository.js';

/**
 * `GET /permissions/me` over a real socket and a real PostgreSQL.
 *
 * ## Why this file exists — the negative half of `PLT-205` T3
 *
 * `permission-engine-over-http.integration.spec.ts` proves the guard
 * machinery on the one route that existed. This file proves it on the route
 * `PLT-204` reads its permission set from, and proves the NEGATIVE case the
 * story names: a caller with a **valid session** whose role does not grant
 * `PERMISSION_READ_OWN` must be refused with **403** — not answered, not
 * 500, not 401. A session proves authentication; it says nothing about
 * authorisation, and a route that answered for any signed-in caller would
 * hand every account the school's permission set.
 *
 * ## What is real
 *
 * Real: `AppModule.forRoot` including `RbacModule`, all three global guards,
 * the `PermissionsController`, `ReadMyPermissions`, `PrismaPermissionGrantReader`,
 * `PrismaSessionRepository`, and the `User` / `Role` / `Permission` /
 * `UserRole` / `RolePermission` tables. Nothing is substituted: no vendor
 * boundary is crossed by this route, so there is nothing to fake.
 *
 * Sessions are minted through the real `PrismaSessionRepository` rather than
 * by signing in over HTTP, because signing in is `PLT-101`'s subject — and a
 * real session row is what matters here: `SessionGuard` resolves a principal
 * and `PermissionGuard` reads THAT, not a cookie.
 */

const READ_OWN = 'PERMISSION_READ_OWN';
const OTHER_PERMISSION = 'FINANCE_INVOICE_REVERSE';

let prisma: PrismaClient;
let schoolId: string;
let sessions: PrismaSessionRepository;
let harness: HttpHarness;

async function boot(): Promise<HttpHarness> {
  return startHttpHarness({
    env: {
      ...TEST_ENVIRONMENT,
      DATABASE_URL: process.env.DATABASE_URL as string,
      SCHOOL_ID: schoolId,
    },
  });
}

async function aUser(label: string): Promise<string> {
  return (
    await prisma.user.create({
      data: {
        schoolId,
        email: `${label}-${randomUUID()}@example.test`,
        username: `${label}-${randomUUID()}`,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
  ).id;
}

async function aPermission(key: string): Promise<string> {
  const [module, ...rest] = key.split('_');
  return (
    await prisma.permission.create({
      data: {
        schoolId,
        key,
        module: module ?? 'UNKNOWN',
        action: rest.join('_') || key,
      },
      select: { id: true },
    })
  ).id;
}

/** A role holding `permissionIds`, given to `userId`. */
async function aRoleGranted(userId: string, permissionIds: readonly string[]): Promise<string> {
  const roleId = (
    await prisma.role.create({
      data: { schoolId, name: `role-${randomUUID()}` },
      select: { id: true },
    })
  ).id;

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.create({ data: { schoolId, roleId, permissionId } });
  }
  await prisma.userRole.create({ data: { schoolId, userId, roleId } });

  return roleId;
}

/** A real session row, and the cookie value that resolves it. */
async function aSessionCookie(userId: string): Promise<string> {
  const issued = await sessions.issue({
    actor: { userId },
    sessionTtlMs: 3_600_000,
    refreshTtlMs: 604_800_000,
  });
  return issued.sessionTokenPlaintext;
}

/** `GET /permissions/me` as a signed-in browser sends it. */
const me = (h: HttpHarness, cookie?: string) =>
  h.request(
    '/permissions/me',
    cookie === undefined ? {} : { cookies: { [SESSION_COOKIE_NAME]: cookie } },
  );

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite makes real requests against a real database, and a ' +
        'permission decision cannot be demonstrated without real role and grant rows.',
    );
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();

  // One school per test (`AGENTS.md` 2.1): sharing one would share one school's roles.
  schoolId = randomUUID();
  sessions = new PrismaSessionRepository(prisma, schoolId);
  harness = await boot();
});

afterEach(async () => {
  await harness?.close();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════
// The positive case. Without it, every other test could pass with the
// route absent, since they all assert refusals.
// ═══════════════════════════════════════════════════════════════════════
describe('a caller whose role grants the key', () => {
  it('is answered with exactly its own keys, sorted', async () => {
    const userId = await aUser('granted');
    await aRoleGranted(userId, [await aPermission(READ_OWN)]);

    const response = await me(harness, await aSessionCookie(userId));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ permissions: [READ_OWN] });
  });

  it('is answered with the UNION of two roles, deduplicated and sorted', async () => {
    // `D-4.1`: permissions UNION across every `UserRole`. The same
    // permission is granted on BOTH roles, so a union that repeated it —
    // or a "primary role" that ignored the second — would answer wrong.
    const userId = await aUser('union');
    const readOwnId = await aPermission(READ_OWN);
    const otherId = await aPermission(OTHER_PERMISSION);
    await aRoleGranted(userId, [otherId, readOwnId]);
    await aRoleGranted(userId, [readOwnId]);

    const response = await me(harness, await aSessionCookie(userId));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      permissions: [OTHER_PERMISSION, READ_OWN],
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// The refusals — `PLT-205` T3. Each is a way the answer could have been
// "allowed" for a caller who should not have it.
// ═══════════════════════════════════════════════════════════════════════
describe('a caller whose roles do not grant the key', () => {
  it('is refused with 403, even with a perfectly valid session', async () => {
    // THE direct-API bypass the story names. A valid session is
    // authentication, not authorisation: before `PermissionGuard` this
    // request would have been answered for any signed-in user.
    const userId = await aUser('ungranted');
    await aRoleGranted(userId, [await aPermission(OTHER_PERMISSION)]);

    const response = await me(harness, await aSessionCookie(userId));

    expect(response.status).toBe(403);
  });

  it('is refused for a user holding NO role at all', async () => {
    // The fail-closed case end to end. A reader defaulting to "allow" on
    // an empty result would answer 200 here and hand every unassigned
    // account the school's permission set.
    const userId = await aUser('roleless');

    expect((await me(harness, await aSessionCookie(userId))).status).toBe(403);
  });

  it('answers every refusal identically, so it is not an oracle', async () => {
    // `AGENTS.md` 2.13. "You hold no role" and "your role lacks this key"
    // must be indistinguishable, or the route enumerates the catalogue to
    // a caller.
    const ungranted = await aUser('oracle-ungranted');
    await aRoleGranted(ungranted, [await aPermission(OTHER_PERMISSION)]);
    const roleless = await aUser('oracle-roleless');

    const bodies = [
      (await me(harness, await aSessionCookie(ungranted))).body,
      (await me(harness, await aSessionCookie(roleless))).body,
    ];

    expect(bodies[0]).toBe(bodies[1]);
  });

  it('picks up a grant made AFTER the session was opened', async () => {
    // The mirror of revocation: no snapshot is taken at sign-in. A session
    // is a statement about authentication, not a frozen copy of the
    // caller's roles.
    const userId = await aUser('late-grant');
    const cookie = await aSessionCookie(userId);

    expect((await me(harness, cookie)).status).toBe(403);

    await aRoleGranted(userId, [await aPermission(READ_OWN)]);

    expect((await me(harness, cookie)).status).toBe(200);
  });

  it('is refused the moment the grant is revoked', async () => {
    // No caching, and no snapshot taken at sign-in. A reader that cached
    // the key set per session would keep answering 200 after an
    // administrator removed the grant.
    const userId = await aUser('revoked');
    const permissionId = await aPermission(READ_OWN);
    const roleId = await aRoleGranted(userId, [permissionId]);
    const cookie = await aSessionCookie(userId);

    expect((await me(harness, cookie)).status).toBe(200);

    await prisma.rolePermission.deleteMany({ where: { schoolId, roleId, permissionId } });

    expect((await me(harness, cookie)).status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// The composition, over the wire.
// ═══════════════════════════════════════════════════════════════════════
describe('the three guards together', () => {
  it('answers 401 with no session, and 403 or 200 with one — the order, observably', async () => {
    // The single assertion that `PermissionGuard` is registered AFTER
    // `SessionGuard`. With the order reversed, the first request would
    // answer 403 too, and this file's other refusals would still pass.
    const userId = await aUser('ordered');
    await aRoleGranted(userId, [await aPermission(READ_OWN)]);

    expect((await me(harness)).status).toBe(401);
    expect((await me(harness, await aSessionCookie(userId))).status).toBe(200);
  });

  it('answers 401 for a session that is not real, even for a user who holds the key', async () => {
    // Proof that `PermissionGuard` reads the PRINCIPAL and not the cookie:
    // a forged cookie with a real granted user behind it must not reach
    // the permission check.
    const userId = await aUser('forged');
    await aRoleGranted(userId, [await aPermission(READ_OWN)]);

    expect((await me(harness, 'a-forged-session-token')).status).toBe(401);
  });

  it('answers only for the caller, never for another account', async () => {
    // Two users, two different key sets, one route: the response names the
    // caller's own keys and nothing else, and the caller without the key
    // is refused rather than answered with the other's set.
    const teacher = await aUser('teacher');
    const clerk = await aUser('clerk');
    const readOwnId = await aPermission(READ_OWN);
    const otherId = await aPermission(OTHER_PERMISSION);
    await aRoleGranted(teacher, [readOwnId, otherId]);
    await aRoleGranted(clerk, [otherId]);

    const teacherBody = JSON.parse((await me(harness, await aSessionCookie(teacher))).body);
    const clerkStatus = (await me(harness, await aSessionCookie(clerk))).status;

    expect(teacherBody).toEqual({ permissions: [OTHER_PERMISSION, READ_OWN] });
    expect(clerkStatus).toBe(403);
  });
});
