import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CSRF_HEADER_NAME,
  SAFE_METHODS,
  isCsrfHeaderSatisfied,
  isSafeMethod,
  requiresCsrfHeader,
} from './csrf.guard.js';

/**
 * The CSRF defence required by `D48`.
 *
 * The brief for this piece asked for proof rather than assertion:
 *
 *   > Prove the CSRF list is right. If you write `const SAFE = new Set(['GET'])`,
 *   > a test should add a method you did not think of and show it is caught.
 *
 * So the load-bearing tests below are not "POST is denied". They are three
 * independent things, because one of them can be wrong while the others pass:
 *
 *   1. `SAFE_METHODS` equals a literal written independently in this file. If
 *      someone edits the guard, this fails. If both move together, the
 *      exhaustive sweep in (3) is what notices.
 *   2. Every method in `UNSAFE_METHODS` — a table including verbs the guard's
 *      author had no reason to think about — is denied. This is the "add a
 *      method you did not think of" test, run over about forty verbs.
 *   3. An exhaustive sweep over a generated token space asserting the decision
 *      function is exactly `!SAFE`, checked against the independent literal
 *      rather than against `SAFE_METHODS`.
 *
 * There is also a guard on the guard: `SAFE_METHODS` being *empty* would make
 * every assertion in (2) pass, so the tests assert the safe list is non-empty
 * and strictly smaller than the denied table. An emptied allow-list fails.
 *
 * `TODO.md`'s "Do Not" list records the failure this is written against:
 * `DSN-05` read "done, verified by test" for a day while the page shipped at
 * 32px. A rule nothing measures reads exactly like a rule that is enforced.
 */

/**
 * Written here, not imported, on purpose.
 *
 * If this literal were `SAFE_METHODS` the comparison would be `x === x` and
 * would pass for any value whatsoever, including an empty set.
 */
const EXPECTED_SAFE = ['GET', 'HEAD', 'OPTIONS'] as const;

/**
 * Methods the guard's author had no reason to think of, collected by source.
 *
 * `SAFE_METHODS` contains three entries. Everything below is therefore a
 * method the guard had to get right *by construction* rather than by having
 * been remembered — which is the whole argument for an allow-list.
 */
const UNSAFE_METHODS: ReadonlyArray<readonly [string, string]> = [
  // RFC 9110 — the four the spec defines as unsafe.
  ['POST', 'RFC 9110 unsafe'],
  ['PUT', 'RFC 9110 unsafe'],
  ['PATCH', 'RFC 9110 unsafe'],
  ['DELETE', 'RFC 9110 unsafe'],
  // RFC 9110 §9.3.8 calls TRACE safe, and it is NOT in the allow-list. See the
  // long note on the guard; the short version is that TRACE is a known
  // cross-site tracing vector and nothing in EduFlow is a TRACE route.
  ['TRACE', 'RFC 9110 says safe; denied here anyway'],
  // RFC 5789
  ['CONNECT', 'RFC 5789'],
  // RFC 4918 (WebDAV)
  ['PROPFIND', 'RFC 4918'],
  ['PROPPATCH', 'RFC 4918'],
  ['MKCOL', 'RFC 4918'],
  ['COPY', 'RFC 4918'],
  ['MOVE', 'RFC 4918'],
  ['LOCK', 'RFC 4918'],
  ['UNLOCK', 'RFC 4918'],
  // RFC 3253 (versioning) — these carry a body and change state
  ['VERSION-CONTROL', 'RFC 3253'],
  ['CHECKOUT', 'RFC 3253'],
  ['CHECKIN', 'RFC 3253'],
  ['UNCHECKOUT', 'RFC 3253'],
  ['MKWORKSPACE', 'RFC 3253'],
  ['UPDATE', 'RFC 3253'],
  ['LABEL', 'RFC 3253'],
  ['REPORT', 'RFC 3253'],
  ['MKACTIVITY', 'RFC 3253'],
  ['MERGE', 'RFC 3253'],
  // RFC 3744
  ['ACL', 'RFC 3744'],
  // RFC 5842
  ['BIND', 'RFC 5842'],
  ['UNBIND', 'RFC 5842'],
  ['REBIND', 'RFC 5842'],
  // RFC 2068-adjacent link methods, still shipped by real proxies
  ['LINK', 'historic'],
  ['UNLINK', 'historic'],
  // Non-standard verbs seen on CDNs and caches
  ['PURGE', 'non-standard, real'],
  ['PROXY', 'non-standard, real'],
  // UPnP
  ['M-SEARCH', 'UPnP, real'],
  // Not real at all. The point is that the allow-list cannot be probed for
  // membership: an invented verb must be denied exactly like a real one.
  ['WAT', 'invented'],
  ['FOO', 'invented'],
  ['X-CUSTOM-THING', 'invented'],
];

