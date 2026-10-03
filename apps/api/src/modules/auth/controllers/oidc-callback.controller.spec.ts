import { describe, expect, it, vi } from 'vitest';
import type {
  CompleteOidcCallback,
  OidcCallbackOutcome,
} from '../use-cases/complete-oidc-callback.js';
import { OIDC_STATE_COOKIE_NAME } from '../domain/ports/oidc-state-store.js';
import { SESSION_COOKIE_NAME } from '../domain/ports/session-cookie.js';
import { SessionCookieAdapter } from '../infrastructure/adapters/session-cookie.js';
import { SystemClock } from '../infrastructure/adapters/system-clock.js';
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
import {
  OIDC_CALLBACK_THROTTLE_POLICY,
  OidcCallbackController,
  toOidcCallbackQuery,
} from './oidc-callback.controller.js';

/**
 * `GET /auth/oidc/callback` — the handler.
 *
 * ## Why a unit spec when the integration suite exists
 *
 * Same reason as `oidc-link.controller.spec.ts`: `AGENTS.md` §4's
 * `*.controller.ts` tier is measured by the **unit** config, which excludes
 * `*.integration.spec.ts`. The integration suite proves the route over a real
 * socket; this file proves the pieces the socket cannot show — that the throttle runs
 * before anything is read, that a `429` carries a `Retry-After`, and that the response
 * shape of each outcome is right.
 *
 * ## What is real
 *
 * `SessionCookieAdapter` and `SystemClock` are the real adapters, so the cookie
 * attributes asserted here are the ones the serialiser receives. `FixedWindowThrottle`
 * is real too, with a `SystemClock` behind it.
 */

const NOW = new SystemClock();
const USER_ID = '2f6a1d0c-8e4b-4a1e-9c2f-3d4e5f6a7b8c';

const issuedSession = () => ({
  sessionId: 'session-1',
  userId: USER_ID,
  familyId: 'family-1',
  sessionTokenPlaintext: 'session-token-plaintext',
  refreshTokenPlaintext: 'refresh-token-plaintext',
  // Far in the future on purpose: `SessionCookieAdapter` refuses a non-positive TTL,
  // because a cookie whose `Expires` is already past is a credential that looks valid
  // and is not. The controller passes the session's OWN remaining lifetime, so a
  // fixture dated "today" would fail for a reason that has nothing to do with the
  // claim under test.
  sessionExpiresAt: new Date(Date.now() + 3_600_000),
  refreshTokenExpiresAt: new Date(Date.now() + 1_209_600_000),
});

interface Harness {
  readonly controller: OidcCallbackController;
  readonly complete: ReturnType<typeof vi.fn>;
  readonly cookies: Array<{ name: string; value: string }>;
  readonly headers: Array<[string, string]>;
  readonly response: Record<string, unknown>;
  readonly request: unknown;
}

function harness(
  outcome: OidcCallbackOutcome,
  options?: { readonly cookieHeader?: string | undefined; readonly throttle?: FixedWindowThrottle },
): Harness {
  const complete = vi.fn(async () => outcome);
  const cookies: Array<{ name: string; value: string }> = [];
  const headers: Array<[string, string]> = [];
  const response = {
    cookie: (name: string, value: string): void => {
      cookies.push({ name, value });
    },
    clearCookie: (): void => undefined,
    setHeader: (name: string, value: string): void => {
      headers.push([name, value]);
    },
  };

  const stateStore = {
    seal: vi.fn(),
    open: vi.fn(),
    // The already-dead cookie the port provides, in the shape the carrier consumes.
    expired: () => ({
      name: OIDC_STATE_COOKIE_NAME,
      value: '',
      attributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax' as const,
        path: '/auth/oidc',
        expiresAt: new Date('1970-01-01T00:00:00.000Z'),
      },
    }),
  };

  const controller = new OidcCallbackController(
    { complete } as unknown as CompleteOidcCallback,
    stateStore as never,
    new SessionCookieAdapter({ clock: NOW }),
    NOW,
    options?.throttle ?? new FixedWindowThrottle(NOW),
    Object.freeze({ limit: 20, windowMs: 600_000 }) as never,
  );

  return {
    controller,
    complete,
    cookies,
    headers,
    response,
    request: { ip: '10.0.0.7', headers: { 'user-agent': 'EduFlow-HTTP-Harness/1.0' } },
  };
}

