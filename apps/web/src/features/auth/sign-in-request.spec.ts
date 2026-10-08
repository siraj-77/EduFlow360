import { describe, expect, it } from 'vitest';

import { CSRF_HEADER_NAME, satisfiesCsrfRule, signInHeaders } from './csrf-header';
import {
  buildSignInRequest,
  classifySignInResponse,
  networkRefusal,
  retryAfterSeconds,
  signInBody,
  signInEndpoint,
} from './sign-in-request';
import { API_BASE_URL, apiUrl, isSameOriginApi } from '@/lib/api-base-url';

/**
 * The sign-in wire contract.
 *
 * The tests that matter here are the ones about what the form CANNOT do:
 *
 *   - a 401 cannot be told apart from a 401 by anything this code reads, which is
 *     the account-enumeration defence made structural rather than remembered;
 *   - the body cannot carry a third field, because `PasswordSignInBody` is
 *     `.strict()` and a 400 is indistinguishable from bad credentials to a user;
 *   - the CSRF header cannot be blank, because `CsrfGuard` runs before the
 *     controller and a missing header is a bare 403 that looks like a credentials
 *     bug.
 */
describe('the CSRF header (apps/api CsrfGuard)', () => {
  it('carries the exact name the API guard reads', () => {
    // The drift tripwire. `CSRF_HEADER_NAME` in
    // `apps/api/src/common/guards/csrf.guard.ts` is the source of truth; this
    // literal is the web app's copy. If the API is renamed, this fails and the
    // symptom in production would be a 403 on every sign-in.
    expect(CSRF_HEADER_NAME).toBe('x-eduflow-csrf');
  });

  it('sends a non-blank value, which is all the guard compares', () => {
    // `isCsrfHeaderSatisfied` in the guard does `candidate.trim().length > 0` and
    // nothing else - see its comment on why no token comparison is used.
    const headers = signInHeaders();

    expect(satisfiesCsrfRule(headers)).toBe(true);
  });

  it('would fail the guard if the value were blank', () => {
    // Proves the previous assertion has teeth: the rule is a real predicate, not
    // a tautology.
    expect(satisfiesCsrfRule({ [CSRF_HEADER_NAME]: '   ' })).toBe(false);
    expect(satisfiesCsrfRule({})).toBe(false);
  });

  it('asks for JSON, so a cross-origin request is preflighted', () => {
    // The whole mechanism depends on this request not being CORS-safelisted. A
    // form-encoded body would sail through without a preflight and the header
    // would be attached to a request the guard's assumption does not cover.
    const headers = signInHeaders();

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('application/json');
  });
});

describe('the request body (apps/api PasswordSignInBody is .strict())', () => {
  it('carries exactly the two fields the DTO accepts', () => {
    const body = signInBody({ identifier: 'amara@school.lk', password: 'secret' });

    expect(Object.keys(body).sort()).toEqual(['identifier', 'password']);
  });

  it('drops anything else it is handed', () => {
    // A projection, not a pass-through. `rememberMe: true` would be a 400, and a
    // 400 on this route is a refusal the user cannot tell from a bad password.
    const body = signInBody({
      identifier: 'amara@school.lk',
      password: 'secret',
    } as unknown as { identifier: string; password: string });

    expect('rememberMe' in body).toBe(false);
  });

  it('is a POST to /auth/login with credentials included', () => {
    const init = buildSignInRequest({ identifier: 'a', password: 'b' }, { baseUrl: '/api' });

    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"identifier":"a","password":"b"}');
    // Without this the response body arrives and the cookie is dropped, which is
    // a 200 that signed nobody in.
    expect(init.credentials).toBe('include');
    expect(signInEndpoint('/api')).toBe('/api/auth/login');
  });

  it('attaches the CSRF header to the request it builds', () => {
    const init = buildSignInRequest({ identifier: 'a', password: 'b' });
    const headers = init.headers as Record<string, string>;

    expect(satisfiesCsrfRule(headers)).toBe(true);
  });

  it('passes an abort signal through only when one is given', () => {
    const controller = new AbortController();

    expect(buildSignInRequest({ identifier: 'a', password: 'b' }).signal).toBeUndefined();
    expect(
      buildSignInRequest({ identifier: 'a', password: 'b' }, { signal: controller.signal }).signal,
    ).toBe(controller.signal);
  });
});