/** Near-misses. Each must be denied, and each explains why. */
const NEAR_MISSES: ReadonlyArray<readonly [string, string]> = [
  // The allow-list is upper-case only, so a lower-case token is a *different*
  // token and is denied. Fail-closed: the cost of being wrong is a rejected
  // request, never an accepted forged one.
  ['get', 'case-folded'],
  ['Get', 'title-case'],
  ['OPTION', 'typo of OPTIONS'],
  ['HEADS', 'near-miss'],
  [' GET', 'leading space'],
  ['GET ', 'trailing space'],
  ['GET\n', 'trailing newline'],
  ['', 'empty'],
];

describe('CSRF_HEADER_NAME', () => {
  it('is a custom header name, not a CORS-safelisted one', () => {
    // This is the entire mechanism. A browser attaches cookies to a
    // cross-site request automatically, but it cannot attach a header that is
    // not CORS-safelisted without first passing a preflight — and an HTML form
    // cannot set any custom header at all. So the header is what forces the
    // request through a channel the attacker does not control.
    //
    // The CORS-safelisted request-header set is exactly: Accept,
    // Accept-Language, Content-Language, Content-Type (restricted to three
    // values) and Range. Anything outside it triggers a preflight.
    const safelisted = ['accept', 'accept-language', 'content-language', 'content-type', 'range'];

    expect(safelisted).not.toContain(CSRF_HEADER_NAME);
    expect(CSRF_HEADER_NAME).toMatch(/^x-[a-z0-9-]+$/);
  });

  it('is lower-case, because Node lower-cases incoming header names', () => {
    expect(CSRF_HEADER_NAME).toBe(CSRF_HEADER_NAME.toLowerCase());
  });
});

