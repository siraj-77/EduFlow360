import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  startHttpHarness,
  type HttpHarness,
  type HttpResponse,
} from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { FakeOidcProvider } from '../../testing/fake-oidc-provider.js';
import { FakeClock } from '../../testing/fake-clock.js';
import { IOIDC_PROVIDER } from './auth.module.js';
import { OIDC_STATE_COOKIE_NAME, type OidcStatePayload } from './domain/ports/oidc-state-store.js';
import { SESSION_COOKIE_NAME } from './domain/ports/session-cookie.js';
import { HmacOidcStateStore } from './infrastructure/adapters/oidc-state-store.js';
import { SystemClock } from './infrastructure/adapters/system-clock.js';

/**
 * `GET /auth/oidc/link` and `GET /auth/oidc/callback`, over a real socket, against a
 * real PostgreSQL.
 *
 * ## Why this file is the one that matters
 *
 * Everything else about these two routes is provable with a mock. What is NOT
 * provable with a mock is the thing that makes them safe or unsafe:
 *
 * - `SessionGuard` is registered **globally**, alongside `CsrfGuard`, and a global
 *   guard that failed to honour `@Public` would make `GET /auth/oidc/redirect` — the
 *   only route a browser can reach before a session exists — answer 401. Sign-in
 *   would be impossible and every other gate in this repository would still be green.
 * - The takeover scenario needs a real session cookie, a real signed state cookie and
 *   a real database row, because the whole question is what happens when all three are
 *   present at once.
 *
 * ## What is real and what is substituted
 *
 * **Real:** the application graph (`AppModule.forRoot`), both controllers, both
 * use-cases, `HmacOidcStateStore` with real HMAC, `ExpressCookieCarrier`, `CsrfGuard`,
 * `SessionGuard`, `PrismaExternalIdentityRepository`, `PrismaSessionRepository`,
 * `PrismaAllowedEmailDomainStore`, `SessionCookieAdapter`, `FixedWindowThrottle`, the
 * CORS configuration, and a kernel-assigned port.
 *
 * **Substituted: exactly one thing** — `IOIDC_PROVIDER`, because `GoogleOidcProvider`
 * reaches `oauth2.googleapis.com` and no Google credentials exist in this repository.
 * That substitution is exactly what the port exists for (`AGENTS.md` 2.2), and the
 * provider's own five checks are covered for real in
 * `google-oidc-provider.spec.ts`, against a locally generated RSA key with no network.
 *
 * ## One school per test
 *
 * `AGENTS.md` 2.1: one database per school. Sharing a `schoolId` across tests would
 * share one school's allowlist, one argon2 cost row and one throttle table — the very
 * things under test. Each test gets its own.
 */

const PROVIDER_ORIGIN = 'https://accounts.google.com';
const SUBJECT = 'google-subject-0000000001';
const OTHER_SUBJECT = 'google-subject-0000000002';
const PRINCIPAL_EMAIL = 'principal@school.test';
const PASSWORD = 'a-sufficiently-long-password';

/**
 * The `MODULE_ACTION` key `GET /auth/oidc/link` declares.
 *
 * Stated here rather than imported from the controller, because a matrix row and a
 * decorator are two descriptions of one thing and importing one from the other would
 * make a typo in the key invisible to this suite. `route-permissions.json` reconciles
 * the two against the source tree; this constant is what the fixture grants.
 */
const LINK_PERMISSION = 'AUTH_LINK_EXTERNAL_IDENTITY';

let prisma: PrismaClient;
let schoolId: string;
let provider: FakeOidcProvider;

/** `GET /auth/oidc/callback` as a browser sends it. */
const callback = (
  harness: HttpHarness,
  options: {
    readonly state?: string | null;
    readonly code?: string | null;
    readonly cookies?: Record<string, string>;
    /** Caller-chosen parameters the route does not read. See the takeover test. */
    readonly extraQuery?: Record<string, string>;
  } = {},
): Promise<HttpResponse> => {
  const query = new URLSearchParams();
  if (options.code !== null) query.set('code', options.code ?? 'auth-code-from-google');
  if (options.state !== null) query.set('state', options.state ?? 'state-does-not-matter');
  for (const [key, value] of Object.entries(options.extraQuery ?? {})) {
    query.set(key, value);
  }

  return harness.request(`/auth/oidc/callback?${query.toString()}`, {
    cookies: options.cookies ?? {},
  });
};

