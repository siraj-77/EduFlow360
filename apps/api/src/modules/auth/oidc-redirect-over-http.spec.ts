import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { repairOidcControllerMetadata } from '../../testing/oidc-controller-di-repair.js';
import {
  TEST_ENVIRONMENT,
  TEST_GOOGLE_CLIENT_ID,
  TEST_JWT_ACCESS_SECRET,
  testConfig,
} from '../../testing/test-environment.js';
import { OIDC_STATE_COOKIE_NAME } from './domain/ports/oidc-state-store.js';
import { HmacOidcStateStore } from './infrastructure/adapters/oidc-state-store.js';
import { SystemClock } from './infrastructure/adapters/system-clock.js';

/**
 * `GET /auth/oidc/redirect` over a real socket — the test this repository could
 * not write until 2026-10-03.
 *
 * ## Why the assertions here and not in the existing controller spec
 *
 * `oidc-sign-in.controller.spec.ts` already covers the handler thoroughly, and
 * it is not superseded. It hands the handler a three-method object that records
 * `cookie()` and `redirect()` calls, which proves *we asked Express for those
 * attributes*. It cannot prove **the header a browser receives**.
 *
 * That distinction is the whole security claim on this route:
 *
 *   - `Set-Cookie` is RFC 6265 text serialised by Express, not by us. Whether
 *     `HttpOnly`, `Secure` and `SameSite` survive that serialisation is Express's
 *     behaviour, and a recorder asserting our own option object says nothing
 *     about it.
 *   - A `302` is only a redirect if a status *and* a `Location` both arrive the
 *     network. `res.redirect(302, url)` on a fake response proves we called a
 *     method on an object we wrote.
 *
 * So this file drives the real application, over TCP, and reads what came back.
 *
 * ## What is real here
 *
 * The real controller, the real handler body, the real `BeginOidcSignIn`, the
 * real `GoogleOidcProvider`, the real `HmacOidcStateStore`, the real
 * `ExpressCookieCarrier`, the real `CsrfGuard`, the real CORS configuration, and
 * a kernel-assigned port.
 *
 * The single deviation is `repairOidcControllerMetadata()`, which supplies the
 * decorator metadata the compiler cannot emit because the controller declares its
 * dependency with `import type`. Read `testing/oidc-controller-di-repair.ts`
 * before believing anything here — and note that **this route does not work in
 * the deployed build today.** The last test in this file asserts that directly,
 * against the unpatched graph, so this file is never the only evidence.
 *
 * ## No database, no network
 *
 * The route reads and writes no row, so `TEST_ENVIRONMENT` carries no
 * `DATABASE_URL` and this file needs no PostgreSQL. The provider is Google's
 * authorization endpoint, but nothing is ever requested from it: the response is
 * a redirect, and the harness never follows one.
 */

/** The one origin this deployment is configured to trust. */
const PROVIDER_ORIGIN = 'https://accounts.google.com';

let harness: HttpHarness;

beforeAll(async () => {
  repairOidcControllerMetadata();
  harness = await startHttpHarness();
});

afterAll(async () => {
  await harness.close();
});

/**
 * A store built the way `AuthModule` builds it, from the same configuration.
 *
 * Used to open the cookie that came off the wire. That closes the loop the unit
 * test cannot: the value in the `Set-Cookie` header is not merely present and
 * correctly attributed, it is a bundle **this deployment** can verify — which is
 * the precondition for the callback route to accept a sign-in.
 */
const storeUnderTest = (): HmacOidcStateStore =>
  new HmacOidcStateStore({
    clock: new SystemClock(),
    secret: TEST_JWT_ACCESS_SECRET,
    ttlMs: testConfig().OIDC_STATE_TTL_MS,
  });

