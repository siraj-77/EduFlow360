import { describe, expect, it } from 'vitest';
import { GoogleOidcProvider } from '../infrastructure/adapters/google-oidc-provider.js';
import { HmacOidcStateStore } from '../infrastructure/adapters/oidc-state-store.js';
import { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';
import { FakeClock } from '../../../testing/fake-clock.js';
import { OidcSignInController } from './oidc-sign-in.controller.js';

/**
 * `GET /auth/oidc/redirect`, driven as far as this repository can honestly
 * drive it.
 *
 * ## What is NOT here, and why
 *
 * **There is no HTTP test.** `apps/api` has no HTTP harness — no supertest, no
 * `getHttpServer()` fixture — and inventing one is a separate piece of work with
 * its own failure modes. So nothing below claims the route works over a socket.
 *
 * What these tests *do* claim, and can support: the handler, wired to the real
 * use-case, the real provider, the real signing store and the real cookie
 * carrier, produces the right status, the right `Location` and the right cookie
 * when handed a response that records what was written to it. The response is a
 * three-method recorder, exactly as `express-cookie-carrier.spec.ts` already
 * treats Express's response — it is the framework boundary, and faking it is
 * faking the thing under test rather than the thing around it.
 *
 * ## The assertion that is structural, and is
 *
 * `begin.length === 1` below is a deliberate shape check, not a proxy for one.
 * The parameter it does *not* have is the whole point of the handler: a redirect
 * route that reads `?state=` from the caller is an open redirect, and the
 * cheapest defence is for there to be no way to ask.
 */

const ORIGIN = 'https://accounts.google.com';
const NOW = '2026-10-02T09:00:00.000Z';
const TTL = 600_000;
const SECRET = 'localdev-test-signing-key-0123456789';
const REDIRECT_URI = 'http://localhost:3001/auth/oidc/callback';

/** What was written to the response, in order. */
interface Recorded {
  readonly cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>;
  readonly redirects: Array<{ status: number; url: string }>;
}

/** A response that records instead of answering. Not a mock of our own code. */
function recordingResponse(): Recorded & {
  cookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options: Record<string, unknown>): unknown;
  redirect(status: number, url: string): unknown;
} {
  const record: Recorded = { cookies: [], redirects: [] };
  return {
    ...record,
    cookie(name, value, options) {
      record.cookies.push({ name, value, options });
      return undefined;
    },
    clearCookie() {
      return undefined;
    },
    redirect(status, url) {
      record.redirects.push({ status, url });
      return undefined;
    },
  };
}

/** A controller wired to production collaborators, with only the clock doubled. */
function controllerUnderTest(): { controller: OidcSignInController; store: HmacOidcStateStore } {
  const store = new HmacOidcStateStore({ clock: new FakeClock(NOW), secret: SECRET, ttlMs: TTL });
  const provider = new GoogleOidcProvider({
    clientId: 'test-client-id.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    redirectUri: REDIRECT_URI,
  });

  return {
    controller: new OidcSignInController(new BeginOidcSignIn(provider, store, ORIGIN)),
    store,
  };
}

describe('OidcSignInController — GET /auth/oidc/redirect', () => {
  it('answers 302 to the provider, not to anywhere else', async () => {
    const { controller } = controllerUnderTest();
    const response = recordingResponse();

    await controller.begin(response);

    expect(response.redirects).toHaveLength(1);
    expect(response.redirects[0]?.status).toBe(302);

    const location = new URL(response.redirects[0]?.url ?? '');
    expect(location.origin).toBe(ORIGIN);
    expect(location.protocol).toBe('https:');
  });

  it('sets exactly one cookie, and it is the OIDC state cookie', async () => {
    const { controller } = controllerUnderTest();
    const response = recordingResponse();

    await controller.begin(response);

    // Exactly one, and named. A second cookie here would mean the session
    // credential is being written by a route that must not have one yet.
    expect(response.cookies).toHaveLength(1);
    expect(response.cookies[0]?.name).toBe('eduflow_oidc_state');
  });

  it('writes the state cookie with the attributes the store decided', async () => {
    const { controller } = controllerUnderTest();
    const response = recordingResponse();

    await controller.begin(response);

    // The carrier translates; it does not decide. `httpOnly` and `sameSite` are
    // the ones that matter: script-readable would hand an XSS the PKCE verifier,
    // and `Strict` would withhold the cookie from the navigation that completes
    // the sign-in.
    expect(response.cookies[0]?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/auth/oidc',
    });
  });

  it('sends a `Location` whose state matches the cookie, so the callback can verify one flow', async () => {
    const { controller, store } = controllerUnderTest();
    const response = recordingResponse();

    await controller.begin(response);

    const sent = new URL(response.redirects[0]?.url ?? '');
    const sealed = store.open(response.cookies[0]?.value ?? '');

    expect(sealed).not.toBeNull();
    expect(sent.searchParams.get('state')).toBe(sealed?.state);
  });

  it('never puts the PKCE verifier into the Location', async () => {
    const { controller, store } = controllerUnderTest();
    const response = recordingResponse();

    await controller.begin(response);

    const location = new URL(response.redirects[0]?.url ?? '');
    expect(location.searchParams.get('code_verifier')).toBeNull();
    expect(location.href).not.toContain(
      store.open(response.cookies[0]?.value ?? '')?.codeVerifier ?? 'x',
    );
  });

  it('issues a different state on every request, so one flow can never complete another', async () => {
    const { controller, store } = controllerUnderTest();

    const first = recordingResponse();
    await controller.begin(first);
    const second = recordingResponse();
    await controller.begin(second);

    expect(store.open(first.cookies[0]?.value ?? '')?.state).not.toBe(
      store.open(second.cookies[0]?.value ?? '')?.state,
    );
  });

  it('accepts no inbound value at all — the handler has one parameter, and it is the response', () => {
    // The structural claim. A `@Query()` added here would make this fail, which
    // is the point: an open redirect should break a test rather than reach a
    // reviewer's judgement about whether the field was used safely.
    expect(OidcSignInController.prototype.begin.length).toBe(1);
  });

  it('carries @Public with a justification the decorator accepted', () => {
    // `Public('')` throws at the call site, so reaching the decorator at all is
    // the assertion: the route cannot exist with a blank reason.
    const metadata = Reflect.getMetadata(
      'eduflow:public-route',
      OidcSignInController.prototype.begin,
    );

    expect(metadata).toEqual({ reason: expect.stringContaining('sign-in') });
  });

  it('sets the cookie before redirecting, because a redirect can end the response', async () => {
    // Ordering is observable: once `res.redirect` has ended the response, a
    // later `Set-Cookie` is silently dropped, and the sign-in fails at the
    // callback with no state.
    const order: string[] = [];
    const response = {
      ...recordingResponse(),
      cookie: (_name: string, _value: string, _options: Record<string, unknown>) => {
        order.push('cookie');
        return undefined;
      },
      redirect: (_status: number) => {
        order.push('redirect');
        return undefined;
      },
    };

    await controllerUnderTest().controller.begin(response);

    expect(order).toEqual(['cookie', 'redirect']);
  });
});
