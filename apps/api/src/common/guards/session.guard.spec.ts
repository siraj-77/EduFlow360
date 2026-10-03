import 'reflect-metadata';
import { Get, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { Public } from './public.decorator.js';
import {
  I_SESSION_REPOSITORY,
  type ISessionRepository,
} from '../../modules/auth/domain/ports/session-repository.js';
import {
  SessionGuard,
  isPublicRoute,
  readCookieHeader,
  requirePrincipal,
  type PrincipalCarrier,
} from './session.guard.js';

/**
 * `SessionGuard` — the control that turns a cookie into a caller.
 *
 * ## Why this file exists at all
 *
 * Before it, `ISessionRepository.findByToken` existed and **nothing called it**. Only
 * `CsrfGuard` implemented `CanActivate`, so "an authenticated route" in this codebase
 * had no mechanism behind the phrase: a route with no `@Public` and no
 * `@RequirePermission` was not reachable-by-design, it was simply reachable, because
 * nothing was checking.
 *
 * ## The four rejections, and why they are one rejection
 *
 * Absent cookie, malformed cookie, unknown token and expired token must all be
 * refused. They are all *the same* refusal on the wire — `401` with one body — and
 * the reason is `AGENTS.md` 2.13 in the shape of an enumeration oracle: a guard that
 * answers "no cookie" differently from "expired cookie" tells an attacker which
 * cookies are real. Three of the four are decided here; the fourth (expiry) is
 * decided by `findByToken`, which
 * `prisma-session-repository.integration.spec.ts` proves returns `null` for a revoked
 * session, an expired session and an unknown token alike.
 */
const USER_ID = '2f6a1d0c-8e4b-4a1e-9c2f-3d4e5f6a7b8c';
const SESSION_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/**
 * A repository that answers `findByToken` from a table.
 *
 * Deliberately NOT a stub that records calls and returns a constant. The claims under
 * test are about which tokens are *accepted*, and a double that accepts everything
 * would let a guard with the wrong comparison pass.
 */
class Sessions implements ISessionRepository {
  readonly seen: string[] = [];
  constructor(private readonly known: Record<string, { sessionId: string; userId: string }>) {}

  async findByToken(token: string): Promise<{ sessionId: string; userId: string } | null> {
    this.seen.push(token);
    return this.known[token] ?? null;
  }

  async issue(): Promise<never> {
    throw new Error('not reached');
  }
  async findForRotation(): Promise<never> {
    throw new Error('not reached');
  }
  async rotate(): Promise<never> {
    throw new Error('not reached');
  }
  async revokeFamily(): Promise<never> {
    throw new Error('not reached');
  }
  async revokeSession(): Promise<never> {
    throw new Error('not reached');
  }
  async revokeExpired(): Promise<never> {
    throw new Error('not reached');
  }
}

const LIVE = 'live-session-token-000000000000';
const sessions = (): Sessions =>
  new Sessions({ [LIVE]: { sessionId: SESSION_ID, userId: USER_ID } });

/** A request carrying `cookie` and nothing else. */
const request = (
  cookie?: string,
): PrincipalCarrier & { readonly headers: Record<string, string> } => ({
  headers: cookie === undefined ? {} : { cookie },
});

const contextFor = (
  request: unknown,
  handler: (...args: never[]) => unknown,
  controller: unknown = class {},
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

// ═══════════════════════════════════════════════════════════════════════════
// `readCookieHeader` — the parsing, as a pure function.
//
// `CsrfGuard` splits its rule out the same way (`isCsrfRequestAcceptable`) and for
// the same reason: a Nest mock proves the guard called something, not that the rule
// is right.
// ═══════════════════════════════════════════════════════════════════════════
describe('readCookieHeader', () => {
  it('finds a cookie among others, which is the normal case', () => {
    expect(
      readCookieHeader('eduflow_oidc_state=abc; eduflow_session=live; other=1', 'eduflow_session'),
    ).toBe('live');
  });

  it('finds one that is first, or last, or alone', () => {
    expect(readCookieHeader('eduflow_session=live; b=2', 'eduflow_session')).toBe('live');
    expect(readCookieHeader('a=1; eduflow_session=live', 'eduflow_session')).toBe('live');
    expect(readCookieHeader('eduflow_session=live', 'eduflow_session')).toBe('live');
  });

  it('takes the FIRST of two with the same name, as a browser does', () => {
    // Two `Set-Cookie` headers for one name is a real state — a second deployment on
    // the same origin, or a proxy. Picking the second would be picking by attacker
    // preference.
    expect(
      readCookieHeader('eduflow_session=first; eduflow_session=second', 'eduflow_session'),
    ).toBe('first');
  });

  it('matches the whole name, so a prefix cannot impersonate it', () => {
    // The bug this closes: a `startsWith` scan would accept
    // `eduflow_session_forge=whatever`.
    expect(readCookieHeader('eduflow_session_forge=whatever', 'eduflow_session')).toBeNull();
    expect(readCookieHeader('xeduflow_session=whatever', 'eduflow_session')).toBeNull();
  });

  it('unwraps a quoted value, which is legal RFC 6265 and what some clients send', () => {
    expect(readCookieHeader('eduflow_session="live"', 'eduflow_session')).toBe('live');
  });

  it('keeps an `=` inside a value, splitting only on the first', () => {
    // A base64url token never contains `=`, but a *malformed* one might, and a
    // parser that splits on every `=` would hand `findByToken` a truncated string.
    expect(readCookieHeader('eduflow_session=a=b=c', 'eduflow_session')).toBe('a=b=c');
  });

  it('trims the whitespace a browser is allowed to send around separators', () => {
    expect(readCookieHeader('  eduflow_session  =  live  ;  b=2', 'eduflow_session')).toBe('live');
  });

  it.each([
    { case: 'no Cookie header at all', header: undefined },
    { case: 'an empty header', header: '' },
    { case: 'a header with no matching name', header: 'a=1; b=2' },
    { case: 'a cookie with no `=`', header: 'eduflow_session' },
    { case: 'a cookie with an empty value', header: 'eduflow_session=' },
    { case: 'an empty value after unquoting', header: 'eduflow_session=""' },
  ])('returns null for $case', ({ header }) => {
    expect(readCookieHeader(header, 'eduflow_session')).toBeNull();
  });

  it('accepts the array form Node produces for a repeated header', () => {
    // A repeated `Cookie` header arrives as an array; RFC 6265 says the values are to
    // be concatenated with `; `, so joining is the correct reading rather than
    // picking one.
    expect(readCookieHeader(['a=1', 'eduflow_session=live'], 'eduflow_session')).toBe('live');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// `isPublicRoute` — the exemption marker.
//
// ONE convention, not two: `@Public` is both the exemption from `@RequirePermission`
// AND the exemption from `SessionGuard`. A second marker would be a second thing to
// forget.
// ═══════════════════════════════════════════════════════════════════════════
describe('isPublicRoute', () => {
  const reflector = new Reflector();

  it('is false for a route that carries no marker', () => {
    class Bare {
      handler(): void {
        /* no marker */
      }
    }

    expect(isPublicRoute(reflector, [Bare.prototype.handler, Bare])).toBe(false);
  });

  it('is true when the METHOD carries @Public, which is where it is always used', () => {
    class Marked {
      @Public('a reason that is long enough to be real')
      handler(): void {
        /* public */
      }
    }

    expect(isPublicRoute(reflector, [Marked.prototype.handler, Marked])).toBe(true);
  });

  it('is true when the CLASS carries it, so a whole controller can opt out', () => {
    @Public('every route on this controller is reachable before a session exists')
    class AllPublic {
      handler(): void {
        /* public */
      }
    }

    expect(isPublicRoute(reflector, [AllPublic.prototype.handler, AllPublic])).toBe(true);
  });

  it('does not inherit a sibling method-s marker onto another method', () => {
    // The failure this guards: a lookup that searched the class rather than the
    // handler would exempt EVERY route on a controller because one of them was
    // public — which for `PasswordSignInController` would make login reachable
    // without... well, login is public too, but the principle is the point.
    class Mixed {
      @Public('one route is public')
      publicOne(): void {
        /* public */
      }
      guarded(): void {
        /* not public */
      }
    }

    expect(isPublicRoute(reflector, [Mixed.prototype.publicOne, Mixed])).toBe(true);
    expect(isPublicRoute(reflector, [Mixed.prototype.guarded, Mixed])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The guard.
// ═══════════════════════════════════════════════════════════════════════════
@Injectable()
class OpenController {
  @Public('reachable before a session exists, and that is the point')
  @Get('open')
  open(): void {
    /* public */
  }
}

@Injectable()
class ClosedController {
  @Get('closed')
  closed(): void {
    /* not public */
  }
}

const reflector = new Reflector();
const context = (req: unknown, handler: unknown, controller: unknown): ExecutionContext =>
  contextFor(req, handler as (...args: never[]) => unknown, controller);

describe('SessionGuard — an authenticated route', () => {
  it('attaches the principal the cookie resolves to, and lets the request through', async () => {
    const repo = sessions();
    const req = request(`eduflow_session=${LIVE}`) as PrincipalCarrier;

    const allowed = await new SessionGuard(reflector, repo).canActivate(
      context(req, ClosedController.prototype.closed, ClosedController),
    );

    expect(allowed).toBe(true);
    expect(requirePrincipal(req)).toEqual({ sessionId: SESSION_ID, userId: USER_ID });
  });

  it('asks the repository about the cookie value and nothing else', async () => {
    const repo = sessions();

    await new SessionGuard(reflector, repo).canActivate(
      context(
        request(`other=decoy; eduflow_session=${LIVE}; trailing=1`),
        ClosedController.prototype.closed,
        ClosedController,
      ),
    );

    // Exactly one lookup, with the token and not the whole header. A second lookup,
    // or a lookup of the raw header, would both be a bug the mock could hide.
    expect(repo.seen).toEqual([LIVE]);
  });

  it.each([
    { case: 'no cookie at all', header: undefined },
    { case: 'a cookie header naming something else', header: 'eduflow_oidc_state=abc' },
    { case: 'an empty session cookie', header: 'eduflow_session=' },
    { case: 'a quoted-but-empty session cookie', header: 'eduflow_session=""' },
    { case: 'a cookie whose name merely starts the same', header: 'eduflow_session_x=abc' },
  ])('refuses $case without consulting the database', async ({ header }) => {
    // Not consulting the repository matters twice over: a missing cookie cannot be
    // used to make this deployment do database work, and the refusal is decided
    // without consulting anything an attacker influences.
    const repo = sessions();
    const guard = new SessionGuard(reflector, repo);

    await expect(
      guard.canActivate(
        context(request(header), ClosedController.prototype.closed, ClosedController),
      ),
    ).rejects.toThrow();
    expect(repo.seen).toEqual([]);
  });

  it.each([
    { case: 'a token no session carries', token: 'forged' },
    { case: 'a token that was never issued here', token: 'totally-made-up' },
    // An EXPIRED token lands here too, and identically: `findByToken` resolves
    // revoked, expired and unknown to the same `null`, which
    // `prisma-session-repository.integration.spec.ts` proves against a real
    // database. The guard cannot tell them apart and must not try.
    { case: 'a token whose session has expired', token: `${LIVE}-expired` },
  ])('refuses $case, having asked the database exactly once', async ({ token }) => {
    const repo = sessions();

    await expect(
      new SessionGuard(reflector, repo).canActivate(
        context(
          request(`eduflow_session=${token}`),
          ClosedController.prototype.closed,
          ClosedController,
        ),
      ),
    ).rejects.toThrow();
    expect(repo.seen).toEqual([token]);
  });

  it('attaches no principal when it refuses', async () => {
    // A refused request must not leave a half-resolved principal behind for a
    // downstream interceptor to find.
    const req = request('eduflow_session=forged') as PrincipalCarrier;

    await expect(
      new SessionGuard(reflector, sessions()).canActivate(
        context(req, ClosedController.prototype.closed, ClosedController),
      ),
    ).rejects.toThrow();

    expect('principal' in req).toBe(false);
  });

  it('answers every refusal with the same status and the same body', async () => {
    // Non-revelation. A guard that answered "no cookie" differently from "unknown
    // token" would enumerate which cookies are real. `AGENTS.md` 2.13.
    const messages: unknown[] = [];
    const statuses: unknown[] = [];

    for (const header of [undefined, 'eduflow_session=', 'eduflow_session=forged']) {
      try {
        await new SessionGuard(reflector, sessions()).canActivate(
          context(request(header), ClosedController.prototype.closed, ClosedController),
        );
        statuses.push('ALLOWED');
      } catch (cause) {
        statuses.push((cause as { status?: unknown }).status);
        messages.push((cause as { getResponse?: () => unknown }).getResponse?.());
      }
    }

    expect(statuses).toEqual([401, 401, 401]);
    expect(new Set(messages.map((m) => JSON.stringify(m))).size).toBe(1);
  });

  it('never puts the token or the cookie header in the refusal it logs', async () => {
    // `AGENTS.md` 2.13. The warning exists so an operator sees refusals; a warning
    // that echoed the credential would put a live token in a log file on every
    // failed request.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(
        new SessionGuard(reflector, sessions()).canActivate(
          context(
            request(`eduflow_session=${LIVE}-forged`),
            ClosedController.prototype.closed,
            ClosedController,
          ),
        ),
      ).rejects.toThrow();

      const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logged).not.toContain(LIVE);
      expect(logged).not.toContain('forged');
      expect(logged).toContain('eduflow_session');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('SessionGuard — a @Public route', () => {
  it('is exempt, and never consults the repository', async () => {
    // THE interaction this repository has been bitten by twice: `CsrfGuard` is
    // already global, and a second global guard that did not honour `@Public` would
    // make `GET /auth/oidc/redirect` — the only route reachable before a session
    // exists — answer 401, and sign-in would be impossible.
    const repo = sessions();

    const allowed = await new SessionGuard(reflector, repo).canActivate(
      context(request(), OpenController.prototype.open, OpenController),
    );

    expect(allowed).toBe(true);
    expect(repo.seen).toEqual([]);
  });

  it('is exempt even when the browser DID send a session cookie', async () => {
    // Sign-in while already signed in is a real and legitimate flow: the cookie is
    // present, and the route must still work. An implementation that refused to skip
    // a lookup when a cookie was present would pass the test above and fail this one.
    const repo = sessions();

    await expect(
      new SessionGuard(reflector, repo).canActivate(
        context(request(`eduflow_session=${LIVE}`), OpenController.prototype.open, OpenController),
      ),
    ).resolves.toBe(true);
    expect(repo.seen).toEqual([]);
  });

  it('attaches no principal, because nothing was resolved', async () => {
    const req = request(`eduflow_session=${LIVE}`) as PrincipalCarrier;

    await new SessionGuard(reflector, sessions()).canActivate(
      context(req, OpenController.prototype.open, OpenController),
    );

    expect('principal' in req).toBe(false);
  });
});

describe('SessionGuard — with no session repository wired', () => {
  it('refuses every authenticated route rather than treating it as anonymous', async () => {
    // A Google-only deployment registers no credential routes, so nothing in it needs
    // a principal. But if a route that DOES need one were ever registered, the safe
    // answer is to refuse it, not to let it run with no caller.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(
        new SessionGuard(reflector, undefined).canActivate(
          context(request(), ClosedController.prototype.closed, ClosedController),
        ),
      ).rejects.toThrow();
    } finally {
      warn.mockRestore();
    }
  });

  it('still lets a @Public route through, because it needs no repository', async () => {
    const guard = new SessionGuard(reflector, undefined);

    await expect(
      guard.canActivate(context(request(), OpenController.prototype.open, OpenController)),
    ).resolves.toBe(true);
  });

  it('names the missing token in the operator warning, so a wiring mistake reads as one', async () => {
    // The wire answer is deliberately the SAME 401 as any other refusal — an operator
    // must not be able to tell, from the outside, that a deployment is misconfigured.
    // So the diagnosis goes to the log, where it belongs.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(
        new SessionGuard(reflector, undefined).canActivate(
          context(request(), ClosedController.prototype.closed, ClosedController),
        ),
      ).rejects.toThrow();

      const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logged).toContain(String(I_SESSION_REPOSITORY.description));
      expect(logged).toContain('Refusing rather than treating the request as anonymous');
    } finally {
      warn.mockRestore();
    }
  });
});

describe('requirePrincipal', () => {
  it('throws rather than returning null when the guard did not attach one', () => {
    // A missing principal on a protected route is a WIRING fault, not a user error,
    // and it must not be reported to a user as one.
    expect(() => requirePrincipal(request())).toThrow(/principal/i);
  });
});
