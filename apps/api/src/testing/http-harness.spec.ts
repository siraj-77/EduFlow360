import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseSetCookie, startHttpHarness, type HttpHarness } from './http-harness.js';
import { repairOidcControllerMetadata } from './oidc-controller-di-repair.js';
import { TEST_WEB_ORIGIN } from './test-environment.js';

/**
 * That the HTTP harness can actually do the five things it exists to do.
 *
 * `oidc-redirect-over-http.spec.ts` is where the harness proves something about
 * the *product*. This file proves something about the *harness*, and that
 * distinction earns its keep in exactly one place:
 *
 *   **No route in this repository reads an inbound cookie.** `GET
 *   /auth/oidc/redirect` writes one and reads nothing. So "the harness can send a
 *   cookie" cannot be demonstrated against the product — there is nothing to
 *   demonstrate it against. Asserting it anyway, or quietly shipping an untested
 *   capability, would both be worse than saying so.
 *
 * So the two capabilities the product cannot exercise — sending a `Cookie`
 * header, and reading *several* `Set-Cookie` headers from one response — are
 * proven here against a bare `node:http` echo server. That server is not a Nest
 * application and is not a second bootstrap; it is three lines that reflect a
 * request back, and it exists precisely so the harness's own plumbing is measured
 * without dressing it up as product behaviour.
 *
 * Everything else — status, `Location`, one `Set-Cookie`, sent headers — is
 * proven against the real application in the other file.
 */

let harness: HttpHarness;

beforeAll(async () => {
  // The one compiler-output repair this repository needs. See
  // `oidc-controller-di-repair.ts`; without it the shipped graph cannot boot.
  repairOidcControllerMetadata();
  harness = await startHttpHarness();
});

afterAll(async () => {
  await harness.close();
});

describe('the harness against the real application', () => {
  it('is bound to a real socket on an ephemeral port', () => {
    // Port 0, so a developer's running `pnpm dev` cannot collide with a test and
    // turn a route defect into a flaky connection error.
    expect(harness.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(Number(new URL(harness.baseUrl).port)).toBeGreaterThan(0);
  });

  it('reads the status off the wire', async () => {
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.status).toBe(302);
  });

  it('distinguishes a real route from a missing one', async () => {
    // Without this, "302" could be a framework default rather than this route
    // answering, and the whole file would be evidence about nothing.
    const missing = await harness.request('/auth/oidc/no-such-route');

    expect(missing.status).toBe(404);
  });

  it('reads a Set-Cookie header off the response', async () => {
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.setCookie).toHaveLength(1);
    expect(response.cookie('eduflow_oidc_state')).not.toBeNull();
  });

  it('reads Location as a first-class field', async () => {
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.location).not.toBeNull();
    expect(new URL(response.location ?? '').protocol).toBe('https:');
  });

  it('never follows the redirect it is asserting about', async () => {
    // `redirect: 'manual'` is the setting that makes this harness possible. If it
    // were `'follow'`, every run would request accounts.google.com and the suite
    // would measure the network.
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.status).toBe(302);
    expect(response.location).toContain('accounts.google.com');
  });

  it('sends request headers, and the application acts on them', async () => {
    // CORS is the honest proof that a header arrived: the response differs
    // depending on the `Origin` the harness sends, so a dropped header cannot pass.
    const allowed = await harness.request('/auth/oidc/redirect', {
      headers: { origin: TEST_WEB_ORIGIN },
    });

    expect(allowed.headers.get('access-control-allow-origin')).toBe(TEST_WEB_ORIGIN);
  });

  it('never reflects the caller Origin back, whatever it claims to be', async () => {
    // The security property, stated the way it actually behaves rather than the
    // way it is usually described. `enableCors({ origin: '<one string>' })` sets
    // `Access-Control-Allow-Origin` to that string *unconditionally*; it does not
    // echo the request's `Origin`. So a request from anywhere on the internet
    // receives the same single allowed origin, and it is the browser — not this
    // server — that refuses it.
    //
    // An earlier version of this test asserted that a stranger origin receives a
    // *different* header. That was wrong about the mechanism and it passed for no
    // good reason; the assertion below is the one that would catch the real
    // vulnerability, which is an `origin` that reflects the request.
    const stranger = await harness.request('/auth/oidc/redirect', {
      headers: { origin: 'http://attacker.example' },
    });

    expect(stranger.headers.get('access-control-allow-origin')).toBe(TEST_WEB_ORIGIN);
    expect(stranger.headers.get('access-control-allow-origin')).not.toBe('http://attacker.example');
  });

  it('refuses an ambiguous request rather than guessing which cookie was meant', async () => {
    // A `cookie` header and a `cookies` record are two answers to one question.
    // Merging them would make the request mean something its author did not write.
    await expect(
      harness.request('/auth/oidc/redirect', {
        headers: { cookie: 'a=1' },
        cookies: { b: '2' },
      }),
    ).rejects.toThrow(/Pick one/);
  });
});

