import { describe, expect, it } from 'vitest';

import {
  API_BASE_URL,
  LOCAL_API_ORIGIN,
  apiUrl,
  isSameOriginApi,
  resolveApiBaseUrl,
} from './api-base-url';

/**
 * The API address, as a unit.
 *
 * `apps/web/src/lib/**` is coverage-gated at 80% lines by
 * `vitest.config.ts`, and the reason it is in `lib/` at all is `web-port.ts`:
 * a duplicated deployment value fails silently and misleadingly, which is worse
 * than failing loudly. So this is tested like the logic it is, not like a
 * constant.
 */
describe('resolveApiBaseUrl', () => {
  it('falls back to the API own default when nothing is configured', () => {
    for (const configured of [undefined, '', '   ']) {
      expect(resolveApiBaseUrl(configured)).toBe(LOCAL_API_ORIGIN);
    }
  });

  it('trims a configured value', () => {
    expect(resolveApiBaseUrl('  /api  ')).toBe('/api');
    expect(resolveApiBaseUrl(' https://api.school.edu ')).toBe('https://api.school.edu');
  });

  it('strips trailing slashes so joining cannot produce a double one', () => {
    // `/api/` + `/auth/login` must be `/api/auth/login`. A double slash is a
    // different path to most routers, and a 404 that reads like a bug.
    expect(resolveApiBaseUrl('/api/')).toBe('/api');
    expect(resolveApiBaseUrl('/api///')).toBe('/api');
    expect(resolveApiBaseUrl('https://api.school.edu/')).toBe('https://api.school.edu');
  });

  it('keeps a bare origin intact', () => {
    expect(resolveApiBaseUrl('https://api.school.edu')).toBe('https://api.school.edu');
  });
});

describe('isSameOriginApi', () => {
  it('treats a root-relative base as same-origin', () => {
    // The production shape: one host per school, API behind a reverse proxy, so
    // the session cookie is stored without Access-Control-Allow-Credentials.
    expect(isSameOriginApi('/api')).toBe(true);
    expect(isSameOriginApi('/')).toBe(true);
  });

  it('treats an absolute base as cross-origin', () => {
    expect(isSameOriginApi('http://localhost:3001')).toBe(false);
    expect(isSameOriginApi('https://api.school.edu')).toBe(false);
  });

  it('does not mistake a protocol-relative URL for a path', () => {
    // `//api.school.edu` starts with `/` and is absolute. Classifying it as
    // same-origin would suppress the preflight the CSRF channel test relies on.
    expect(isSameOriginApi('//api.school.edu')).toBe(false);
  });
});

describe('apiUrl', () => {
  it('joins with exactly one separator', () => {
    expect(apiUrl('/auth/login', '/api')).toBe('/api/auth/login');
    expect(apiUrl('auth/login', '/api')).toBe('/api/auth/login');
    expect(apiUrl('/auth/login', 'http://localhost:3001')).toBe('http://localhost:3001/auth/login');
  });

  it('defaults to the running app own base', () => {
    expect(apiUrl('/auth/login')).toBe(`${API_BASE_URL}/auth/login`);
  });
});
