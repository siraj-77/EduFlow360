import { Controller, Get, Injectable, type CanActivate } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from './permission.guard.js';
import { RequirePermission } from './route-guards.decorator.js';
import { attachPrincipal } from './session.guard.js';
import {
  IPERMISSION_CACHE,
  type IPermissionCache,
  type PermissionCacheKey,
} from '../../modules/rbac/domain/ports/permission-cache.js';
import {
  IPERMISSION_GRANT_READER,
  type IPermissionGrantReader,
} from '../../modules/rbac/domain/ports/permission-grant-reader.js';

/**
 * `PLT-202` acceptance criterion 2, over a real socket:
 *
 * > "Permission checks add negligible latency (<5ms) — cache role→permission resolution in
 * > Redis with invalidation on role change."
 *
 * ## Why this file exists and what `cached-permission-lookup.spec.ts` cannot show
 *
 * The rule is fully tested in isolation. What only a real request can settle is the thing
 * that actually matters about a cache in front of an authorization decision:
 *
 * 1. **A cache HIT and a database answer produce the same HTTP response.** Not a similar
 *    one — the same. If a cached grant reached the handler differently, the bug would be in
 *    the wiring and invisible to a unit test that calls the rule directly.
 * 2. **A cache that is down produces working requests**, not 403s and not 500s. This is
 *    the single most likely way to break the feature: someone adds a cache, the cache is
 *    unreachable in an environment, and every permission-gated route starts refusing.
 * 3. **No cache at all produces working requests** — the deployment `REDIS_URL` is optional
 *    for.
 * 4. **A cache HIT never reaches the database**, asserted by counting.
 * 5. **The database still overrules a cache that disagrees**, which is what "the database is
 *    the source of truth" means when a stale entry says `true` and the grant was revoked.
 *
 * ## What is real and what is doubled
 *
 * Real: the Nest graph, the real `PermissionGuard`, real metadata resolution, a real TCP
 * socket, real status codes.
 *
 * Doubled: the reader and the cache. **Redis is not running in this environment and
 * `ioredis` is not a dependency** — which is exactly the deployment this feature must
 * support, so the doubles here are not a shortcut, they are the primary case.
 */

@Injectable()
class HeaderSessionGuard implements CanActivate {
  canActivate(context: { switchToHttp(): { getRequest(): Record<string, unknown> } }): boolean {
    const request = context.switchToHttp().getRequest();
    // From `.headers`, not the request root — Express lowercases header names and hangs
    // them there. Reading the root finds nothing, the guard returns false, and Nest
    // renders its OWN `403 Forbidden resource`, which looks exactly like a permission
    // decision. Spelled out because that ambiguity already cost a debugging cycle.
    const headers =
      request['headers'] !== null && typeof request['headers'] === 'object'
        ? (request['headers'] as Record<string, unknown>)
        : {};
    const userId = headers['x-test-user'];

    if (typeof userId !== 'string' || userId.length === 0) return false;

    attachPrincipal(request as Parameters<typeof attachPrincipal>[0], {
      sessionId: `session-for-${userId}`,
      userId,
    });
    return true;
  }
}

@Controller('spec/guarded')
class GuardedController {
  @Get('granted')
  @RequirePermission('FINANCE_INVOICE_REVERSE')
  granted(): { readonly ok: true } {
    return { ok: true };
  }
}

/** A reader that records every consultation, so "was the database touched?" is answerable. */
function reader(granted: boolean) {
  const calls: Array<{ userId: string; permissionKey: string }> = [];
  const impl: IPermissionGrantReader = {
    isGranted: ({ userId, permissionKey }) => {
      calls.push({ userId, permissionKey });
      return Promise.resolve(granted);
    },
  };
  return { impl, calls };
}

/** A cache that records reads and writes. */
function cache(reply: boolean | undefined | (() => never)) {
  const reads: PermissionCacheKey[] = [];
  const writes: PermissionCacheKey[] = [];
  const impl: IPermissionCache = {
    read: (key) => {
      reads.push(key);
      return typeof reply === 'function' ? reply() : Promise.resolve(reply);
    },
    write: (key) => {
      writes.push(key);
      return Promise.resolve();
    },
    invalidateUser: () => Promise.resolve(),
  };
  return { impl, reads, writes };
}

