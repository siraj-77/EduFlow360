import { describe, expect, it, vi } from 'vitest';
import type { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';
import {
  UnlinkableAccountError,
  UntrustedAuthorizationUrlError,
} from '../use-cases/begin-oidc-sign-in.js';
import {
  OIDC_STATE_COOKIE_NAME,
  OIDC_STATE_COOKIE_PATH,
} from '../domain/ports/oidc-state-store.js';
import { OidcLinkController } from './oidc-link.controller.js';

/**
 * `GET /auth/oidc/link` — the handler.
 *
 * ## Why a unit spec when `oidc-callback-over-http.integration.spec.ts` exists
 *
 * Two reasons, and the second is mechanical.
 *
 * 1. The `Set-Cookie` the browser receives is proved over a real socket there — a
 *    recorder here could not prove that. Nothing in this file supersedes it.
 * 2. `AGENTS.md` §4 makes every `*.controller.ts` a 70%-lines coverage tier, and a
 *    controller with no unit spec counts as uncovered source. A tier that is met only
 *    by an integration suite is a tier the unit gate cannot see, because the unit
 *    config excludes `*.integration.spec.ts` by design.
 *
 * ## What is real and what is not
 *
 * **Real:** the handler body, the decorators' effect on the metadata Nest reads, and
 * `HmacOidcStateStore` — no, the store is a double here. The claim is about what the
 * handler does with a principal and a response, and both are better supplied by
 * hand-written objects than by a real store whose output this test would then have
 * to re-derive.
 */

const USER_ID = '2f6a1d0c-8e4b-4a1e-9c2f-3d4e5f6a7b8c';
const SESSION_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const REDIRECT_TO = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x';

/** A state cookie shaped exactly as the store produces one. */
const stateCookie = (path: string = OIDC_STATE_COOKIE_PATH) => ({
  name: OIDC_STATE_COOKIE_NAME,
  value: 'payload.signature',
  attributes: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path,
    expiresAt: new Date('2026-10-03T09:10:00.000Z'),
  },
});

const recorded = () => {
  const cookies: Array<{ name: string; value: string }> = [];
  const redirects: Array<[number, string]> = [];

  return {
    cookies,
    redirects,
    response: {
      cookie: (name: string, value: string): void => {
        cookies.push({ name, value });
      },
      clearCookie: (): void => undefined,
      redirect: (status: number, url: string): void => {
        redirects.push([status, url]);
      },
    },
  };
};

/** A `BeginOidcSignIn` that answers with `result`, and records what it was asked. */
const useCase = (
  result: { redirectTo: string; stateCookie: ReturnType<typeof stateCookie> } | Error,
): { begin: ReturnType<typeof vi.fn>; beginLink: ReturnType<typeof vi.fn> } => {
  const begin = vi.fn(async () => {
    throw new Error('begin must not be called on the link route');
  });
  const beginLink = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });

  const instance = { begin, beginLink } as unknown as BeginOidcSignIn;
  void instance;

  return { begin, beginLink };
};

const controller = (beginLink: ReturnType<typeof vi.fn>): OidcLinkController =>
  new OidcLinkController({ beginLink } as unknown as BeginOidcSignIn);

const request = (overrides?: { principal?: unknown }): unknown => ({
  ...(overrides?.principal === undefined ? {} : { principal: overrides.principal }),
});