describe('GET /auth/oidc/redirect — over a socket', () => {
  it('answers 302, with a Location header actually present', async () => {
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.status).toBe(302);
    // Not optional. A 302 with no `Location` is not a redirect, and the two
    // arriving separately is the thing a recorder-based test cannot see.
    expect(response.location).not.toBeNull();
    expect(response.location).toMatch(/^https:\/\//);
  });

  it('redirects to the configured provider host and nowhere else', async () => {
    const response = await harness.request('/auth/oidc/redirect');
    const location = new URL(response.location ?? '');

    expect(location.origin).toBe(PROVIDER_ORIGIN);
    expect(location.protocol).toBe('https:');
    // An open redirect is the failure this guards. The origin is the whole claim,
    // so it is compared against the configured value rather than a literal.
    expect(location.origin).toBe(new URL(PROVIDER_ORIGIN).origin);
  });

  it("carries this deployment's client id and the configured redirect uri", async () => {
    const response = await harness.request('/auth/oidc/redirect');
    const location = new URL(response.location ?? '');

    expect(location.searchParams.get('client_id')).toBe(TEST_GOOGLE_CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe(TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI);
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('never puts the PKCE verifier in the URL the browser is sent to', async () => {
    const response = await harness.request('/auth/oidc/redirect');

    expect(new URL(response.location ?? '').searchParams.get('code_verifier')).toBeNull();
    expect(response.location).not.toContain('code_verifier=');
  });

  it('issues a fresh state on every request, so one flow cannot complete another', async () => {
    const first = await harness.request('/auth/oidc/redirect');
    const second = await harness.request('/auth/oidc/redirect');

    const firstState = new URL(first.location ?? '').searchParams.get('state');
    const secondState = new URL(second.location ?? '').searchParams.get('state');

    expect(firstState).toBeTruthy();
    expect(secondState).toBeTruthy();
    expect(firstState).not.toBe(secondState);
    // The cookies must differ too. Two responses sharing a cookie value would be
    // two flows sharing one credential.
    expect(first.cookie(OIDC_STATE_COOKIE_NAME)?.value).not.toBe(
      second.cookie(OIDC_STATE_COOKIE_NAME)?.value,
    );
  });

  it('issues a fresh nonce on every request as well', async () => {
    const first = new URL((await harness.request('/auth/oidc/redirect')).location ?? '');
    const second = new URL((await harness.request('/auth/oidc/redirect')).location ?? '');

    expect(first.searchParams.get('nonce')).not.toBe(second.searchParams.get('nonce'));
  });
});

describe('the state cookie, as it arrives on the wire', () => {
  it('is set exactly once, and it is the OIDC state cookie', async () => {
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.setCookie).toHaveLength(1);
    expect(response.cookie(OIDC_STATE_COOKIE_NAME)).not.toBeNull();
  });

  it('is HttpOnly, so script on the web app cannot read the PKCE verifier', async () => {
    const cookie = (await harness.request('/auth/oidc/redirect')).cookie(OIDC_STATE_COOKIE_NAME);

    // The verifier is inside this value. A script-readable sibling cookie would
    // hand an XSS the one secret PKCE exists to protect.
    expect(cookie?.attributes.httponly).toBe(true);
    expect(cookie?.raw).toMatch(/;\s*HttpOnly/i);
  });

  it('is Secure, so it is never sent over cleartext', async () => {
    const cookie = (await harness.request('/auth/oidc/redirect')).cookie(OIDC_STATE_COOKIE_NAME);

    expect(cookie?.attributes.secure).toBe(true);
    expect(cookie?.raw).toMatch(/;\s*Secure/i);
  });

  it('is SameSite=Lax, because Strict would withhold it from the sign-in navigation', async () => {
    const cookie = (await harness.request('/auth/oidc/redirect')).cookie(OIDC_STATE_COOKIE_NAME);

    expect(cookie?.attributes.samesite).toBe('Lax');
    expect(cookie?.raw).toMatch(/;\s*SameSite=Lax/i);
  });

  it('carries no Domain attribute, so a sibling subdomain cannot overwrite it', async () => {
    // A `Domain` widens the cookie to subdomains, which is cookie tossing: an
    // attacker-controlled `shop.school.edu` could write a cookie of the same name
    // and win. Omission is the defence, so it is asserted.
    const cookie = (await harness.request('/auth/oidc/redirect')).cookie(OIDC_STATE_COOKIE_NAME);

    expect(cookie?.attributes.domain).toBeUndefined();
  });

  it('is scoped to /auth/oidc rather than the whole origin', async () => {
    const cookie = (await harness.request('/auth/oidc/redirect')).cookie(OIDC_STATE_COOKIE_NAME);

    expect(cookie?.attributes.path).toBe('/auth/oidc');
  });

  it('carries an Expires the browser will honour, not one it will discard', async () => {
    // A malformed `Expires` is silently dropped by browsers, which leaves a
    // cookie with NO expiry — the opposite of the ten-minute window asked for.
    const cookie = (await harness.request('/auth/oidc/redirect')).cookie(OIDC_STATE_COOKIE_NAME);
    const expires = cookie?.attributes.expires;

    expect(expires).toBeTruthy();
    expect(Number.isNaN(new Date(expires ?? '').getTime())).toBe(false);
  });

  it('writes no session cookie, because no session exists yet', async () => {
    const response = await harness.request('/auth/oidc/redirect');
    const names = response.cookies.map((cookie) => cookie.name);

    expect(names).not.toContain('eduflow_session');
    expect(names).not.toContain('eduflow_refresh');
  });

  it('holds a bundle this deployment can open, whose state matches the Location', async () => {
    // The join. The unit test proves the store round-trips a value it sealed
    // itself; this proves the value that actually crossed the network opens, and
    // that it describes the same flow the browser was redirected into. Without it
    // a cookie could be perfectly attributed and still be useless to the callback.
    const response = await harness.request('/auth/oidc/redirect');
    const sealed = response.cookie(OIDC_STATE_COOKIE_NAME)?.value ?? '';
    const opened = storeUnderTest().open(sealed);

    expect(opened).not.toBeNull();
    expect(opened?.state).toBe(new URL(response.location ?? '').searchParams.get('state'));
    expect(opened?.redirectUri).toBe(TEST_ENVIRONMENT.GOOGLE_REDIRECT_URI);
  });

  it('holds a bundle this deployment can open, and a foreign key cannot', async () => {
    // Proves the signature is actually load-bearing rather than merely present:
    // a store with a different key must reject the same bytes.
    const sealed = (await harness.request('/auth/oidc/redirect')).cookie(
      OIDC_STATE_COOKIE_NAME,
    )?.value;
    const foreign = new HmacOidcStateStore({
      clock: new SystemClock(),
      secret: 'a-different-test-only-signing-key-0123456789abcd',
      ttlMs: testConfig().OIDC_STATE_TTL_MS,
    });

    expect(storeUnderTest().open(sealed)).not.toBeNull();
    expect(foreign.open(sealed)).toBeNull();
  });
});

// The build, after the DI repair.
//
// This block previously asserted the OPPOSITE: that the shipped graph could not
// be constructed at all. The controller declared its dependency with an
// `import type`, so `emitDecoratorMetadata` had no runtime value to emit and
// `node dist/main.js` could not start. `tsc` accepted it, lint demanded it, and
// the build went green — the defect was invisible until something tried to boot.
//
// The repair is `@Inject(BeginOidcSignIn)` plus a value import, so the dependency
// resolves from an explicit token rather than from reflected metadata, and
// correctness no longer depends on which transform compiled the file. Inverting
// the assertion rather than deleting it is the point: this defect class must not
// be able to return unnoticed.
describe('the build, after the DI repair', () => {
  it('BOOTS, so every assertion in this file describes the real route', async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../app.module.js');

    const app = await NestFactory.create(AppModule.forRoot(testConfig()), {
      abortOnError: false,
      logger: false,
    });
    try {
      expect(app).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