describe('isSafeMethod', () => {
  it('allows exactly the three methods the brief names', () => {
    // Compared against a literal written in this spec, not against the export,
    // so this can never degenerate into comparing the value with itself.
    expect([...SAFE_METHODS].sort()).toEqual([...EXPECTED_SAFE].sort());
  });

  it('is not empty', () => {
    // The guard on the guard. If the allow-list were emptied, every "denies
    // this unsafe method" test below would still pass, and the API would be
    // usable by cross-origin script. `TODO.md`: do not accept a done marker on
    // a rule that nothing measures.
    expect(SAFE_METHODS.size).toBeGreaterThan(0);
  });

  it('is strictly smaller than the denied table, so the table has teeth', () => {
    expect(UNSAFE_METHODS.length).toBeGreaterThan(SAFE_METHODS.size * 5);
  });

  it.each(EXPECTED_SAFE)('treats %s as safe', (method) => {
    expect(isSafeMethod(method)).toBe(true);
    expect(requiresCsrfHeader(method)).toBe(false);
  });

  it.each(UNSAFE_METHODS)('denies %s (%s)', (method) => {
    expect(isSafeMethod(method)).toBe(false);
    expect(requiresCsrfHeader(method)).toBe(true);
  });

  it.each(NEAR_MISSES)('denies the near-miss %j (%s)', (method) => {
    expect(isSafeMethod(method)).toBe(false);
  });

  it('agrees with the independent literal over an exhaustive token sweep', () => {
    // Not a table. A sweep over a token space with no method in it that the
    // allow-list and the literal disagree about, which is the property that
    // actually matters: there is no string an attacker can send that is treated
    // as safe without also being one of the three.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ-';
    const tokens = new Set<string>([...UNSAFE_METHODS.map(([m]) => m), ...EXPECTED_SAFE]);

    // All length-1 and length-2 tokens over the alphabet: 27 + 729.
    for (const a of alphabet) {
      tokens.add(a);
      for (const b of alphabet) tokens.add(a + b);
    }
    // Every real verb in the tables, plus case variants of the safe three.
    for (const method of EXPECTED_SAFE) {
      tokens.add(method.toLowerCase());
      tokens.add(method[0] + method.slice(1).toLowerCase());
    }

    const disagreements: string[] = [];
    for (const token of tokens) {
      const expected = (EXPECTED_SAFE as ReadonlyArray<string>).includes(token);
      if (isSafeMethod(token) !== expected) disagreements.push(token);
    }

    expect(
      disagreements,
      `these tokens are treated as safe by one source and unsafe by the other:\n  ${disagreements.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('isCsrfHeaderSatisfied', () => {
  it('is satisfied by a non-empty header value', () => {
    expect(isCsrfHeaderSatisfied('1')).toBe(true);
    expect(isCsrfHeaderSatisfied('anything')).toBe(true);
  });

  it('is not satisfied by an absent header', () => {
    expect(isCsrfHeaderSatisfied(undefined)).toBe(false);
  });

  it('is not satisfied by an empty or blank value', () => {
    // A header that is present but empty carries no more signal than no header.
    // Accepting it would make the check pass for a client that sends the name
    // with no value, which is exactly the shape a naive proxy or a
    // misconfigured SDK produces.
    expect(isCsrfHeaderSatisfied('')).toBe(false);
    expect(isCsrfHeaderSatisfied('   ')).toBe(false);
    expect(isCsrfHeaderSatisfied('\t')).toBe(false);
  });

  it('accepts a repeated header, which Node joins with a comma', () => {
    // Node delivers a duplicated non-special request header as one comma-joined
    // string. Treating that as absent would deny a legitimate client that
    // happens to send the header twice; the value is not the security property.
    expect(isCsrfHeaderSatisfied('1, 2')).toBe(true);
  });

  it('accepts the array form some adapters hand over', () => {
    expect(isCsrfHeaderSatisfied(['1', '2'])).toBe(true);
    expect(isCsrfHeaderSatisfied(['', ''])).toBe(false);
  });

  /**
   * Why no expected value is compared.
   *
   * The classic stronger design is a double-submit token: a random value in a
   * *script-readable* cookie, echoed back in the header and compared. It is not
   * used, and the reason is `D48`'s own first attribute. To compare a token the
   * browser must be able to read it, which means the token lives in a
   * non-`httpOnly` cookie — putting a credential back into reach of any XSS on
   * the web app to defend against a different attacker. The header here is a
   * channel test, not a credential, and a channel test does not need a value.
   */
  it('does not compare the value against anything', () => {
    expect(isCsrfHeaderSatisfied('1')).toBe(true);
    expect(isCsrfHeaderSatisfied('not-the-value-we-would-have-expected')).toBe(true);
  });
});

describe('the guard is wired, not merely written', () => {
  /**
   * `route-guards.decorator.ts` says plainly that its decorators are
   * "vocabulary, not the wall" because nothing enforces them yet. This control
   * is the opposite case — a guard that is written and not registered protects
   * nothing at all, and reads identically in review to one that is.
   *
   * So the registration is asserted against the source of `app.module.ts`.
   * Reading the text rather than booting Nest is deliberate: booting the module
   * to check a provider array would need a whole application context, and the
   * thing being checked is a literal.
   */
  it('is registered globally in app.module.ts', () => {
    // `fileURLToPath` rather than `url.pathname`, which is a percent-encoded
    // string on Windows and silently mangles a path with a space in it.
    //
    // `.ts`, not `.js`: the repository's `.js` extension on relative *imports*
    // is an ESM resolution convention for TypeScript sources, and it does not
    // apply to a path handed to the filesystem.
    const source = readFileSync(
      fileURLToPath(new URL('../../app.module.ts', import.meta.url)),
      'utf8',
    );

    expect(source, 'CsrfGuard is imported nowhere, so nothing enforces it').toContain('CsrfGuard');
    expect(source, 'CsrfGuard is imported but never provided').toContain('APP_GUARD');
  });

  it('allows OPTIONS so a CORS preflight is not blocked', () => {
    // A preflight is sent as OPTIONS with no custom headers, because the
    // browser has not been told yet whether it may send them. If OPTIONS were
    // denied, every cross-origin request would fail at the preflight instead
    // of at the guard — which is the same outcome for the attacker but a
    // useless diagnostic, and would also break legitimate reads.
    expect(isSafeMethod('OPTIONS')).toBe(true);
  });
});
