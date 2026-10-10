import { describe, expect, it } from 'vitest';

import {
  buildPermissionsRequest,
  classifyPermissionsResponse,
  networkRefusal,
  parsePermissionsBody,
  permissionsEndpoint,
  PERMISSIONS_PATH,
} from './permissions-request';
import { API_BASE_URL, apiUrl, isSameOriginApi } from '@/lib/api-base-url';

/**
 * The permission-set wire contract.
 *
 * The tests that matter here are the ones about what the request
 * CANNOT do:
 *
 *   - it cannot carry a CSRF header, because a GET is a safe
 *     method and `CsrfGuard` enforces state-changing requests
 *     only - a header here would be dead weight that a reader
 *     could mistake for a requirement;
 *   - it cannot read the body of a refusal, because nothing
 *     about the caller's permission set can be learned from an
 *     error envelope, and a proxy that rewrites one must not
 *     change the decision;
 *   - it cannot accept a non-string as a permission key, because
 *     the set decides what a user may see and a server-driven
 *     value must not become a grant.
 */
describe('the request', () => {
  it('is a GET to /permissions/me with credentials included', () => {
    // The drift tripwire. `PermissionsController` in
    // `apps/api/src/modules/rbac/controllers/permissions.controller.ts`
    // is the source of truth; this literal is the web app's copy. If
    // the API route moves, this fails and the symptom in production
    // would be a 404 that reads as "no permissions".
    expect(PERMISSIONS_PATH).toBe('/permissions/me');

    const init = buildPermissionsRequest();

    expect(init.method).toBe('GET');
    // Without this the response body arrives and the cookie is
    // dropped, which is a 200 that identified nobody.
    expect(init.credentials).toBe('include');
    expect(permissionsEndpoint('/api')).toBe('/api/permissions/me');
  });

  it('asks for JSON, so a cross-origin request is preflighted', () => {
    const init = buildPermissionsRequest();
    const headers = init.headers as Record<string, string>;

    expect(headers.Accept).toBe('application/json');
  });

  it('carries no CSRF header, because a GET is a safe method', () => {
    // `CsrfGuard` runs on state-changing requests. This request
    // reads, so the guard does not run, and a header would be
    // dead weight - and worse, a reader's mistaken requirement.
    const init = buildPermissionsRequest();
    const headers = init.headers as Record<string, string>;

    expect(Object.keys(headers)).toEqual(['Accept']);
    expect(headers['x-eduflow-csrf']).toBeUndefined();
  });

  it('passes an abort signal through only when one is given', () => {
    const controller = new AbortController();

    expect(buildPermissionsRequest().signal).toBeUndefined();
    expect(buildPermissionsRequest({ signal: controller.signal }).signal).toBe(controller.signal);
  });
});

describe('classification', () => {
  it('maps 401 to unauthenticated, which is not the same as denied', () => {
    // 401 means no session at all. 403 means a session whose roles
    // do not hold the read key. Collapsing them would send a signed-in
    // teacher to the sign-in screen.
    expect(classifyPermissionsResponse(401).kind).toBe('unauthenticated');
    expect(classifyPermissionsResponse(403).kind).toBe('denied');
  });

  it('answers from the status alone, never from the body', () => {
    // The API's refusals are error envelopes. Nothing about the
    // caller's permission set can be learned from one, so the
    // classifier does not read it - and a proxy that rewrites the
    // body cannot change the decision.
    expect(classifyPermissionsResponse(403)).toEqual({ kind: 'denied' });
    expect(classifyPermissionsResponse(401)).toEqual({ kind: 'unauthenticated' });
  });

  it('maps every other status to one unexpected outcome', () => {
    for (const status of [200, 400, 402, 404, 418, 500, 502, 503]) {
      expect(classifyPermissionsResponse(status).kind).toBe('unexpected');
    }
  });

  it('describes a request that never got an answer', () => {
    expect(networkRefusal()).toEqual({ kind: 'network' });
  });
});

describe('the answer body', () => {
  it('reads the permission keys the API returned', () => {
    // `ReadMyPermissions` answers `{ permissions: [...] }` and
    // nothing else, sorted and deduplicated by the port.
    const body = parsePermissionsBody({
      permissions: ['PERMISSION_READ_OWN', 'PLATFORM_MODULE_MANAGE'],
    });

    expect(body).toEqual(['PERMISSION_READ_OWN', 'PLATFORM_MODULE_MANAGE']);
  });

  it('drops a key that is not a string', () => {
    // The value arrives from the network. A number or a nested
    // object is not a permission key, and a set built from it would
    // decide what a user may see on the strength of a value the API
    // never sent.
    const body = parsePermissionsBody({
      permissions: ['PERMISSION_READ_OWN', 42, null, { key: 'x' }],
    });

    expect(body).toEqual(['PERMISSION_READ_OWN']);
  });

  it('answers an empty set for a body it cannot read', () => {
    // A half-built set reads like a policy decision. An empty one
    // reads like what it is: nothing was read.
    for (const body of [null, undefined, 'nope', 42, [], { permissions: 'x' }]) {
      expect(parsePermissionsBody(body)).toEqual([]);
    }
  });
});

describe('the API base URL', () => {
  it('defaults to the API own default port', () => {
    // `apps/api/src/config/env.ts` defaults `PORT` to 3001. Both
    // halves come from the other side of the workspace.
    expect(API_BASE_URL).toBe('http://localhost:3001');
    expect(permissionsEndpoint()).toBe('http://localhost:3001/permissions/me');
  });

  it('joins paths with exactly one separator', () => {
    // A double slash is a different path to most routers and reads
    // as a bug.
    expect(apiUrl('/permissions/me', '/api')).toBe('/api/permissions/me');
    expect(apiUrl('/permissions/me', '/api/')).toBe('/api/permissions/me');
    expect(apiUrl('/permissions/me', 'https://api.school.edu/')).toBe(
      'https://api.school.edu/permissions/me',
    );
  });

  it('knows the same-origin shape from the absolute one', () => {
    // The relative form is the production shape: one host, API
    // behind a proxy, no preflight and the httpOnly cookie is
    // stored without Access-Control-Allow-Credentials.
    expect(isSameOriginApi('/api')).toBe(true);
    expect(isSameOriginApi('http://localhost:3001')).toBe(false);
  });
});