/** A bundle this deployment's own store produced, for the cases that need one. */
const bundleFrom = (payload: OidcStatePayload, clock: SystemClock = new SystemClock()): string =>
  new HmacOidcStateStore({ clock, secret: TEST_JWT_ACCESS_SECRET, ttlMs: 600_000 }).seal(payload)
    .value;

const signInBundle = (overrides?: Partial<{ state: string; nonce: string }>): string =>
  bundleFrom({
    mode: 'sign-in',
    state: overrides?.state ?? 'state-from-our-redirect',
    nonce: overrides?.nonce ?? 'nonce-from-our-redirect',
    codeVerifier: 'verifier-from-our-redirect',
    redirectUri: TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI as string,
  });

const linkBundle = (userId: string): string =>
  bundleFrom({
    mode: 'link',
    userId,
    state: 'state-from-our-link-route',
    nonce: 'nonce-from-our-link-route',
    codeVerifier: 'verifier-from-our-link-route',
    redirectUri: TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI as string,
  });

/** One account in this deployment, ACTIVE, with a real argon2id digest. */
async function aUser(email = PRINCIPAL_EMAIL): Promise<string> {
  const { Argon2PasswordHasher } =
    await import('./infrastructure/adapters/argon2-password-hasher.js');
  const { DEFAULT_PASSWORD_HASH_PARAMETERS } =
    await import('../settings/domain/services/password-hash-parameters.js');

  const hasher = new Argon2PasswordHasher({ currentParameters: DEFAULT_PASSWORD_HASH_PARAMETERS });
  const hashed = await hasher.hash(PASSWORD, DEFAULT_PASSWORD_HASH_PARAMETERS);

  return (
    await prisma.user.create({
      data: {
        schoolId,
        email,
        username: email,
        status: 'ACTIVE',
        passwordHash: hashed.hash,
        passwordAlgorithm: hashed.algorithm,
      },
      select: { id: true },
    })
  ).id;
}

/**
 * Boot the harness for this test's school.
 *
 * `OIDC_CALLBACK_MAX_ATTEMPTS` is deliberately generous so the throttle test is the
 * only one that trips it — a throttle firing mid-suite turns every later assertion
 * into a mystery.
 */
async function boot(): Promise<HttpHarness> {
  return startHttpHarness({
    env: {
      ...TEST_ENVIRONMENT,
      DATABASE_URL: process.env.DATABASE_URL as string,
      SCHOOL_ID: schoolId,
      JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
      OIDC_CALLBACK_MAX_ATTEMPTS: '20',
    },
    overrides: [{ token: IOIDC_PROVIDER, useValue: provider }],
  });
}

/**
 * Give `userId` the `MODULE_ACTION` key `GET /auth/oidc/link` is gated on, by writing
 * the four rows the schema models a grant with.
 *
 * ## Why this exists, and why it makes the suite STRONGER rather than weaker
 *
 * That route carries `@RequirePermission('AUTH_LINK_EXTERNAL_IDENTITY')`. Until
 * `PermissionGuard` existed (PLT-201) that decorator was unread metadata, so a user
 * holding **no role at all** could begin a link flow, and this file's assertion of a
 * 302 was in truth an assertion that authentication alone was enough.
 *
 * Being authenticated is not sufficient, and never was the intent: the route binds a
 * Google identity to the caller's OWN account, which is why it is the one route in the
 * tree with a permission on it. So the fixture now stages a user who **holds** the
 * permission.
 *
 * The four rows are written rather than the reader stubbed. A stub would leave the
 * schema untested, and this suite talks to a real PostgreSQL precisely so that claims
 * about what the schema allows are claims about the schema.
 *
 * `upsert` on the permission because `Permission` is unique on `(school_id, key)` and
 * several tests in this file create a session for the same school; the role is unique by
 * name, so it carries the uuid instead.
 */