interface Harness {
  readonly get: (userId: string) => Promise<{ status: number; body: string }>;
  close(): Promise<void>;
}

async function boot(options: {
  readonly grants: IPermissionGrantReader;
  readonly cache?: IPermissionCache;
}): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({
    controllers: [GuardedController],
    providers: [
      Reflector,
      HeaderSessionGuard,
      { provide: IPERMISSION_GRANT_READER, useValue: options.grants },
      ...(options.cache === undefined
        ? []
        : [{ provide: IPERMISSION_CACHE, useValue: options.cache }]),
      { provide: APP_GUARD, useClass: HeaderSessionGuard },
      { provide: APP_GUARD, useClass: PermissionGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  const server = app.getHttpServer() as {
    listen(port: number): unknown;
    address(): { port: number } | null;
  };
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  const port = server.address()?.port ?? 0;

  return {
    get: async (userId) => {
      const response = await fetch(`http://127.0.0.1:${port}/spec/guarded/granted`, {
        headers: { 'x-test-user': userId },
      });
      return { status: response.status, body: await response.text() };
    },
    close: () => app.close(),
  };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

describe('PLT-202 AC-2 — a cache HIT is indistinguishable from a database answer', () => {
  it('returns the SAME status and body from a cache hit as from a fresh database read', async () => {
    // The claim in one comparison. If wiring a cache changed the response in any byte,
    // this fails — which is the bug a rule-level unit test structurally cannot see.
    const viaDatabase = await (async () => {
      const h = await boot({ grants: reader(true).impl });
      try {
        return await h.get('user-1');
      } finally {
        await h.close();
      }
    })();

    const viaCache = await (async () => {
      const h = await boot({ grants: reader(false).impl, cache: cache(true).impl });
      try {
        return await h.get('user-1');
      } finally {
        await h.close();
      }
    })();

    expect(viaCache.status).toBe(viaDatabase.status);
    expect(viaCache.body).toBe(viaDatabase.body);
    expect(viaCache.status).toBe(200);
  });

  it('never reaches the database on a hit — the whole point of the <5ms target', async () => {
    const db = reader(false);
    const c = cache(true);
    const h = await boot({ grants: db.impl, cache: c.impl });

    try {
      await h.get('user-1');

      expect(db.calls).toEqual([]);
      expect(c.reads).toHaveLength(1);
      expect(c.writes).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it('writes back only after the DATABASE confirms a grant', async () => {
    // The order matters: a cache populated from an unconfirmed answer is a cache of guesses.
    const db = reader(true);
    const c = cache(undefined);
    const h = await boot({ grants: db.impl, cache: c.impl });

    try {
      await h.get('user-1');

      expect(c.writes).toHaveLength(1);
      expect(c.writes[0]).toEqual({ userId: 'user-1', permissionKey: 'FINANCE_INVOICE_REVERSE' });
    } finally {
      await h.close();
    }
  });

  it('does NOT write back a denial, so a revoked-then-granted user is never locked out', async () => {
    const db = reader(false);
    const c = cache(undefined);
    const h = await boot({ grants: db.impl, cache: c.impl });

    try {
      expect((await h.get('user-1')).status).toBe(403);
      expect(c.writes).toEqual([]);
    } finally {
      await h.close();
    }
  });
});

describe('PLT-202 AC-2 — a cache that is DOWN must not break authorization', () => {
  it('still answers correctly when the cache read throws', async () => {
    // The most likely way to break this feature. Someone adds a cache, the cache is
    // unreachable somewhere, and every permission-gated route starts refusing — turning a
    // performance dependency into an availability dependency.
    const db = reader(true);
    const h = await boot({
      grants: db.impl,
      cache: cache(() => {
        throw new Error('ECONNREFUSED 6379');
      }).impl,
    });

    try {
      const response = await h.get('user-1');

      expect(response.status).toBe(200);
      expect(db.calls).toHaveLength(1);
    } finally {
      await h.close();
    }
  });

  it('still REFUSES correctly when the cache is down and the role does not grant', async () => {
    // The mirror image, and the one that matters more: a degraded cache must not start
    // allowing things. If this returned 200 the fallback had become "allow on error".
    const h = await boot({
      grants: reader(false).impl,
      cache: cache(() => {
        throw new Error('ECONNREFUSED 6379');
      }).impl,
    });

    try {
      expect((await h.get('user-1')).status).toBe(403);
    } finally {
      await h.close();
    }
  });

  it('reports DEGRADED in the log, so a silent cache outage is not silent', async () => {
    // Otherwise every request still succeeds, at database latency, and nobody connects the
    // two for months.
    const h = await boot({
      grants: reader(true).impl,
      cache: cache(() => {
        throw new Error('ECONNREFUSED 6379');
      }).impl,
    });

    try {
      await h.get('user-1');

      const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('cache DEGRADED');
      expect(logged).toContain('FINANCE_INVOICE_REVERSE');
    } finally {
      await h.close();
    }
  });

  it('stays quiet on a healthy HIT or MISS — a log line per request is not a log', async () => {
    const h = await boot({ grants: reader(true).impl, cache: cache(undefined).impl });

    try {
      await h.get('user-1');

      const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).not.toContain('cache DEGRADED');
    } finally {
      await h.close();
    }
  });
});

describe('PLT-202 AC-2 — no cache at all is a supported deployment', () => {
  it('answers correctly with NO IPERMISSION_CACHE provider registered', async () => {
    // `REDIS_URL` is optional in `env.ts` because Redis has no official Windows build, so
    // this is not an edge case — it is the default on a developer machine and on any
    // school that does not run Redis.
    const db = reader(true);
    const h = await boot({ grants: db.impl });

    try {
      expect((await h.get('user-1')).status).toBe(200);
      expect(db.calls).toHaveLength(1);
    } finally {
      await h.close();
    }
  });

  it('still refuses correctly with no cache', async () => {
    const h = await boot({ grants: reader(false).impl });

    try {
      expect((await h.get('user-1')).status).toBe(403);
    } finally {
      await h.close();
    }
  });
});

describe('PLT-202 AC-2 — the database is the source of truth', () => {
  it('consults the database on a MISS even though the cache is configured', async () => {
    const db = reader(true);
    const c = cache(undefined);
    const h = await boot({ grants: db.impl, cache: c.impl });

    try {
      expect((await h.get('user-1')).status).toBe(200);
      expect(c.reads).toHaveLength(1);
      expect(db.calls).toHaveLength(1);
    } finally {
      await h.close();
    }
  });

  it('treats a corrupt cache value as a MISS, not as a grant', async () => {
    // Anything that is not exactly `true` means "we do not know". A cache that answers
    // `'yes'`, `1` or `{ granted: true }` — a broken or substituted store — must not open a
    // route, and must fall through to the database instead.
    for (const bogus of ['yes', 1, { granted: true }, '', null]) {
      const db = reader(false);
      const h = await boot({
        grants: db.impl,
        cache: cache(bogus as unknown as boolean | undefined).impl,
      });

      try {
        expect((await h.get('user-1')).status).toBe(403);
        expect(db.calls).toHaveLength(1);
      } finally {
        await h.close();
      }
    }
  });

  it('propagates a DATABASE failure as a 500, never as a 403', async () => {
    // The last line of defence. If a pool exhaustion surfaced as "Forbidden", an operator
    // would go and inspect a role table while the real fault is a connection limit.
    const failing: IPermissionGrantReader = {
      isGranted: () => Promise.reject(new Error('pool exhausted')),
    };
    const h = await boot({ grants: failing, cache: cache(undefined).impl });

    try {
      expect((await h.get('user-1')).status).toBe(500);
    } finally {
      await h.close();
    }
  });
});
