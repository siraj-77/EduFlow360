import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { SESSION_COOKIE_NAME } from './session-cookie-name';

/**
 * The cookie name exists in two apps, so it is pinned to the API's
 * source rather than trusted to stay in step.
 *
 * The web app cannot import from `apps/api`, and the API cannot import
 * from the web app. Two copies of a name that both apps must agree on
 * is the shape that drifts silently — the symptom is a login loop with
 * no error anywhere, because each side does exactly what it says. This
 * spec reads the API's port file and refuses the drift.
 */
describe('SESSION_COOKIE_NAME', () => {
  it('matches the API’s port, read from the API’s own source', () => {
    // apps/web/src/lib -> repo root -> apps/api/src/modules/auth/domain/ports.
    // Anchored to this file, not to the working directory, so the assertion
    // holds from any cwd.
    //
    // The base is held in a variable because Vite rewrites a `new URL()`
    // whose second argument is LITERALLY `import.meta.url` as an asset
    // reference, and the rewrite breaks at test time — the spec's own
    // first run died with "The URL must be of scheme file". Holding the
    // base keeps this an ordinary URL resolution.
    const here = import.meta.url;
    const port = readFileSync(
      new URL('../../../api/src/modules/auth/domain/ports/session-cookie.ts', here),
      'utf8',
    );

    const declared = /export const SESSION_COOKIE_NAME = '([^']+)'/.exec(port)?.[1];

    expect(declared, 'the API port no longer declares SESSION_COOKIE_NAME').toBeDefined();
    expect(SESSION_COOKIE_NAME).toBe(declared);
  });

  it('is a boring cookie name: no separators, no control characters, lowercase', () => {
    // What the API's own port spec asserts of ITS copy. The same
    // invariants hold here, because the same parser reads the value.
    expect(SESSION_COOKIE_NAME).not.toMatch(/[=;\s]/);
    expect(SESSION_COOKIE_NAME).toBe(SESSION_COOKIE_NAME.toLowerCase());
    expect(SESSION_COOKIE_NAME).not.toMatch(/token|csrf|xsrf/i);
  });
});
