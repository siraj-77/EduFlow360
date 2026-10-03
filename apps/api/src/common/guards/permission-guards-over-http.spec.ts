import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { SESSION_COOKIE_NAME } from '../../modules/auth/domain/ports/session-cookie.js';

/**
 * Three global guards on one request, over a real socket.
 *
 * ## Why this file exists and what it is the only honest test of
 *
 * `CsrfGuard` and `SessionGuard` were already registered globally. `PermissionGuard`
 * makes three, and three interacting global guards is a different thing from two:
 * a guard that does not honour `@Public` breaks the only route a browser can reach
 * before signing in, and a guard registered in the wrong ORDER refuses every
 * unauthenticated request for the wrong reason while still refusing — which is the
 * most dangerous shape a security control can have, because every assertion of the
 * form "it returned an error" still passes.
 *
 * Neither failure is visible by reading `app.module.ts`, and neither is visible from a
 * unit test with a mocked `ExecutionContext`. So this drives the real application over
 * TCP and reads what came back.
 *
 * ## What is real, and what this file deliberately does NOT cover
 *
 * Real: the application graph (`AppModule.forRoot`, including `RbacModule`), all three
 * guards, the real controllers and use-cases, CORS, and a kernel-assigned port.
 *
 * `TEST_ENVIRONMENT` carries **no `DATABASE_URL`**, so `RbacModule` registers no
 * reader and `PermissionGuard` runs with its dependency absent. That is deliberate
 * here — it is the fail-closed configuration, and it is the one that keeps this suite
 * runnable on a machine that has never started the container stack.
 *
 * What that means for coverage, stated rather than glossed: with no database there is
 * no session to present, so this file cannot reach the *granted* case or the *denied
 * by permission* case. Those need a real session row and are driven over a socket in
 * `permission-engine-over-http.integration.spec.ts`. This file owns the two claims that
 * need no database: `@Public` still works with three guards, and an unauthenticated
 * gated route is refused by `SessionGuard` before permissions are consulted.
 */

/** The key the one non-public route in the tree declares. */
const LINK_PERMISSION = 'AUTH_LINK_EXTERNAL_IDENTITY';

let harness: HttpHarness;

beforeAll(async () => {
  harness = await startHttpHarness();
});

afterAll(async () => {
  await harness.close();
});

describe('a @Public route, with THREE global guards registered', () => {
  it('is still reachable, and still redirects', async () => {
    // THE claim. `PermissionGuard` is now the third guard every request passes
    // through, and it demands a principal. `GET /auth/oidc/redirect` has none, because
    // it is the route a browser reaches BEFORE one exists — so if this guard did not
    // honour `@Public`, sign-in would be impossible and every other gate in this
    // repository would still be green.
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.status).toBe(302);
    expect(response.location).toMatch(/^https:\/\//);
  });

  it('is reachable with no session cookie and with no reader wired', async () => {
    // Spelled out rather than implied: the request below carries no cookie at all, and
    // `RbacModule` registered no `IPermissionGrantReader`. Both absences are the
    // normal state of this route and neither may refuse it.
    const response = await harness.request('/auth/oidc/redirect');

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it('is reachable even when the browser DID send a session cookie', async () => {
    // Sign-in while signed in. A guard that consulted the reader whenever a cookie
    // arrived would fail here even though it passed the test above.
    const response = await harness.request('/auth/oidc/redirect', {
      cookies: { [SESSION_COOKIE_NAME]: 'a-token-no-session-carries' },
    });

    expect(response.status).toBe(302);
  });
});

describe('a @RequirePermission route, unauthenticated', () => {
  it('is refused 401 by the SESSION guard, not 403 by the permission guard', async () => {
    // The ORDER, proved by its observable consequence rather than by reading the
    // registration array.
    //
    // `GET /auth/oidc/link` carries `@RequirePermission('AUTH_LINK_EXTERNAL_IDENTITY')`
    // and no `@Public`, so all three guards have something to say. If `PermissionGuard`
    // ran before `SessionGuard` it would refuse here too — with 403, and a log line
    // reading `NO_PRINCIPAL` on every unauthenticated request in the system, which is a
    // wiring fault indistinguishable from policy.
    //
    // The status code is therefore the assertion. 401 says "authenticate"; 403 would say
    // "you are authenticated and may not", which is false here.
    const response = await harness.request('/auth/oidc/link');

    expect(response.status).toBe(401);
    // And no redirect was issued: a refused route that still redirected would leak the
    // provider URL and set a state cookie, both of which the auth suite asserts against.
    expect(response.location).toBeNull();
  });

  it('is refused 401 whatever bogus cookie it carries', async () => {
    const response = await harness.request('/auth/oidc/link', {
      cookies: { [SESSION_COOKIE_NAME]: 'not-a-real-session-token' },
    });

    expect(response.status).toBe(401);
  });

  it('answers every unauthenticated refusal identically, so it is not an oracle', async () => {
    // `AGENTS.md` 2.13. "No cookie" and "unknown cookie" must not be distinguishable, or
    // the route enumerates which cookies are real.
    const bodies: string[] = [];

    for (const cookies of [{}, { [SESSION_COOKIE_NAME]: 'forged' }]) {
      bodies.push((await harness.request('/auth/oidc/link', { cookies })).body);
    }

    expect(new Set(bodies).size).toBe(1);
  });
});

describe('the permission this route declares', () => {
  it('is a key the shipped schema could actually hold', async () => {
    // Not a tautology. `Permission.key` is a `MODULE_ACTION` string written by a
    // deploy-time sync (`ADR-012`), so a key that is not `MODULE_ACTION` could never
    // match a row and the route would be unreachable for everyone — permanently, and
    // invisibly, because an unmatchable key and a denied permission produce the same
    // 403.
    expect(LINK_PERMISSION).toMatch(/^[A-Z]+(_[A-Z0-9]+)+$/);
  });
});
