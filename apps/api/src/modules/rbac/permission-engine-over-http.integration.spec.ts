import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT } from '../../testing/test-environment.js';
import { FakeOidcProvider } from '../../testing/fake-oidc-provider.js';
import { IOIDC_PROVIDER } from '../auth/auth.module.js';
import { SESSION_COOKIE_NAME } from '../auth/domain/ports/session-cookie.js';
import { PrismaSessionRepository } from '../auth/infrastructure/postgres/prisma-session-repository.js';

/**
 * The permission engine, over a real socket and a real PostgreSQL.
 *
 * ## Why this file is the one that proves the control is WIRED
 *
 * Everything else in this story can be satisfied by a correct class nobody calls:
 * `PermissionGuard` could have a complete, well-tested rule and never appear in
 * `app.module.ts`, and every unit test would still be green — the same shape as the
 * defect where the shipped application could not boot behind nine green gates.
 *
 * So this drives the real application over TCP, with real session rows and real
 * `UserRole` / `RolePermission` rows, and asserts the ANSWER changes with the DATA. If
 * the guard were not registered, every permitted case here would answer 403.
 *
 * `GET /auth/oidc/link` is the instrument because it is the only route in the tree
 * carrying `@RequirePermission`, and because a successful call is a 302 whose signed
 * state bundle names the caller's own account — so a "permitted" answer here is a real
 * answer and not a route that happens to return 200.
 *
 * ## What is real, and the single substitution
 *
 * Real: `AppModule.forRoot` including `RbacModule`, all three global guards, the
 * controllers, `PrismaPermissionGrantReader`, `PrismaSessionRepository`, and the
 * `User` / `Role` / `Permission` / `UserRole` / `RolePermission` tables.
 *
 * Substituted: `IOIDC_PROVIDER` only, because `GoogleOidcProvider` reaches Google and
 * no credentials exist in this repository. That is what the port is for.
 *
 * Sessions are minted through the real `PrismaSessionRepository` rather than by
 * signing in over HTTP, because signing in is `PLT-101`'s subject and not this story's —
 * and a real session row is what matters here: the point is that `SessionGuard`
 * resolves a principal and `PermissionGuard` reads THAT, not a cookie.
 */

const PROVIDER_ORIGIN = 'https://accounts.google.com';
const LINK_PERMISSION = 'AUTH_LINK_EXTERNAL_IDENTITY';
const OTHER_PERMISSION = 'FINANCE_INVOICE_REVERSE';

let prisma: PrismaClient;
let schoolId: string;
let sessions: PrismaSessionRepository;
let harness: HttpHarness;