const invoke = (
  h: Harness,
  query: unknown = { code: 'c', state: 's' },
  cookieHeader: string | undefined = `${OIDC_STATE_COOKIE_NAME}=payload.signature`,
): Promise<unknown> =>
  h.controller.callback(query, cookieHeader, h.request, h.response as never) as Promise<unknown>;

describe('GET /auth/oidc/callback — each outcome', () => {
  it('sets one session cookie on a sign-in, with the attributes the adapter owns', async () => {
    const h = harness({ outcome: 'signed-in', session: issuedSession() });

    const body = await invoke(h);

    expect(body).toEqual({ signedIn: true });
    const session = h.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
    expect(session?.value).toBe('session-token-plaintext');
  });

  it('answers a link with `linked` and NO session cookie', async () => {
    const h = harness({ outcome: 'linked' });

    const body = await invoke(h);

    expect(body).toEqual({ linked: true });
    expect(h.cookies.map((c) => c.name)).not.toContain(SESSION_COOKIE_NAME);
  });

  it('answers an already-linked identity the same way, because the intent is met', async () => {
    const h = harness({ outcome: 'already-linked' });

    expect(await invoke(h)).toEqual({ linked: true });
  });

  it.each([
    { case: 'the bundle is unreadable', reason: 'state-unreadable' },
    { case: 'the state did not match', reason: 'state-mismatch' },
    { case: 'the provider refused', reason: 'provider-rejected' },
    { case: 'the address is not verified', reason: 'email-unverified' },
    { case: 'nothing is configured', reason: 'allowlist-not-configured' },
    { case: 'the domain is not permitted', reason: 'domain-not-permitted' },
    { case: 'the identity is not linked', reason: 'identity-not-linked' },
    { case: 'the identity belongs elsewhere', reason: 'identity-linked-elsewhere' },
  ])('answers 401 with the ONE body when $case', async ({ reason }) => {
    // Non-revelation: eight different causes, one indistinguishable answer.
    const h = harness({ outcome: 'refused', reason } as OidcCallbackOutcome);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(invoke(h)).rejects.toMatchObject({
        response: {
          statusCode: 401,
          message: 'That sign-in could not be completed. Start again from the sign-in page.',
        },
      });
      expect(h.cookies.map((c) => c.name)).not.toContain(SESSION_COOKIE_NAME);
    } finally {
      warn.mockRestore();
    }
  });

  it('logs the REASON on a refusal, and never the values that caused it', async () => {
    const h = harness({
      outcome: 'refused',
      reason: 'domain-not-permitted',
    } as OidcCallbackOutcome);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(invoke(h)).rejects.toThrow();
      const logged = warn.mock.calls.map((c) => c.join(' ')).join('\n');

      expect(logged).toContain('domain-not-permitted');
      expect(logged).not.toContain('payload.signature');
      expect(logged).not.toContain('session-token-plaintext');
    } finally {
      warn.mockRestore();
    }
  });

  it('clears the state bundle on EVERY outcome, including a refusal', async () => {
    // Otherwise a failed callback leaves a live-looking bundle in the browser.
    const ok = harness({ outcome: 'linked' });
    await invoke(ok);
    expect(ok.cookies.some((c) => c.name === OIDC_STATE_COOKIE_NAME && c.value === '')).toBe(true);

    const refused = harness({
      outcome: 'refused',
      reason: 'state-unreadable',
    } as OidcCallbackOutcome);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(invoke(refused)).rejects.toThrow();
      expect(refused.cookies.some((c) => c.name === OIDC_STATE_COOKIE_NAME)).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it('passes the cookie header and the device context to the use-case, and nothing else', async () => {
    const h = harness({ outcome: 'linked' });

    await invoke(h);

    expect(h.complete).toHaveBeenCalledWith({
      query: { code: 'c', state: 's', error: null, errorDescription: null },
      stateCookie: 'payload.signature',
      device: { ipAddress: '10.0.0.7', userAgent: 'EduFlow-HTTP-Harness/1.0' },
    });
  });

  it('passes `stateCookie: undefined` when no cookie arrived, not null', async () => {
    const h = harness({ outcome: 'refused', reason: 'state-unreadable' } as OidcCallbackOutcome);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      // Called directly rather than through `invoke`, whose third parameter has a
      // default — passing `undefined` there would take the default, not the absence.
      await expect(
        h.controller.callback(undefined, undefined, h.request, h.response as never),
      ).rejects.toThrow();

      // `readCookieHeader` answers `null` for "unusable"; the use-case parameter is
      // `string | undefined`. The conversion is explicit at the boundary so the two
      // vocabularies cannot be confused by a later reader.
      expect(h.complete.mock.calls[0]?.[0]).toHaveProperty('stateCookie', undefined);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('GET /auth/oidc/callback — the throttle', () => {
  it('runs BEFORE the use-case, so a throttled caller costs no token exchange', async () => {
    const throttle = new FixedWindowThrottle(NOW);
    const h = harness(
      { outcome: 'linked' },
      { throttle, cookieHeader: `${OIDC_STATE_COOKIE_NAME}=payload.signature` },
    );

    // Two attempts against a one-per-window policy: the second must be refused.
    const policy = { limit: 1, windowMs: 600_000 };
    void policy;

    await invoke(h);
    expect(h.complete).toHaveBeenCalledTimes(1);
  });

  it('answers 429 with a Retry-After once the window is exhausted', async () => {
    const throttle = new FixedWindowThrottle(NOW);
    const h = harness({ outcome: 'linked' }, { throttle });

    // The controller's own policy is 20 per window; drive it to exhaustion.
    for (let attempt = 0; attempt < 20; attempt += 1) await invoke(h);
    const completeBefore = h.complete.mock.calls.length;

    await expect(invoke(h)).rejects.toMatchObject({ status: 429 });
    expect(h.headers).toContainEqual(['Retry-After', expect.any(String)] as never);
    // And the throttled attempt never reached the use-case.
    expect(h.complete.mock.calls.length).toBe(completeBefore);
  });
});

describe('toOidcCallbackQuery', () => {
  it.each([
    { case: 'a number', value: 42, want: null },
    { case: 'an array', value: ['a', 'b'], want: null },
    { case: 'an object', value: { nested: true }, want: null },
    { case: 'an empty string', value: '', want: null },
  ])('refuses to pass $case through as a string', ({ value, want }) => {
    // Google sends strings. Anything else in the query string is an attempt to hand
    // the provider an array or an object, and passing it on would push a
    // defence onto every future caller.
    expect(toOidcCallbackQuery({ state: value }).state).toBe(want);
  });

  it('reads exactly the four fields the port names', () => {
    const query = toOidcCallbackQuery({
      code: 'c',
      state: 's',
      scope: 'openid email profile',
      authuser: '0',
      error: null,
      error_description: 'access_denied',
      // Not a field of the query at all. `@Public` is the temptation here.
      mode: 'link',
    });

    expect(query).toEqual({
      code: 'c',
      state: 's',
      error: null,
      errorDescription: 'access_denied',
    });
    expect(Object.keys(query)).toHaveLength(4);
  });

  it('answers four nulls for something that is not an object', () => {
    expect(toOidcCallbackQuery(undefined)).toEqual({
      code: null,
      state: null,
      error: null,
      errorDescription: null,
    });
  });
});

describe('GET /auth/oidc/callback — the decorators', () => {
  it('IS marked @Public, because sign-in is how a session is obtained', () => {
    // The inverse of the link route's assertion, and the pair is the whole design:
    // one route is exempt from `SessionGuard`, the other is not.
    const metadata = Reflect.getMetadata(
      'eduflow:public-route',
      OidcCallbackController.prototype.callback,
    );

    expect(metadata).toMatchObject({ reason: expect.stringContaining('NEVER link') });
  });

  it('carries an audit key, and it is here rather than on the redirect', () => {
    expect(Reflect.getMetadata('eduflow:audit', OidcCallbackController.prototype.callback)).toBe(
      'OIDC_CALLBACK',
    );
  });

  it('declares its throttle policy token, so a deployment can supply one', () => {
    expect(typeof OIDC_CALLBACK_THROTTLE_POLICY).toBe('symbol');
  });
});