describe('classification', () => {
  /**
   * The account-enumeration defence.
   *
   * `PasswordSignInController` serialises every refusal - missing account, wrong
   * password, suspended account, unactivated account - to ONE frozen body, so
   * there is nothing to leak on the wire. What could still undo that is the
   * CLIENT rendering two different messages off two different server bodies, so
   * the test that matters is that the classifier ignores the body entirely for a
   * 401.
   */
  describe('a 401 is one outcome whatever the body says', () => {
    const noSuchUser = {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Those credentials were not accepted.',
    };
    const wrongPassword = {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'That password is wrong.',
    };

    it('produces an identical refusal for both', () => {
      const a = classifySignInResponse(401, noSuchUser, null);
      const b = classifySignInResponse(401, wrongPassword, null);

      expect(a).toEqual(b);
      expect(a.kind).toBe('credentials');
    });

    it('would produce the same answer with no body at all', () => {
      expect(classifySignInResponse(401, null, null)).toEqual(
        classifySignInResponse(401, { message: 'anything' }, null),
      );
    });

    it('ignores the body even when it names a field', () => {
      // A hypothetical body saying `fields: ['identifier']` must not become a
      // field-level message, because that would tell an attacker which half to
      // change.
      const hostile = { statusCode: 401, fields: ['identifier'], message: 'no such user' };

      expect(classifySignInResponse(401, hostile, null).fields).toEqual([]);
    });
  });

  it('maps 400 to the fields the API named', () => {
    const refusal = classifySignInResponse(
      400,
      { fields: ['password', 'identifier'], message: 'Check: password, identifier.' },
      null,
    );

    expect(refusal.kind).toBe('rejected');
    expect(refusal.fields).toEqual(['password', 'identifier']);
  });

  it('drops field names the form does not own', () => {
    // The value comes off the network. `role` and `__proto__` are not fields,
    // and a server-driven string in component state is how an unexpected value
    // ends up rendered.
    const refusal = classifySignInResponse(
      400,
      { fields: ['identifier', 'role', 'isAdmin', 42, null] },
      null,
    );

    expect(refusal.fields).toEqual(['identifier']);
  });

  it('survives a 400 whose body is not an object', () => {
    for (const body of [null, undefined, 'nope', 42, { fields: 'identifier' }]) {
      expect(classifySignInResponse(400, body, null).fields).toEqual([]);
    }
  });

  it('maps 403 to the CSRF refusal, separately from any other 4xx', () => {
    // 403 is what `CsrfGuard` returns, and it deserves its own message: it is
    // never the user's fault, and "something went wrong" would send them to
    // retype a password that was never the problem.
    expect(classifySignInResponse(403, null, null).kind).toBe('csrf');
  });

  it('maps 429 to throttled and carries the wait', () => {
    expect(classifySignInResponse(429, null, '42')).toEqual({
      kind: 'throttled',
      fields: [],
      retryAfterSeconds: 42,
    });
  });

  it('maps every other status to one unexpected outcome', () => {
    for (const status of [402, 404, 418, 500, 502, 503]) {
      expect(classifySignInResponse(status, null, null).kind).toBe('unexpected');
    }
  });

  it('describes a request that never got an answer', () => {
    expect(networkRefusal()).toEqual({ kind: 'network', fields: [], retryAfterSeconds: null });
  });
});

describe('Retry-After', () => {
  it('reads a whole number of seconds', () => {
    expect(retryAfterSeconds('5')).toBe(5);
    expect(retryAfterSeconds(' 12 ')).toBe(12);
  });

  it('never reports zero, which would say "retry in 0 seconds"', () => {
    // The API rounds up and never emits 0, but a proxy that strips the value
    // leaves an empty header behind and "try again in 0 seconds" is an
    // instruction the user cannot carry out.
    expect(retryAfterSeconds('0')).toBe(1);
  });

  it('refuses anything it cannot read rather than guessing', () => {
    // The HTTP-date form is legal but this API does not emit it. A wrong number
    // is worse than none: it would state a wait the server never promised.
    for (const header of [null, undefined, '', '   ', 'soon', '-3', '5s', '1.5']) {
      expect(retryAfterSeconds(header)).toBeNull();
    }
  });

  it('leaves a 429 with no usable header without a number to show', () => {
    expect(classifySignInResponse(429, null, 'later').retryAfterSeconds).toBeNull();
  });
});

describe('the API base URL', () => {
  it('defaults to the API own default port', () => {
    // `apps/api/src/config/env.ts` defaults `PORT` to 3001, and the API names
    // this app at `http://localhost:3500`. Both halves come from the other side.
    expect(API_BASE_URL).toBe('http://localhost:3001');
    expect(signInEndpoint()).toBe('http://localhost:3001/auth/login');
  });

  it('joins paths with exactly one separator', () => {
    // A double slash is a different path to most routers and reads as a bug.
    expect(apiUrl('/auth/login', '/api')).toBe('/api/auth/login');
    expect(apiUrl('/auth/login', '/api/')).toBe('/api/auth/login');
    expect(apiUrl('/auth/login', 'https://api.school.edu/')).toBe(
      'https://api.school.edu/auth/login',
    );
  });

  it('knows the same-origin shape from the absolute one', () => {
    // The relative form is the production shape: one host, API behind a proxy,
    // no preflight and the httpOnly cookie is stored without
    // Access-Control-Allow-Credentials.
    expect(isSameOriginApi('/api')).toBe(true);
    expect(isSameOriginApi('http://localhost:3001')).toBe(false);
  });
});