async function grantLinkPermission(userId: string): Promise<void> {
  const permission = await prisma.permission.upsert({
    where: { schoolId_key: { schoolId, key: LINK_PERMISSION } },
    update: {},
    create: {
      schoolId,
      key: LINK_PERMISSION,
      module: 'AUTH',
      action: 'LINK_EXTERNAL_IDENTITY',
    },
    select: { id: true },
  });

  const role = await prisma.role.create({
    data: { schoolId, name: `link-holder-${randomUUID()}`, isSystemRole: false },
    select: { id: true },
  });

  await prisma.rolePermission.create({
    data: { schoolId, roleId: role.id, permissionId: permission.id },
  });

  await prisma.userRole.create({ data: { schoolId, userId, roleId: role.id } });
}

/** A live session cookie for `userId`, obtained by really signing in. */
async function aSessionCookie(harness: HttpHarness): Promise<{ cookie: string; userId: string }> {
  const userId = await aUser();
  await grantLinkPermission(userId);
  const { Argon2PasswordHasher } =
    await import('./infrastructure/adapters/argon2-password-hasher.js');
  const { DEFAULT_PASSWORD_HASH_PARAMETERS } =
    await import('../settings/domain/services/password-hash-parameters.js');
  const hasher = new Argon2PasswordHasher({ currentParameters: DEFAULT_PASSWORD_HASH_PARAMETERS });
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: (await hasher.hash(PASSWORD, DEFAULT_PASSWORD_HASH_PARAMETERS)).hash },
  });

  const signedIn = await harness.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-eduflow-csrf': 'test' },
    body: JSON.stringify({ identifier: PRINCIPAL_EMAIL, password: PASSWORD }),
  });
  const cookie = signedIn.cookie(SESSION_COOKIE_NAME)?.value;
  if (cookie === undefined) {
    throw new Error(
      `could not obtain a session cookie: POST /auth/login answered ${signedIn.status} ${signedIn.body}`,
    );
  }

  return { cookie, userId };
}

/** This school's allowlist. `null` means "no settings row", which is LOCKED. */
async function configureDomains(allowlist: unknown): Promise<void> {
  await prisma.schoolSettings.create({
    data: {
      schoolId,
      name: 'Callback harness school',
      timezone: 'Asia/Colombo',
      defaultLocale: 'en',
      currencyCode: 'LKR',
      minorUnitScale: 2,
      roundingMode: 'HALF_UP',
      academicYearStartMonth: 1,
      settings: {},
      passwordHashParameters: { memoryCost: 19456, timeCost: 2, parallelism: 1 },
      allowedEmailDomains: allowlist as never,
    },
  });
}

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite makes real requests against a real database, and ' +
        'the takeover scenario cannot be staged without a real session row.',
    );
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();

  schoolId = randomUUID();
  provider = new FakeOidcProvider();
  // The fake's DEFAULT authorization URL is `https://provider.test/...`, which
  // `BeginOidcSignIn` correctly refuses as an untrusted redirect target. Pointing it
  // at the real configured origin is what makes the substitute behave like the
  // adapter it stands in for — and it means this suite also exercises the
  // trusted-origin check on the link route, because a wrong origin here would fail
  // loudly rather than pass quietly.
  provider.authorization = {
    authorizationUrl: `${PROVIDER_ORIGIN}/o/oauth2/v2/auth?client_id=test-client-id`,
    state: 'state-from-our-redirect',
    nonce: 'nonce-from-our-redirect',
    codeVerifier: 'verifier-from-our-redirect',
    redirectUri: TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI as string,
  };
  provider.identity = {
    subject: SUBJECT,
    email: PRINCIPAL_EMAIL,
    emailVerified: true,
    provider: 'google',
  };
});

