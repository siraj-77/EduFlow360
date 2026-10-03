import 'reflect-metadata';
import { Controller, Get, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import {
  IPERMISSION_GRANT_READER,
  type IPermissionGrantReader,
} from '../../modules/rbac/domain/ports/permission-grant-reader.js';
import { Public } from './public.decorator.js';
import { PERMISSION_KEY, RequirePermission } from './route-guards.decorator.js';
import {
  SessionGuard,
  type MetadataTarget,
  type PrincipalCarrier,
  type SessionPrincipal,
} from './session.guard.js';
import { PermissionGuard, resolvePermissionRequirement } from './permission.guard.js';

/**
 * `PermissionGuard` — the control that turns a principal into an answer.
 *
 * ## What was missing before this file existed
 *
 * `@RequirePermission` wrote metadata and **nothing read it**. `check-route-guards`
 * proved the decorator was *present*; it could not prove anything *obeyed* it. So
 * `GET /auth/oidc/link` carried `@RequirePermission('AUTH_LINK_EXTERNAL_IDENTITY')`,
 * was authenticated by `SessionGuard`, and was gated by nothing else at all. A file
 * full of `@RequirePermission` reads exactly like an implemented control.
 *
 * ## The composition claim this file has to earn
 *
 * `SessionGuard` already resolves the cookie into a principal. This guard REUSES it
 * and never reads the cookie again — asserted directly below by driving a request
 * that has a principal and NO cookie (allowed), and a request with a valid session
 * cookie and NO principal (refused). A second cookie read would be a second database
 * round trip per request and a second place for the two guards to disagree about who
 * the caller is.
 *
 * ## Fail closed, everywhere
 *
 * No principal, no reader, an unmarked route, a blank key, a role that does not grant
 * the key, and a key no `Permission` row carries: all refusals, never a fall-through
 * to "allowed". The exhaustive table in `decide-permission.spec.ts` covers the rule;
 * this file covers the wiring around it.
 */

const USER_ID = '2f6a1d0c-8e4b-4a1e-9c2f-3d4e5f6a7b8c';
const SESSION_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const LINK_PERMISSION = 'AUTH_LINK_EXTERNAL_IDENTITY';

/**
 * A reader that answers from a table of `userId -> held keys`.
 *
 * Deliberately NOT a stub that returns a constant. The claims under test are about
 * which keys are *accepted*, and a double that accepted everything would let a guard
 * with the wrong comparison pass.
 */
class Grants implements IPermissionGrantReader {
  readonly seen: Array<{ userId: string; permissionKey: string }> = [];

  constructor(private readonly held: Record<string, readonly string[]>) {}

  async isGranted(params: { userId: string; permissionKey: string }): Promise<boolean> {
    this.seen.push({ ...params });
    return (this.held[params.userId] ?? []).includes(params.permissionKey);
  }
}

const grantsFor = (...keys: readonly string[]): Grants => new Grants({ [USER_ID]: keys });
const holder = grantsFor(LINK_PERMISSION);

/** A request carrying a principal, as `SessionGuard` leaves it. */
const requestWith = (principal?: SessionPrincipal): PrincipalCarrier =>
  principal === undefined ? {} : { principal };

const principal: SessionPrincipal = { sessionId: SESSION_ID, userId: USER_ID };

// ═══════════════════════════════════════════════════════════════════════════
// The controllers under test. One per metadata shape, so a lookup that reads the
// wrong target cannot pass.
// ═══════════════════════════════════════════════════════════════════════════
@Controller('secure')
class GatedController {
  @RequirePermission(LINK_PERMISSION)
  @Get('link')
  link(): void {
    /* gated */
  }
}

@Controller('secure')
class PublicController {
  @Public('reachable before a session exists, and that is the point')
  @Get('open')
  open(): void {
    /* public */
  }
}

@Controller('secure')
class UnmarkedController {
  @Get('bare')
  bare(): void {
    /* no marker at all */
  }
}

/**
 * A blank key, set the way the DECORATOR cannot produce.
 *
 * `@RequirePermission('   ')` throws at the call site — `route-guards.decorator.ts`
 * refuses it — so this controller writes the metadata directly. That is the honest
 * way to reach the branch: the point is not that a blank key is reachable through
 * `@RequirePermission`, it is that a guard which trusts the decorator to have
 * validated the key is trusting a convention rather than a check. SetMetadata is
 * public API, so metadata set that way really can arrive.
 */
@Controller('secure')
class BlankKeyController {
  @SetMetadata(PERMISSION_KEY, '   ')
  @Get('blank')
  blank(): void {
    /* blank key */
  }
}

@Controller('secure')
class MixedController {
  @RequirePermission(LINK_PERMISSION)
  @Get('gated')
  gated(): void {
    /* gated */
  }
  @Get('ungated')
  ungated(): void {
    /* inherits nothing from its sibling */
  }
}

const reflector = new Reflector();

const context = (req: unknown, handler: unknown, controller: unknown): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const gatedContext = (req: unknown): ExecutionContext =>
  context(req, GatedController.prototype.link, GatedController);

// ═══════════════════════════════════════════════════════════════════════════
// Reading the metadata.
// ═══════════════════════════════════════════════════════════════════════════
describe('resolvePermissionRequirement', () => {
  const targets = (handler: unknown, controller: unknown): MetadataTarget[] =>
    [handler, controller] as MetadataTarget[];

  it('reads a @RequirePermission key off the METHOD', () => {
    expect(
      resolvePermissionRequirement(
        reflector,
        targets(GatedController.prototype.link, GatedController),
      ),
    ).toEqual({ kind: 'permission', key: LINK_PERMISSION });
  });

  it('reports a @Public route as public, using the SAME marker SessionGuard honours', () => {
    // One marker, one allowlist. A second marker would be a second convention, and the
    // one nobody checks `route-guards.allowlist.json` for is the one that ships.
    expect(
      resolvePermissionRequirement(
        reflector,
        targets(PublicController.prototype.open, PublicController),
      ),
    ).toEqual({ kind: 'public' });
  });

  it('reports a route carrying neither marker as unmarked, not as unrestricted', () => {
    // The distinction the whole fail-closed property rests on.
    expect(
      resolvePermissionRequirement(
        reflector,
        targets(UnmarkedController.prototype.bare, UnmarkedController),
      ),
    ).toEqual({ kind: 'unmarked' });
  });

  it('does NOT let one method inherit another method-s permission', () => {
    // The failure a class-level lookup would cause: a controller with one gated route
    // would have every route treated as gated or, worse, every route treated as
    // exempt. Both are silent.
    expect(
      resolvePermissionRequirement(
        reflector,
        targets(MixedController.prototype.gated, MixedController),
      ),
    ).toEqual({ kind: 'permission', key: LINK_PERMISSION });

    expect(
      resolvePermissionRequirement(
        reflector,
        targets(MixedController.prototype.ungated, MixedController),
      ),
    ).toEqual({ kind: 'unmarked' });
  });

  it('reports the key UNTRIMMED, leaving that judgement to the rule', () => {
    // One place decides what a blank key means. If the guard trimmed here and the rule
    // did not, the two would disagree about the same route.
    const key = resolvePermissionRequirement(
      reflector,
      targets(BlankKeyController.prototype.blank, BlankKeyController),
    );

    expect(key).toEqual({ kind: 'permission', key: '   ' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Grants exactly what the role grants.
// ═══════════════════════════════════════════════════════════════════════════
describe('PermissionGuard — a permission the roles grant', () => {
  it('allows the request', async () => {
    await expect(
      new PermissionGuard(reflector, holder).canActivate(gatedContext(requestWith(principal))),
    ).resolves.toBe(true);
  });

  it('asks the reader about the caller and the key the route declares, once', async () => {
    const grants = grantsFor(LINK_PERMISSION);

    await new PermissionGuard(reflector, grants).canActivate(gatedContext(requestWith(principal)));

    // Exactly one lookup, with the resolved userId and the declared key — not the
    // sessionId, not the cookie, not "every key this user holds".
    expect(grants.seen).toEqual([{ userId: USER_ID, permissionKey: LINK_PERMISSION }]);
  });

  it('REUSES the principal rather than reading the cookie again', async () => {
    // THE composition claim. A principal and no cookie at all: allowed, because the
    // guard never looks at a cookie. If it re-read one, this request would be refused.
    await expect(
      new PermissionGuard(reflector, holder).canActivate(gatedContext(requestWith(principal))),
    ).resolves.toBe(true);
  });

  it('refuses a valid session cookie that no SessionGuard resolved', async () => {
    // The mirror image. A request carrying a cookie but no principal is refused,
    // because the guard's input is the principal `SessionGuard` attached — not a
    // credential it re-reads and re-validates on its own.
    const request = { headers: { cookie: 'eduflow_session=a-perfectly-valid-token' } };

    await expect(
      new PermissionGuard(reflector, holder).canActivate(gatedContext(request)),
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Refusals. Each is a way the request could have been let through.
// ═══════════════════════════════════════════════════════════════════════════
describe('PermissionGuard — refused, and never by falling through', () => {
  const warn = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  it('refuses a caller whose roles grant something ELSE', async () => {
    await expect(
      new PermissionGuard(reflector, grantsFor('SOMETHING_ELSE')).canActivate(
        gatedContext(requestWith(principal)),
      ),
    ).rejects.toThrow();
  });

  it('refuses a caller holding NO role at all', async () => {
    // The reader answers `false` because it found nothing. Nothing here falls through
    // to "allowed" on the way.
    await expect(
      new PermissionGuard(reflector, new Grants({})).canActivate(
        gatedContext(requestWith(principal)),
      ),
    ).rejects.toThrow();
  });

  it('refuses a key no Permission row carries', async () => {
    // A typo in `@RequirePermission`, or a catalogue entry the deploy-time sync has not
    // written. The reader finds no grant, so the request is refused.
    const grants = new Grants({});

    await expect(
      new PermissionGuard(reflector, grants).canActivate(gatedContext(requestWith(principal))),
    ).rejects.toThrow();
  });

  it('refuses when there is no principal', async () => {
    const grants = grantsFor(LINK_PERMISSION);

    await expect(
      new PermissionGuard(reflector, grants).canActivate(gatedContext(requestWith())),
    ).rejects.toThrow();
    // And it never asked, because there was nobody to ask about.
    expect(grants.seen).toEqual([]);
  });

  it('refuses when no grant reader is wired', async () => {
    // A Google-only deployment has no database and therefore no reader. The answer is
    // "cannot evaluate", which is neither yes nor no.
    await expect(
      new PermissionGuard(reflector, undefined).canActivate(gatedContext(requestWith(principal))),
    ).rejects.toThrow();
  });

  it('refuses a route carrying neither @RequirePermission nor @Public', async () => {
    const grants = grantsFor(LINK_PERMISSION);

    await expect(
      new PermissionGuard(reflector, grants).canActivate(
        context(requestWith(principal), UnmarkedController.prototype.bare, UnmarkedController),
      ),
    ).rejects.toThrow();
    // Not consulted: there is no key to consult it about.
    expect(grants.seen).toEqual([]);
  });

  it('refuses a route whose permission key is blank', async () => {
    await expect(
      new PermissionGuard(reflector, grantsFor(LINK_PERMISSION)).canActivate(
        context(requestWith(principal), BlankKeyController.prototype.blank, BlankKeyController),
      ),
    ).rejects.toThrow();
  });

  it('does NOT let a sibling method-s permission open an unmarked route', async () => {
    // `MixedController.ungated` has no decorator. A class-level or
    // first-found-wins lookup would grant it `AUTH_LINK_EXTERNAL_IDENTITY` and open a
    // route nobody gated.
    await expect(
      new PermissionGuard(reflector, holder).canActivate(
        context(requestWith(principal), MixedController.prototype.ungated, MixedController),
      ),
    ).rejects.toThrow();
  });

  it('answers every refusal with the same status and the same body', async () => {
    // Non-revelation, `AGENTS.md` 2.13. A guard that answered "no such permission"
    // differently from "not your role" would enumerate the catalogue to a caller.
    const statuses: unknown[] = [];
    const bodies: unknown[] = [];
    const spy = warn();

    try {
      const attempts = [
        () =>
          new PermissionGuard(reflector, new Grants({})).canActivate(
            gatedContext(requestWith(principal)),
          ),
        () => new PermissionGuard(reflector, holder).canActivate(gatedContext(requestWith())),
        () =>
          new PermissionGuard(reflector, undefined).canActivate(
            gatedContext(requestWith(principal)),
          ),
        () =>
          new PermissionGuard(reflector, holder).canActivate(
            context(requestWith(principal), UnmarkedController.prototype.bare, UnmarkedController),
          ),
      ];

      for (const attempt of attempts) {
        try {
          await attempt();
          statuses.push('ALLOWED');
        } catch (cause) {
          statuses.push((cause as { status?: unknown }).status);
          bodies.push((cause as { getResponse?: () => unknown }).getResponse?.());
        }
      }
    } finally {
      spy.mockRestore();
    }

    expect(statuses).toEqual([403, 403, 403, 403]);
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
  });

  it('never puts the cookie, the token or the sessionId into the log', async () => {
    // `AGENTS.md` 2.13. The log exists so an operator sees refusals; a log that echoed
    // a credential would write a live token to disk on every denied request.
    const spy = warn();
    try {
      await expect(
        new PermissionGuard(reflector, new Grants({})).canActivate(
          gatedContext({ principal, headers: { cookie: `eduflow_session=${SESSION_ID}` } }),
        ),
      ).rejects.toThrow();

      const logged = spy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logged).not.toContain(SESSION_ID);
      expect(logged).not.toContain('eduflow_session=');
      // The userId is deliberately present: who was denied is the point of the log,
      // and a user id is an identifier, not a credential.
      expect(logged).toContain(USER_ID);
    } finally {
      spy.mockRestore();
    }
  });

  it('distinguishes an ordinary role-denial from a wiring fault IN THE LOG', async () => {
    // They are the same 403 on the wire — deliberately, so nothing is revealed — but
    // they send an administrator to opposite places: one to a role, one to a
    // controller or a module. Collapsing them would make a missing `@RequirePermission`
    // look like a permission somebody forgot to grant.
    const denial = warn();
    let denialLog: string;
    try {
      await expect(
        new PermissionGuard(reflector, new Grants({})).canActivate(
          gatedContext(requestWith(principal)),
        ),
      ).rejects.toThrow();
      denialLog = denial.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      denial.mockRestore();
    }

    const fault = warn();
    let faultLog: string;
    try {
      await expect(
        new PermissionGuard(reflector, holder).canActivate(
          context(requestWith(principal), UnmarkedController.prototype.bare, UnmarkedController),
        ),
      ).rejects.toThrow();
      faultLog = fault.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      fault.mockRestore();
    }

    expect(denialLog).toMatch(/NOT_GRANTED/);
    expect(denialLog).not.toMatch(/WIRING FAULT/);
    expect(faultLog).toMatch(/WIRING FAULT/);
    expect(faultLog).toMatch(/NO_PERMISSION_REQUIRED/);
  });

  it('names the missing token when no reader is wired, so a boot fault reads as one', async () => {
    const spy = warn();
    try {
      await expect(
        new PermissionGuard(reflector, undefined).canActivate(gatedContext(requestWith(principal))),
      ).rejects.toThrow();

      expect(spy.mock.calls.map((call) => call.join(' ')).join('\n')).toContain(
        String(IPERMISSION_GRANT_READER.description),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The exemption.
// ═══════════════════════════════════════════════════════════════════════════
describe('PermissionGuard — a @Public route', () => {
  const openContext = (req: unknown): ExecutionContext =>
    context(req, PublicController.prototype.open, PublicController);

  it('is exempt, and never consults the reader', async () => {
    const grants = grantsFor(LINK_PERMISSION);

    await expect(
      new PermissionGuard(reflector, grants).canActivate(openContext(requestWith())),
    ).resolves.toBe(true);
    // The regression that would break sign-in: a database round trip in front of
    // `GET /auth/oidc/redirect`, where no principal exists and none is needed.
    expect(grants.seen).toEqual([]);
  });

  it('is exempt with no reader wired at all', async () => {
    await expect(
      new PermissionGuard(reflector, undefined).canActivate(openContext(requestWith())),
    ).resolves.toBe(true);
  });

  it('is exempt even when the browser DID send a session cookie', async () => {
    // Sign-in while already signed in is a legitimate flow. An implementation that
    // started consulting a reader whenever a cookie arrived would fail here.
    const grants = grantsFor();

    await expect(
      new PermissionGuard(reflector, grants).canActivate(
        openContext({ headers: { cookie: 'eduflow_session=whatever' } }),
      ),
    ).resolves.toBe(true);
    expect(grants.seen).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Order. Unreachable by construction, and worth pinning anyway.
// ═══════════════════════════════════════════════════════════════════════════
describe('PermissionGuard — behind SessionGuard', () => {
  it('reads the principal SessionGuard attached, on the same request object', async () => {
    // Drive the real `SessionGuard` and then this one against the SAME request, which
    // is the composition `app.module.ts` registers. No cookie is read twice, and the
    // permission answer is reached with a principal that exists.
    const request: PrincipalCarrier & { headers: Record<string, string> } = {
      headers: { cookie: `eduflow_session=live-token` },
    };
    const sessions = {
      findByToken: async (): Promise<{ sessionId: string; userId: string }> => ({
        sessionId: SESSION_ID,
        userId: USER_ID,
      }),
    } as never;

    const allowed = await new SessionGuard(reflector, sessions).canActivate(gatedContext(request));
    expect(allowed).toBe(true);

    await expect(
      new PermissionGuard(reflector, holder).canActivate(gatedContext(request)),
    ).resolves.toBe(true);
    // One session lookup, and it was `SessionGuard` that made it.
    expect(request.principal).toEqual({ sessionId: SESSION_ID, userId: USER_ID });
  });

  it('refuses on the same request when SessionGuard refused first', async () => {
    // The order is load-bearing and is asserted through the real pair rather than by
    // reading `app.module.ts`. If `PermissionGuard` were registered before
    // `SessionGuard`, this would still refuse — but the *reason* would be a missing
    // principal on every unauthenticated request, which is a wiring fault logged as
    // though it were policy.
    const request: PrincipalCarrier & { headers: Record<string, string> } = { headers: {} };
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(
        new SessionGuard(reflector, { findByToken: async () => null } as never).canActivate(
          gatedContext(request),
        ),
      ).rejects.toThrow();

      const grants = grantsFor(LINK_PERMISSION);
      await expect(
        new PermissionGuard(reflector, grants).canActivate(gatedContext(request)),
      ).rejects.toThrow();
      expect(grants.seen).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
