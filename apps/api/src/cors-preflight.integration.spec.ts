import { describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from './testing/http-harness.js';
import { TEST_ENVIRONMENT } from './testing/test-environment.js';

/**
 * The CORS contract a browser login depends on.
 *
 * ## Why this suite exists
 *
 * The web app signs in from `http://localhost:3500` against the API on
 * `http://localhost:3001` — a cross-origin request that must carry the
 * session COOKIE. For a credentialed request the browser requires TWO
 * headers on the preflight response, not one:
 *
 *   - `access-control-allow-origin` — the specific origin, never `*`
 *   - `access-control-allow-credentials: true`
 *
 * Before 2026-10-11 the API sent the first and not the second, and the
 * consequence was total: the browser refused to send `POST /auth/login` at
 * all, so every login failed with `net::ERR_FAILED` — which the sign-in
 * form renders as "EduFlow could not reach the server. Check your
 * connection and try again." A user with the correct password and a
 * perfectly healthy network was told their connection was broken.
 *
 * Found by driving a real Chrome through `npm run dev`, because every
 * existing suite passed: they call the API directly, and a direct call never
 * makes the browser's CORS decision. That gap is what this file closes.
 *
 * ## What is asserted, and where
 *
 * The PREFLIGHT response — that is where the browser decides. A test that
 * asserted only the POST's response headers would pass against an API the
 * browser still refuses to talk to.
 */

/** The origin the running web app serves from, per `WEB_PORT`. */
const WEB_ORIGIN = 'http://localhost:3500';

/** The preflight a browser sends before the credentialed sign-in POST. */
const preflight = (harness: HttpHarness, origin: string) =>
  harness.request('/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-eduflow-csrf',
    },
  });

describe('the CORS preflight', () => {
  it('allows credentials, without which no browser login is possible', async () => {
    // THE assertion. `allow-credentials: true` is what permits the session
    // cookie to travel at all; without it the browser never sends the POST,
    // so a correct password and a healthy network change nothing.
    const harness = await startHttpHarness({
      env: { ...TEST_ENVIRONMENT, WEB_ORIGIN: WEB_ORIGIN },
    });

    try {
      const response = await preflight(harness, WEB_ORIGIN);

      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    } finally {
      await harness.close();
    }
  });

  it('names the single allowed origin, and never a wildcard', async () => {
    // A wildcard would undo the CSRF guard's assumption that only one origin
    // can make a credentialed request — and the two headers only work
    // together: `allow-credentials: true` with `allow-origin: *` is a
    // response the browser rejects anyway.
    const harness = await startHttpHarness({
      env: { ...TEST_ENVIRONMENT, WEB_ORIGIN: WEB_ORIGIN },
    });

    try {
      const response = await preflight(harness, WEB_ORIGIN);

      expect(response.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
    } finally {
      await harness.close();
    }
  });

  it('allows the headers the sign-in form actually sends', async () => {
    // The CSRF header IS the channel test (`csrf.guard.ts`), so a preflight
    // that did not allow it would break the security control as surely as
    // it breaks login.
    const harness = await startHttpHarness({
      env: { ...TEST_ENVIRONMENT, WEB_ORIGIN: WEB_ORIGIN },
    });

    try {
      const response = await preflight(harness, WEB_ORIGIN);
      const allowed = response.headers.get('access-control-allow-headers') ?? '';

      expect(allowed).toContain('content-type');
      expect(allowed).toContain('x-eduflow-csrf');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    } finally {
      await harness.close();
    }
  });

  it('never lets a foreign origin read the response', async () => {
    // Asserted the way the BROWSER decides, which is the only way it matters:
    // `Access-Control-Allow-Origin` must name THIS app's origin. A page from
    // any other origin therefore cannot read the response, because the
    // browser compares the header to the page's own origin and refuses on a
    // mismatch.
    //
    // The header is present on a request from a foreign origin too — Nest's
    // `origin` is a single string, so it names what is allowed rather than
    // echoing what asked. That is the correct shape for a one-origin
    // allow-list; the earlier draft of this test asserted the header would be
    // ABSENT, which described Express rather than the browser.
    const harness = await startHttpHarness({
      env: { ...TEST_ENVIRONMENT, WEB_ORIGIN: WEB_ORIGIN },
    });

    try {
      const response = await preflight(harness, 'http://evil.example');

      expect(response.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
    } finally {
      await harness.close();
    }
  });

  /**
   * `PLT-1001` AC-2 — "Changing WEB_ORIGIN changes every derived URL
   * without code edits."
   *
   * Every test above boots with the SAME origin, so all four of them
   * would still pass if `create-app.ts` hard-coded
   * `http://localhost:3500` into `enableCors`: a let me permit no
   * deployment's allow-list lives in the source. This is the test that
   * distinguishes configuration from code — it boots with a DIFFERENT
   * origin and requires the header to follow it.
   *
   * The second assertion is the one with teeth: after the move, the old
   * default must no longer be the answer. A derivation that only ever
   * appends (config wins, default still present) would fail it.
   */
  it('moves the allow-list when WEB_ORIGIN moves — the config, not the code, decides', async () => {
    const configured = 'https://staging.school.example';

    const harness = await startHttpHarness({
      env: { ...TEST_ENVIRONMENT, WEB_ORIGIN: configured },
    });

    try {
      const allowed = await preflight(harness, configured);

      expect(allowed.headers.get('access-control-allow-origin')).toBe(configured);

      const previousDefault = await preflight(harness, WEB_ORIGIN);

      expect(previousDefault.headers.get('access-control-allow-origin')).toBe(configured);
      expect(previousDefault.headers.get('access-control-allow-origin')).not.toBe(WEB_ORIGIN);
    } finally {
      await harness.close();
    }
  });
});
