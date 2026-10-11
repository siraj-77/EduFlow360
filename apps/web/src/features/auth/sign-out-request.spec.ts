import { describe, expect, it, vi } from 'vitest';
import {
  SIGN_OUT_PATH,
  buildSignOutRequest,
  classifySignOutResponse,
  sendSignOut,
  signOutEndpoint,
} from './sign-out-request';

/**
 * The sign-out wire contract, as pure functions (`PLT-105`).
 *
 * ## The assertion that matters most
 *
 * `routes through apiUrl, so no call site can name a path the API does not serve`.
 * That is the test whose absence let sign-out break in production: the handler
 * used to call `fetch('/auth/sign-out')` directly, which the browser resolved
 * against the web app's own origin. The request 404'd on Next.js, the response
 * was ignored, and the user was told they had signed out while their session
 * stayed live.
 *
 * The second family of assertions is the classifier. Only `signedOut` may
 * leave the authenticated area, because it is the only outcome that means the
 * session is actually ended — `POST /auth/sign-out` is idempotent, so a dead
 * cookie also answers 200, which is what makes that outcome safe to act on.
 */

describe('signOutEndpoint', () => {
  it('routes through apiUrl, so no call site can name a path the API does not serve', () => {
    // The regression assertion. A root-relative path is the whole defect: it
    // resolves against the web app, so the request never reaches the API.
    expect(signOutEndpoint('http://localhost:3001')).toBe('http://localhost:3001' + SIGN_OUT_PATH);

    // The production shape is same-origin behind a reverse proxy, and the
    // contract must work there too rather than only where it is easy to see.
    expect(signOutEndpoint('/api')).toBe('/api' + SIGN_OUT_PATH);
  });

  it('never collapses the base and the path into a double slash', () => {
    // A double slash is a different path to most routers, and a 404 that
    // reads like an API bug rather than a client one.
    expect(signOutEndpoint('/api/')).toBe('/api' + SIGN_OUT_PATH);
    expect(signOutEndpoint('http://localhost:3001/')).toBe('http://localhost:3001' + SIGN_OUT_PATH);
  });
});

describe('classifySignOutResponse', () => {
  it('answers signedOut on 200, the only outcome that means the session is ended', () => {
    expect(classifySignOutResponse(200)).toEqual({ kind: 'signedOut' });
  });

  it('answers csrf on 403, because a POST behind CsrfGuard that never arrived revoked nothing', () => {
    // The refusal branch the old code redirected through. The guard runs
    // before the controller, so nothing was revoked and the session is live.
    expect(classifySignOutResponse(403)).toEqual({ kind: 'csrf' });
  });

  it('answers network when the request never got an answer', () => {
    expect(classifySignOutResponse(null)).toEqual({ kind: 'network' });
  });

  it('answers unexpected for every other status, including a 404 from the wrong origin', () => {
    // 404 is the shape the defect actually produced: Next.js answering for a
    // path it does not serve. It must not read as a success.
    expect(classifySignOutResponse(404)).toEqual({ kind: 'unexpected' });
    expect(classifySignOutResponse(500)).toEqual({ kind: 'unexpected' });
    expect(classifySignOutResponse(302)).toEqual({ kind: 'unexpected' });
  });
});

describe('buildSignOutRequest', () => {
  it('is a POST carrying the CSRF header, because CsrfGuard refuses every POST without it', () => {
    const init = buildSignOutRequest();
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe('POST');
    expect(headers['x-eduflow-csrf']).toBeTruthy();
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
  });

  it('sends the session cookie, because it is the credential being revoked', () => {
    expect(buildSignOutRequest().credentials).toBe('include');
  });

  it('sends an empty body, which is all the DTO accepts', () => {
    expect(buildSignOutRequest().body).toBe('{}');
  });
});

describe('sendSignOut', () => {
  it('calls the API origin and not this app own', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await sendSignOut('http://localhost:3001');

    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://localhost:3001' + SIGN_OUT_PATH);

    fetchSpy.mockRestore();
  });

  it('reanswers network instead of throwing when fetch rejects', async () => {
    // The old handler had no catch at all: a network failure escaped as an
    // unhandled rejection and left the screen stuck on "Signing out…".
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(sendSignOut('http://localhost:3001')).resolves.toEqual({ kind: 'network' });

    fetchSpy.mockRestore();
  });
});