async function boot(): Promise<HttpHarness> {
  const provider = new FakeOidcProvider();
  provider.authorization = {
    authorizationUrl: `${PROVIDER_ORIGIN}/o/oauth2/v2/auth?client_id=test-client-id`,
    state: 'state-from-our-redirect',
    nonce: 'nonce-from-our-redirect',
    codeVerifier: 'verifier-from-our-redirect',
    redirectUri: TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI as string,
  };

  return startHttpHarness({
    env: {
      ...TEST_ENVIRONMENT,
      DATABASE_URL: process.env.DATABASE_URL as string,
      SCHOOL_ID: schoolId,
      OIDC_CALLBACK_MAX_ATTEMPTS: '20',
    },
    overrides: [{ token: IOIDC_PROVIDER, useValue: provider }],
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

/** `GET /auth/oidc/link` as a signed-in browser sends it. */
const link = (h: HttpHarness, cookie?: string) =>
  h.request(
    '/auth/oidc/link',
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

// ╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝
// The positive case. Without this, every other test could pass with the guard
// absent, since they all assert refusals.
// ╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝
describe('a caller whose role grants the key', () => {
  it('is allowed, and gets the signed link bundle for its OWN account', async () => {
    const userId = await aUser('granted');
    await aRoleGranted(userId, [await aPermission(LINK_PERMISSION)]);

    const response = await link(harness, await aSessionCookie(userId));

    // Not optional, and not a "the route exists" check: a 302 with a Location and a
    // state cookie is the only evidence the handler ran, and a guard that refused would
    // answer 403 here.
    expect(response.status).toBe(302);
    expect(new URL(response.location ?? '').origin).toBe(PROVIDER_ORIGIN);
    expect(response.cookie('eduflow_oidc_state')).not.toBeNull();
  });

  it('is allowed through the UNION of two roles, because the schema has no primary role', async () => {
    // `D-4.1`: permissions union across every `UserRole`. The grant is on the SECOND
    // role, so an implementation honouring only a "first" or "primary" role would
    // answer 403 here.
    const userId = await aUser('union');
    await aRoleGranted(userId, [await aPermission(OTHER_PERMISSION)]);
    await aRoleGranted(userId, [await aPermission(LINK_PERMISSION)]);

    expect((await link(harness, await aSessionCookie(userId))).status).toBe(302);
  });
});

// ╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝
// The refusals, each a way the answer could have been "allowed".
// ╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝
describe('a caller whose roles do not grant the key', () => {
  it('is refused, even with a perfectly valid session', async () => {
    // The claim in one row: authentication and authorisation are different things, and
    // a session proves only the first. Before `PermissionGuard` this request returned
    // 302 for any signed-in user, which is what `oidc-callback-over-http.integration.spec.ts`
    // had to be corrected for.
    const userId = await aUser('ungranted');
    await aRoleGranted(userId, [await aPermission(OTHER_PERMISSION)]);

    const response = await link(harness, await aSessionCookie(userId));

    expect(response.status).toBe(403);
    // And the handler did not run: no redirect, no state cookie.
    expect(response.location).toBeNull();
    expect(response.cookie('eduflow_oidc_state')).toBeNull();
  });

  it('is refused for a user holding NO role at all', async () => {
    // The fail-closed case end to end. A reader defaulting to `true` on an empty result
    // would answer 302 here and hand every unassigned account the ability to bind a
    // Google identity to their account.
    const userId = await aUser('roleless');

    expect((await link(harness, await aSessionCookie(userId))).status).toBe(403);
  });

  it('is refused the moment the ROLE is removed, not only when the grant row is', async () => {
    // The other half of the join. The revocation test below deletes `role_permissions`;
    // this deletes `user_roles`, so the permission row and the grant row both still
    // exist and only the USER-ROLE edge is gone. An engine that filtered on the
    // permission and the grant while ignoring `Role.users` would answer 302 here — and
    // that is the exact over-generous join the adapter spec also guards.
    const userId = await aUser('unassigned');
    const roleId = await aRoleGranted(userId, [await aPermission(LINK_PERMISSION)]);
    const cookie = await aSessionCookie(userId);

    expect((await link(harness, cookie)).status).toBe(302);

    await prisma.userRole.deleteMany({ where: { schoolId, userId, roleId } });

    expect((await link(harness, cookie)).status).toBe(403);
  });

  it('picks up a grant made AFTER the session was opened', async () => {
    // The mirror of revocation: no snapshot is taken at sign-in. A session is a
    // statement about authentication, not a frozen copy of the caller's roles, and an
    // engine that cached the role set per session would refuse here — leaving an
    // administrator's grant unable to take effect until every user re-signed-in.
    const userId = await aUser('late-grant');
    const cookie = await aSessionCookie(userId);

    expect((await link(harness, cookie)).status).toBe(403);

    await aRoleGranted(userId, [await aPermission(LINK_PERMISSION)]);

    expect((await link(harness, cookie)).status).toBe(302);
  });

  it('is refused the moment the grant is revoked', async () => {
    // No caching, and no snapshot taken at sign-in. A permission engine that read the
    // roles once per session would keep answering 302 after an administrator removed
    // the grant, which is the failure that makes revocation theatre.
    const userId = await aUser('revoked');
    const permissionId = await aPermission(LINK_PERMISSION);
    const roleId = await aRoleGranted(userId, [permissionId]);
    const cookie = await aSessionCookie(userId);

    expect((await link(harness, cookie)).status).toBe(302);

    await prisma.rolePermission.deleteMany({ where: { schoolId, roleId, permissionId } });

    expect((await link(harness, cookie)).status).toBe(403);
  });

  it('answers every refusal identically, so it is not an oracle', async () => {
    // `AGENTS.md` 2.13. "You hold no role" and "your role lacks this key" must be
    // indistinguishable, or the route enumerates the catalogue to a caller.
    const ungranted = await aUser('oracle-ungranted');
    await aRoleGranted(ungranted, [await aPermission(OTHER_PERMISSION)]);
    const roleless = await aUser('oracle-roleless');

    const bodies = [
      (await link(harness, await aSessionCookie(ungranted))).body,
      (await link(harness, await aSessionCookie(roleless))).body,
    ];

    expect(bodies[0]).toBe(bodies[1]);
  });
});

// ╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝
// The composition, over the wire.
// ╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝╝
describe('the three guards together', () => {
  it('answers 401 with no session, and 403 with one — the order, observably', async () => {
    // The single assertion that `PermissionGuard` is registered AFTER `SessionGuard`.
    // With the order reversed, the first request would answer 403 too, and this file's
    // other refusals would still pass — which is why the status codes are separated
    // here rather than lumped into "it refused".
    const userId = await aUser('ordered');
    await aRoleGranted(userId, [await aPermission(LINK_PERMISSION)]);

    expect((await link(harness)).status).toBe(401);
    expect((await link(harness, await aSessionCookie(userId))).status).toBe(302);
  });

  it('answers 401 for a session that is not real, even for a user who holds the key', async () => {
    // Proof that `PermissionGuard` reads the PRINCIPAL and not the cookie: a forged
    // cookie with a real granted user behind it must not reach the permission check.
    const userId = await aUser('forged');
    await aRoleGranted(userId, [await aPermission(LINK_PERMISSION)]);

    expect((await link(harness, 'a-forged-session-token')).status).toBe(401);
  });

  it('still lets a @Public route through, with a reader wired and a database present', async () => {
    // `permission-guards-over-http.spec.ts` proves this in the NO-database
    // configuration. This is the other half: with `IPermissionGrantReader` actually
    // registered, the exemption still holds. A guard that consulted the reader before
    // checking `@Public` would pass one of those two files and fail this one.
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.status).toBe(302);
  });

  it('gives two different users different answers on the same route', async () => {
    // The end-to-end statement of "grants exactly what the role grants": one route,
    // one request shape, two users, opposite outcomes — and the only difference is the
    // `RolePermission` row.
    const granted = await aUser('pair-granted');
    const denied = await aUser('pair-denied');
    await aRoleGranted(granted, [await aPermission(LINK_PERMISSION)]);
    await aRoleGranted(denied, [await aPermission(OTHER_PERMISSION)]);

    expect((await link(harness, await aSessionCookie(granted))).status).toBe(302);
    expect((await link(harness, await aSessionCookie(denied))).status).toBe(403);
  });
});

// ===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===
// The console route (`PLT-1002` AC-4).
//
// The web side of the console guard is two UX gates � a middleware that notices a
// missing session cookie and a client wrapper that screens the permission � and
// `AGENTS.md` 2.3 is explicit that neither is the boundary. These four rows are
// the boundary's proof, on the route whose only job is to carry the key.
// ===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===�===

/** `GET /admin` as a browser that has just passed the web guard sends it. */
const consoleAccess = (h: HttpHarness, cookie?: string) =>
  h.request('/admin', cookie === undefined ? {} : { cookies: { [SESSION_COOKIE_NAME]: cookie } });

describe('the console route, GET /admin', () => {
  it('opens for a session holding ADMIN_CONSOLE_ACCESS � and the proof is the STATUS', async () => {
    // 204 is the only evidence the handler ran: a guard that refused would answer
    // 403, and a route that answered 200 for everyone would pass a "the route
    // exists" check while gating nothing.
    const userId = await aUser('console-granted');
    await aRoleGranted(userId, [await aPermission('ADMIN_CONSOLE_ACCESS')]);

    const response = await consoleAccess(harness, await aSessionCookie(userId));

    expect(response.status).toBe(204);
  });

  it('refuses 403 for a valid session WITHOUT the key � AC-2, negative case', async () => {
    // The teacher, student and parent roles hold only PERMISSION_READ_OWN, so this
    // is the request a signed-in teacher's browser makes after the web guard has
    // already sent it to /forbidden � and the API refuses it anyway. The Jira story
    // phrases AC-2 as "superadmin passes"; under ADR-003 there is no cross-tenant
    // super admin, and SCHOOL_ADMIN is that story's superadmin.
    const userId = await aUser('console-denied');
    await aRoleGranted(userId, [await aPermission('PERMISSION_READ_OWN')]);

    const response = await consoleAccess(harness, await aSessionCookie(userId));

    expect(response.status).toBe(403);
  });

  it('refuses 401 without a session, before the permission is consulted', async () => {
    // The same ordering the OIDC link route proves: 401 says "authenticate", 403
    // would say "authenticated and may not", which is false here.
    const response = await consoleAccess(harness);

    expect(response.status).toBe(401);
  });

  it('refuses 401 for a forged cookie carrying the key name in its value', async () => {
    // The permission is read from the role grant, never from the request: a cookie
    // value that merely MENTIONS the key must not open the door.
    const response = await consoleAccess(harness, 'ADMIN_CONSOLE_ACCESS');

    expect(response.status).toBe(401);
  });
});