describe('GET /auth/oidc/link — the handler', () => {
  it('redirects 302 to the provider and writes the state cookie', async () => {
    const { beginLink } = useCase({ redirectTo: REDIRECT_TO, stateCookie: stateCookie() });
    const sink = recorded();

    await controller(beginLink).link(
      request({ principal: { sessionId: SESSION_ID, userId: USER_ID } }) as never,
      sink.response as never,
    );

    expect(sink.redirects).toEqual([[302, REDIRECT_TO]]);
    expect(sink.cookies).toEqual([{ name: OIDC_STATE_COOKIE_NAME, value: 'payload.signature' }]);
  });

  it('begins a LINK flow bound to the principal the guard attached', async () => {
    const { beginLink } = useCase({ redirectTo: REDIRECT_TO, stateCookie: stateCookie() });
    const sink = recorded();

    await controller(beginLink).link(
      request({ principal: { sessionId: SESSION_ID, userId: USER_ID } }) as never,
      sink.response as never,
    );

    expect(beginLink).toHaveBeenCalledWith(USER_ID);
    // And the session id is NOT passed: the flow is bound to the ACCOUNT, and the
    // bundle carries no session reference.
    expect(beginLink.mock.calls[0]).toEqual([USER_ID]);
  });

  it('never begins a plain sign-in flow', async () => {
    const { begin, beginLink } = useCase({ redirectTo: REDIRECT_TO, stateCookie: stateCookie() });
    const sink = recorded();

    await controller(beginLink).link(
      request({ principal: { sessionId: SESSION_ID, userId: USER_ID } }) as never,
      sink.response as never,
    );

    expect(begin).not.toHaveBeenCalled();
  });

  it('throws rather than proceeding when the guard attached no principal', async () => {
    // The wiring-fault path. Without it a missing principal would be `undefined` and
    // `beginLink(undefined)` would seal a link bundle with no account — which
    // `BeginOidcSignIn` refuses, but only because this handler failed to check.
    const { beginLink } = useCase({ redirectTo: REDIRECT_TO, stateCookie: stateCookie() });
    const sink = recorded();

    await expect(
      controller(beginLink).link(request() as never, sink.response as never),
    ).rejects.toThrow(/principal/i);
    expect(beginLink).not.toHaveBeenCalled();
    expect(sink.redirects).toEqual([]);
    expect(sink.cookies).toEqual([]);
  });

  it('refuses a state cookie scoped to a path that cannot reach the callback', async () => {
    // Unreachable unless a store change moved the path without moving the callback.
    // Asserted because the failure it prevents is a sign-in that starts and then
    // silently never completes, with nothing in the logs to explain it.
    const { beginLink } = useCase({
      redirectTo: REDIRECT_TO,
      stateCookie: stateCookie('/somewhere-else'),
    });
    const sink = recorded();

    await expect(
      controller(beginLink).link(
        request({ principal: { sessionId: SESSION_ID, userId: USER_ID } }) as never,
        sink.response as never,
      ),
    ).rejects.toThrow(/auth\/oidc\/callback/);

    expect(sink.redirects).toEqual([]);
    expect(sink.cookies).toEqual([]);
  });

  it('propagates an untrusted-redirect refusal rather than redirecting anyway', async () => {
    const { beginLink } = useCase(
      new UntrustedAuthorizationUrlError('Refusing to redirect: not the configured origin.'),
    );
    const sink = recorded();

    await expect(
      controller(beginLink).link(
        request({ principal: { sessionId: SESSION_ID, userId: USER_ID } }) as never,
        sink.response as never,
      ),
    ).rejects.toThrow(UntrustedAuthorizationUrlError);

    expect(sink.redirects).toEqual([]);
  });

  it('propagates a refusal to begin a link with no account', async () => {
    const { beginLink } = useCase(new UnlinkableAccountError('Refusing to begin a link flow.'));
    const sink = recorded();

    await expect(
      controller(beginLink).link(
        request({ principal: { sessionId: SESSION_ID, userId: '' } }) as never,
        sink.response as never,
      ),
    ).rejects.toThrow(UnlinkableAccountError);
  });
});

describe('GET /auth/oidc/link — the decorators', () => {
  it('is NOT marked @Public, because that is what exempts a route from SessionGuard', () => {
    // The load-bearing structural property of the whole design. `@Public` is not
    // cosmetic here: `SessionGuard` honours it, so adding it would remove the
    // authentication from a link endpoint.
    //
    // Asserted by reading the metadata Nest reads, not by reading the source text —
    // grepping for a decorator proves the source contains a string.
    const metadata = Reflect.getMetadata('eduflow:public-route', OidcLinkController.prototype.link);

    expect(metadata).toBeUndefined();
  });

  it('carries a permission key, so `check-route-guards` does not call it unguarded', () => {
    const permission = Reflect.getMetadata('eduflow:permission', OidcLinkController.prototype.link);

    expect(typeof permission).toBe('string');
    expect(permission).toBe('AUTH_LINK_EXTERNAL_IDENTITY');
  });

  it('carries an audit key, because linking an identity is a sensitive action', () => {
    expect(Reflect.getMetadata('eduflow:audit', OidcLinkController.prototype.link)).toBe(
      'OIDC_LINK',
    );
  });
});