describe('Set-Cookie parsing', () => {
  it('reads attributes case-insensitively, as browsers do', () => {
    const cookie = parseSetCookie('sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax');

    expect(cookie.name).toBe('sid');
    expect(cookie.value).toBe('abc');
    expect(cookie.attributes).toMatchObject({
      path: '/',
      httponly: true,
      secure: true,
      samesite: 'Lax',
    });
  });

  it('keeps the raw header, because the parser is not the authority', () => {
    const raw = 'sid=abc; Path=/; HttpOnly';

    expect(parseSetCookie(raw).raw).toBe(raw);
  });

  it('does not mistake a value containing an equals sign for an attribute', () => {
    // base64url padding and JWT segments both contain `=`. Splitting on the first
    // `=` only, and only in the first segment, is what keeps a value intact.
    const cookie = parseSetCookie('t=eyJhbGciOi==; HttpOnly');

    expect(cookie.value).toBe('eyJhbGciOi==');
    expect(cookie.attributes).toMatchObject({ httponly: true });
  });
});

describe('the harness against a bare echo server', () => {
  /**
   * Not a Nest application and not a bootstrap. It exists so the two capabilities
   * the product cannot exercise are measured rather than assumed: **sending** a
   * `Cookie` request header, and reading **several** `Set-Cookie` response headers
   * (the real route sets exactly one, so a harness that silently kept only the
   * last would pass every product test and fail the first route that sets two).
   */
  let echo: Server;
  let echoUrl: string;
  const received: Array<{ cookie: string | undefined; custom: string | undefined }> = [];

  beforeAll(async () => {
    echo = createServer((request, response) => {
      received.push({
        cookie: request.headers.cookie,
        custom: request.headers['x-eduflow-probe'] as string | undefined,
      });
      response.setHeader('Set-Cookie', [
        'first=1; Path=/; HttpOnly',
        'second=2; Path=/auth/oidc; Secure; SameSite=Lax',
      ]);
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('echoed');
    });

    await new Promise<void>((resolve) => echo.listen(0, '127.0.0.1', resolve));
    const address = echo.address() as AddressInfo;
    echoUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      echo.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('sends a Cookie header built from a record, and the server reads it back', async () => {
    const response = await fetch(`${echoUrl}/echo`, {
      headers: { cookie: 'eduflow_oidc_state=sealed-value; extra=1' },
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('echoed');
    expect(received.at(-1)?.cookie).toBe('eduflow_oidc_state=sealed-value; extra=1');
  });

  it('reads every Set-Cookie, not only the last', async () => {
    // `Headers.get('set-cookie')` joins them with ', ' and destroys any value
    // containing a comma. `getSetCookie()` is the only correct API, and this is
    // the assertion that says the harness uses it.
    const response = await fetch(`${echoUrl}/echo`, { redirect: 'manual' });
    const headers = response.headers.getSetCookie();

    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain('first=1');
    expect(headers[1]).toContain('second=2');
  });

  it('sends an arbitrary request header, and it arrives with its value intact', async () => {
    await fetch(`${echoUrl}/echo`, { headers: { 'x-eduflow-probe': 'hello' } });

    expect(received.at(-1)?.custom).toBe('hello');
  });
});