afterAll(async () => {
  await prisma?.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════
// The interaction this file exists for: `SessionGuard` is registered globally
// ALONGSIDE `CsrfGuard`, and the `@Public` routes must still be reachable.
// ═══════════════════════════════════════════════════════════════════════════
describe('the globally-registered SessionGuard does not break the public routes', () => {
  it('leaves GET /auth/oidc/redirect reachable with no session at all', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    const response = await harness.request('/auth/oidc/redirect');

    // The single most valuable assertion in this file. If `SessionGuard` were
    // registered but failed to honour `@Public`, this is the request that answers 401
    // — and sign-in becomes impossible while every static gate stays green.
    expect(response.status).toBe(302);
    expect(new URL(response.location ?? '').origin).toBe(PROVIDER_ORIGIN);
    await harness.close();
  });

  it('leaves GET /auth/oidc/callback reachable with no session, and refuses it properly', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    // Reachable, then refused — a 401 from the handler, not a 401 from the guard. The
    // state cookie is absent, and the answer is the same one the guard would give.
    const response = await callback(harness, { state: null });

    expect(response.status).toBe(401);
    expect(response.cookies.map((c) => c.name)).not.toContain(SESSION_COOKIE_NAME);
    await harness.close();
  });

  it('leaves POST /auth/login reachable, so a session can be obtained at all', async () => {
    // `POST /auth/login` is `@Public`. If the guard refused public routes, this is
    // where it shows first — and the whole chain (link needs a session; sign-in needs
    // Google) would be dead with nothing failing.
    await configureDomains(['school.test']);
    await aUser();
    const harness = await boot();

    const response = await harness.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-eduflow-csrf': 'test' },
      body: JSON.stringify({ identifier: PRINCIPAL_EMAIL, password: PASSWORD }),
    });

    expect(response.status).toBe(200);
    await harness.close();
  });

  it('still answers 403 for a state-changing request with no CSRF header', async () => {
    // The OTHER guard, and the reason the two registrations must coexist rather than
    // replace each other: a session cookie satisfies `SessionGuard`, so the CSRF check
    // cannot be skipped by being signed in.
    await configureDomains(['school.test']);
    const harness = await boot();
    const { cookie } = await aSessionCookie(harness);

    const response = await harness.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookies: { [SESSION_COOKIE_NAME]: cookie },
      body: JSON.stringify({ identifier: PRINCIPAL_EMAIL, password: PASSWORD }),
    });

    expect(response.status).toBe(403);
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// `GET /auth/oidc/link` — authenticated, and it links ONLY to the caller's account.
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /auth/oidc/link', () => {
  it('refuses an unauthenticated caller', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    const response = await harness.request('/auth/oidc/link');

    expect(response.status).toBe(401);
    expect(response.location).toBeNull();
    expect(response.cookie(OIDC_STATE_COOKIE_NAME)).toBeNull();
    await harness.close();
  });

  it('refuses a caller whose session cookie is unknown', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    const response = await harness.request('/auth/oidc/link', {
      cookies: { [SESSION_COOKIE_NAME]: 'not-a-real-session-token' },
    });

    expect(response.status).toBe(401);
    await harness.close();
  });

  it('refuses a caller whose session has expired', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const { cookie, userId } = await aSessionCookie(harness);
    await prisma.session.updateMany({
      where: { schoolId, userId },
      data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    });

    const response = await harness.request('/auth/oidc/link', {
      cookies: { [SESSION_COOKIE_NAME]: cookie },
    });

    expect(response.status).toBe(401);
    await harness.close();
  });

  it('redirects an authenticated caller to the provider, with a signed link bundle', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const { cookie, userId } = await aSessionCookie(harness);

    const response = await harness.request('/auth/oidc/link', {
      cookies: { [SESSION_COOKIE_NAME]: cookie },
    });

    expect(response.status).toBe(302);
    expect(new URL(response.location ?? '').origin).toBe(PROVIDER_ORIGIN);
    // The bundle this route writes names THIS account and says `link`, and both facts
    // are inside the signature.
    const opened = new HmacOidcStateStore({
      clock: new SystemClock(),
      secret: TEST_JWT_ACCESS_SECRET,
      ttlMs: 600_000,
    }).open(response.cookie(OIDC_STATE_COOKIE_NAME)?.value);
    expect(opened?.mode).toBe('link');
    expect(opened?.userId).toBe(userId);
    await harness.close();
  });

  it('never writes the session token into the link response body', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const { cookie } = await aSessionCookie(harness);

    const response = await harness.request('/auth/oidc/link', {
      cookies: { [SESSION_COOKIE_NAME]: cookie },
    });

    expect(response.body).not.toContain(cookie);
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// `GET /auth/oidc/callback` — the happy path.
// ═══════════════════════════════════════════════════════════════════════════
describe('a callback that should sign a user in', () => {
  it('answers 200 and sets exactly one session cookie, HttpOnly and Secure', async () => {
    await configureDomains(['school.test']);
    const userId = await aUser();
    await prisma.externalIdentity.create({
      data: { schoolId, provider: 'google', providerSubject: SUBJECT, userId },
    });
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.status).toBe(200);
    const session = response.cookie(SESSION_COOKIE_NAME);
    expect(session).not.toBeNull();
    expect(session?.raw).toMatch(/;\s*HttpOnly/i);
    expect(session?.raw).toMatch(/;\s*Secure/i);
    expect(session?.raw).toMatch(/;\s*SameSite=Lax/i);
    expect(session?.attributes.path).toBe('/');
    await harness.close();
  });

  it('issues a session row that THIS deployment can resolve from the cookie value', async () => {
    await configureDomains(['school.test']);
    const userId = await aUser();
    await prisma.externalIdentity.create({
      data: { schoolId, provider: 'google', providerSubject: SUBJECT, userId },
    });
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    const stored = await prisma.session.findFirstOrThrow({
      where: { schoolId },
      select: { userId: true, tokenHash: true, revokedAt: true },
    });
    expect(stored.userId).toBe(userId);
    expect(stored.revokedAt).toBeNull();
    // And the cookie value is only ever its SHA-256, so this join is the only way the
    // two could be checked at all.
    expect(stored.tokenHash).toBe(
      createHash('sha256')
        .update(response.cookie(SESSION_COOKIE_NAME)?.value ?? '')
        .digest('hex'),
    );
    await harness.close();
  });

  it('clears the state bundle on success, so it cannot be replayed', async () => {
    await configureDomains(['school.test']);
    const userId = await aUser();
    await prisma.externalIdentity.create({
      data: { schoolId, provider: 'google', providerSubject: SUBJECT, userId },
    });
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    const cleared = response.cookie(OIDC_STATE_COOKIE_NAME);
    expect(cleared).not.toBeNull();
    expect(cleared?.attributes.path).toBe('/auth/oidc');
    expect(new Date(cleared?.attributes.expires ?? 0).getTime()).toBeLessThanOrEqual(0);
    await harness.close();
  });

  it('never puts the session token in the response body', async () => {
    await configureDomains(['school.test']);
    const userId = await aUser();
    await prisma.externalIdentity.create({
      data: { schoolId, provider: 'google', providerSubject: SUBJECT, userId },
    });
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.body).not.toContain(response.cookie(SESSION_COOKIE_NAME)?.value ?? '');
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// `D57`, over HTTP: an unknown subject is refused and CREATES NOTHING.
// ═══════════════════════════════════════════════════════════════════════════
describe('a callback from a Google identity nobody has linked — D57', () => {
  it('answers 401, issues no session, and creates no identity and no user', async () => {
    await configureDomains(['school.test']);
    // A verified @school.test Google account with NO ExternalIdentity row. This is the
    // student-with-a-school-Gmail case, and the whole point is that it stops here.
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.status).toBe(401);
    expect(response.cookie(SESSION_COOKIE_NAME)).toBeNull();
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
    expect(await prisma.externalIdentity.count({ where: { schoolId } })).toBe(0);
    expect(await prisma.user.count({ where: { schoolId } })).toBe(0);
    await harness.close();
  });

  it('still clears the state bundle on a refusal', async () => {
    // Otherwise a failed callback leaves a live-looking bundle in the browser.
    await configureDomains(['school.test']);
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    // Set through `@Res({ passthrough: true })` BEFORE the handler throws, so this is
    // also the proof that a cookie written before an exception survives Nest's filter.
    expect(response.cookie(OIDC_STATE_COOKIE_NAME)).not.toBeNull();
    expect(
      new Date(response.cookie(OIDC_STATE_COOKIE_NAME)?.attributes.expires ?? 0).getTime(),
    ).toBeLessThanOrEqual(0);
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE TAKEOVER.
//
// A victim is signed in. An attacker starts a Google sign-in in the VICTIM's
// browser and completes it with the ATTACKER's own Google account. The callback sees
// the victim's session cookie.
//
// Naive design: "session cookie present, therefore link" — the attacker's identity is
// bound to the victim's account, and the attacker then signs in as the victim.
//
// Here: the bundle is SIGN-IN mode and names no account, so there is nothing to link.
// ═══════════════════════════════════════════════════════════════════════════
describe('THE TAKEOVER — a callback with a valid session cookie present', () => {
  it('does NOT link the attacker-s Google identity to the victim-s account', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const { cookie: victimCookie, userId: victimId } = await aSessionCookie(harness);
    const before = await prisma.externalIdentity.count({ where: { schoolId } });

    // The attacker-s own Google identity: verified, permitted domain, NOT linked.
    provider.identity = {
      subject: OTHER_SUBJECT,
      email: 'attacker@school.test',
      emailVerified: true,
      provider: 'google',
    };

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      // Both cookies present. This is the attack.
      cookies: {
        [SESSION_COOKIE_NAME]: victimCookie,
        [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }),
      },
    });

    // Refused, because the identity is not linked — and NOT because a cookie was seen.
    expect(response.status).toBe(401);
    // The decisive assertion: nothing was written against the victim's account.
    expect(await prisma.externalIdentity.count({ where: { schoolId } })).toBe(before);
    expect(await prisma.externalIdentity.count({ where: { schoolId, userId: victimId } })).toBe(0);
    expect(response.cookie(SESSION_COOKIE_NAME)).toBeNull();
    expect(await prisma.session.count({ where: { schoolId, userId: victimId } })).toBe(1);
    await harness.close();
  });

  it('cannot be flipped into a link by a query parameter', async () => {
    // The mode is sealed inside the MAC. A caller who appends `?mode=link` — or
    // `?link=true`, or anything else — is describing a request the callback never
    // reads, because the mode it acts on came out of a signature it verified.
    await configureDomains(['school.test']);
    const harness = await boot();
    const { cookie } = await aSessionCookie(harness);

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: {
        [SESSION_COOKIE_NAME]: cookie,
        [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }),
      },
      extraQuery: { mode: 'link', link: 'true', flow: 'link', userId: 'whoever' },
    });

    expect(response.status).toBe(401);
    expect(await prisma.externalIdentity.count({ where: { schoolId } })).toBe(0);
    expect(await prisma.session.count({ where: { schoolId } })).toBeGreaterThan(0);
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The refusals, in order, over HTTP.
// ═══════════════════════════════════════════════════════════════════════════
describe('a callback that must be refused', () => {
  const withALinkedIdentity = async (harness: HttpHarness): Promise<void> => {
    const userId = await aUser();
    await prisma.externalIdentity.create({
      data: { schoolId, provider: 'google', providerSubject: SUBJECT, userId },
    });
    void harness;
  };

  it('refuses an ABSENT state cookie', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    const response = await callback(harness, { state: null });

    expect(response.status).toBe(401);
    expect(provider.calls.filter((c) => c.method === 'verifyCallback')).toHaveLength(0);
    await harness.close();
  });

  it('refuses a FORGED state cookie, and never reaches the provider', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const signed = signInBundle({ state: 'state-from-our-redirect' });
    const [payload, signature] = signed.split('.') as [string, string];
    const forged = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: forged },
    });

    expect(response.status).toBe(401);
    // The ordering, over the wire: a forged bundle must cost no token exchange.
    expect(provider.calls.filter((c) => c.method === 'verifyCallback')).toHaveLength(0);
    await harness.close();
  });

  it('refuses an EXPIRED state cookie, from the server-side clock', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    // Sealed by a store whose clock reads 2020, opened by the application's store
    // whose clock reads now. Deterministic — no sleeping, and no race with a
    // millisecond window that might still be open when the request lands.
    const sealed = new HmacOidcStateStore({
      clock: new FakeClock('2020-01-01T00:00:00.000Z'),
      secret: TEST_JWT_ACCESS_SECRET,
      ttlMs: 600_000,
    }).seal({
      mode: 'sign-in',
      state: 'state-from-our-redirect',
      nonce: 'nonce',
      codeVerifier: 'verifier',
      redirectUri: TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI as string,
    });

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: sealed.value },
    });

    expect(response.status).toBe(401);
    // The `Expires` on the cookie is still in the future for a 2020 issue, so a
    // browser would have sent it. Only the server-side age check refuses it — which
    // is the property `AGENTS.md` 2.4's injected clock exists to make testable.
    expect(provider.calls.filter((c) => c.method === 'verifyCallback')).toHaveLength(0);
    await harness.close();
  });

  it('refuses a state that is not the one inside the bundle', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    const response = await callback(harness, {
      state: 'state-the-attacker-chose',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.status).toBe(401);
    expect(provider.calls.filter((c) => c.method === 'verifyCallback')).toHaveLength(0);
    await harness.close();
  });

  it.each([
    { case: 'false', emailVerified: false },
    { case: 'absent, which means the provider said nothing', emailVerified: null },
  ])(
    'refuses an UNVERIFIED email ($case), even for a linked identity',
    async ({ emailVerified }) => {
      // BOTH cases, not just `false`. `null` is "the provider asserted nothing about
      // this address", and a mutation that refused only `false` would pass a suite that
      // tested only `false` — which is exactly what the first version of this test did.
      await configureDomains(['school.test']);
      const harness = await boot();
      await withALinkedIdentity(harness);
      provider.identity = {
        subject: SUBJECT,
        email: PRINCIPAL_EMAIL,
        emailVerified,
        provider: 'google',
      };

      const response = await callback(harness, {
        state: 'state-from-our-redirect',
        cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
      });

      expect(response.status).toBe(401);
      expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
      await harness.close();
    },
  );

  it('refuses when the allowlist is EMPTY, which is LOCKED rather than open', async () => {
    await configureDomains([]);
    const harness = await boot();
    await withALinkedIdentity(harness);

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.status).toBe(401);
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
    await harness.close();
  });

  it('refuses when there is NO settings row at all, which is the same lock', async () => {
    // No `configureDomains` call: a freshly provisioned database.
    const harness = await boot();
    await withALinkedIdentity(harness);

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.status).toBe(401);
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
    await harness.close();
  });

  it('answers every refusal with byte-identical bodies, so it is not an oracle', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const good = signInBundle({ state: 'state-from-our-redirect' });
    const [payload, signature] = good.split('.') as [string, string];

    const bodies = new Set<string>();
    const cases = [
      { state: null, cookies: {} },
      { state: null, cookies: { [OIDC_STATE_COOKIE_NAME]: 'nonsense' } },
      {
        state: 'state-from-our-redirect',
        cookies: { [OIDC_STATE_COOKIE_NAME]: `${payload.slice(0, -1)}A.${signature}` },
      },
      {
        state: 'state-the-attacker-chose',
        cookies: { [OIDC_STATE_COOKIE_NAME]: good },
      },
      { state: null, cookies: { [OIDC_STATE_COOKIE_NAME]: good } },
    ];

    for (const options of cases) {
      const response = await callback(harness, options);
      expect(response.status).toBe(401);
      bodies.add(response.body);
    }

    expect(bodies.size, 'the refusals differ, so this route enumerates its internals').toBe(1);
    await harness.close();
  });

  it('refuses a provider that rejects the exchange', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    await withALinkedIdentity(harness);
    provider.rejectEveryCallback = new Error('ID token was rejected: signature invalid');

    const response = await callback(harness, {
      state: 'state-from-our-redirect',
      cookies: { [OIDC_STATE_COOKIE_NAME]: signInBundle({ state: 'state-from-our-redirect' }) },
    });

    expect(response.status).toBe(401);
    // The provider-s own words must not reach the caller: they name which of its five
    // checks failed.
    expect(response.body.toLowerCase()).not.toContain('signature');
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Link mode, completing at the PUBLIC callback.
// ═══════════════════════════════════════════════════════════════════════════
describe('a link flow completing at the public callback', () => {
  it('links the identity to the account the AUTHENTICATED route named', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const userId = await aUser();

    const response = await callback(harness, {
      state: 'state-from-our-link-route',
      cookies: { [OIDC_STATE_COOKIE_NAME]: linkBundle(userId) },
    });

    expect(response.status).toBe(200);
    expect(
      await prisma.externalIdentity.findFirstOrThrow({
        where: { schoolId, providerSubject: SUBJECT },
        select: { userId: true, providerEmail: true, providerEmailVerified: true },
      }),
    ).toEqual({ userId, providerEmail: PRINCIPAL_EMAIL, providerEmailVerified: true });
    await harness.close();
  });

  it('issues NO session on a link, because the caller already has one', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const userId = await aUser();

    const response = await callback(harness, {
      state: 'state-from-our-link-route',
      cookies: { [OIDC_STATE_COOKIE_NAME]: linkBundle(userId) },
    });

    expect(response.status).toBe(200);
    expect(response.cookie(SESSION_COOKIE_NAME)).toBeNull();
    expect(await prisma.session.count({ where: { schoolId } })).toBe(0);
    await harness.close();
  });

  it('REFUSES to move an identity that already belongs to another account', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();
    const victim = await aUser();
    const attacker = await aUser('attacker-victim@school.test');
    await prisma.externalIdentity.create({
      data: { schoolId, provider: 'google', providerSubject: SUBJECT, userId: attacker },
    });

    const response = await callback(harness, {
      state: 'state-from-our-link-route',
      cookies: { [OIDC_STATE_COOKIE_NAME]: linkBundle(victim) },
    });

    expect(response.status).toBe(401);
    expect(
      (
        await prisma.externalIdentity.findFirstOrThrow({
          where: { schoolId, providerSubject: SUBJECT },
          select: { userId: true },
        })
      ).userId,
    ).toBe(attacker);
    await harness.close();
  });

  it('still refuses a link whose Google address the school does not admit', async () => {
    await configureDomains(['other.test']);
    const harness = await boot();
    const userId = await aUser();

    const response = await callback(harness, {
      state: 'state-from-our-link-route',
      cookies: { [OIDC_STATE_COOKIE_NAME]: linkBundle(userId) },
    });

    expect(response.status).toBe(401);
    expect(await prisma.externalIdentity.count({ where: { schoolId } })).toBe(0);
    await harness.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The throttle, over a socket.
// ═══════════════════════════════════════════════════════════════════════════
describe('the source throttle on the callback', () => {
  it('eventually answers 429 with a Retry-After, from one source', async () => {
    await configureDomains(['school.test']);
    const harness = await boot();

    let sawThrottle = false;
    let sawRetryAfter = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await callback(harness, { state: null, cookies: {} });
      if (response.status === 429) {
        sawThrottle = true;
        sawRetryAfter = Boolean(response.headers.get('retry-after'));
        break;
      }
    }

    expect(sawThrottle, 'forty callbacks from one source were never throttled').toBe(true);
    expect(sawRetryAfter, 'a 429 with no Retry-After cannot be waited out').toBe(true);
    await harness.close();
  });
});
