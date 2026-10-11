import { describe, expect, it } from 'vitest';
import {
  CANONICALISATION_VERSION,
  canonicalise,
  canonicaliseLicenceMaterial,
} from './canonical-json.js';

/**
 * The canonicalisation function `ADR-009` specifies — and the reason it is
 * specified rather than inherited.
 *
 * ## The failure this function exists to prevent
 *
 * A signature over non-canonical JSON is a signature over one particular byte
 * sequence. `{"a":1,"b":2}` and `{"b":2,"a":1}` are the same licence and
 * different bytes, so a verifier that re-serialises the way `JSON.stringify`
 * happens to today can (a) reject a valid licence because the signer ordered
 * keys differently, or (b) far worse, accept a RE-serialised payload that
 * verifies while carrying different semantics than the one signed. `ADR-009`
 * rejected both, and this file is its answer: one function, specified line by
 * line, versioned, and frozen once certificates exist in the field.
 *
 * ## The rules, stated so an implementer in another language can match them
 *
 *  1. Object keys are sorted by UTF-16 code-unit order (JavaScript's default
 *     `Array.prototype.sort` on strings — the same order JCS specifies).
 *  2. No insignificant whitespace: no spaces after `:` or `,`; none at all.
 *  3. Numbers use ECMAScript's own number-to-string (`JSON.stringify`'s), the
 *     only number serialisation that is deterministic ACROSS IMPLEMENTATIONS
 *     of JSON because it is defined by ECMA-262. Shortest round-tripping
 *     form: `1.0` is `1`, `1e21` is `1e+21`.
 *  4. Strings escape exactly what RFC 8259 requires — `\"`, `\\`, and the C0
 *     controls (`\b \t \n \f \r` shorthand, others `\u00xx`) — and nothing
 *     else. No `\u00e9` for `é`, no non-ASCII escaping of any kind.
 *  5. `undefined`, functions and symbols are not JSON. A number must be
 *     finite: `NaN`, `Infinity` and `-Infinity` have no JSON form, and a
 *     licence carrying one is refused rather than silently coerced.
 */

describe('canonicalise — the rules, one test each', () => {
  it('sorts object keys, which is the whole point', () => {
    // The ADR's mandatory test #1 comes from the other side (reordering a
    // PAYLOAD does not break a signature — see the licence-material suite).
    // This is the same property seen from here: the canonical form is a
    // function of the value, not of the order the keys were written in.
    expect(canonicalise({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalise({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });

  it('sorts nesting too, and at every depth', () => {
    expect(canonicalise({ z: { d: 1, c: 2 }, a: [{ y: 1, x: 2 }] })).toBe(
      '{"a":[{"x":2,"y":1}],"z":{"c":2,"d":1}}',
    );
  });

  it('emits no insignificant whitespace', () => {
    // `JSON.stringify(x, null, 2)` is what a naive implementation does, and
    // it is the most common way the two sides of a signature disagree.
    expect(canonicalise({ a: [1, 2], b: { c: 3 } })).toBe('{"a":[1,2],"b":{"c":3}}');
  });

  it('uses ECMAScript number formatting, the deterministic one', () => {
    // Shortest round-tripping form. `1.0` is `1` because that is what
    // round-trips; `1e21` keeps the exponent because `1e+21` is what ECMA-262
    // produces below 1e-6 and above 1e21.
    expect(canonicalise(1.0)).toBe('1');
    expect(canonicalise(1e21)).toBe('1e+21');
    expect(canonicalise(-0)).toBe('0');
  });

  it('escapes exactly what JSON requires and nothing else', () => {
    // A verifier that escaped non-ASCII would produce different bytes from a
    // signer that did not — the cross-language drift the ADR names.
    expect(canonicalise('é')).toBe('"é"');
    expect(canonicalise('a"b\\c\nd\te')).toBe('"a\\"b\\\\c\\nd\\te"');
    expect(canonicalise('\u0001')).toBe('"\\u0001"');
  });

  it('keeps arrays ordered, because an array in a licence is a sequence', () => {
    // Sorting keys must not sort arrays: `allowed_modules` is a list whose
    // order carries no meaning, but a limits list or a range does.
    expect(canonicalise([3, 1, 2])).toBe('[3,1,2]');
  });

  it('refuses the non-JSON values rather than coercing them', () => {
    // `JSON.stringify({ a: undefined })` DROPS the key, which would sign a
    // different object than the caller meant. A refusal is a 500 at signing
    // time; a silent drop is a licence that means something else.
    expect(() => canonicalise({ a: undefined })).toThrow(/cannot represent/);
    expect(() => canonicalise({ a: () => 'x' })).toThrow(/cannot represent/);
    expect(() => canonicalise(NaN)).toThrow(/non-finite number/);
    expect(() => canonicalise(Infinity)).toThrow(/non-finite number/);
  });

  it('refuses a cyclic value, which JSON cannot serialise at all', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    expect(() => canonicalise(cyclic)).toThrow();
  });

  it('is a fixed point: canonical text parses and re-canonicalises to itself', () => {
    // The property that makes the function usable at all: once canonical, it
    // stays canonical. A round-trip that changes anything means the format is
    // not what it claims to be.
    const value = {
      edition: 'STANDARD',
      limits: { users: 100 },
      modules: ['academics', 'finance'],
    };
    const once = canonicalise(value);

    expect(canonicalise(JSON.parse(once))).toBe(once);
  });
});

describe('canonicaliseLicenceMaterial — the signed object', () => {
  it('names the canonicalisation version inside the signed bytes', () => {
    // ADR-009: the version is part of the signed material, so the scheme can
    // change later without invalidating historical certificates — and so a
    // verifier cannot be talked into the wrong scheme by an unversioned blob.
    const material = canonicaliseLicenceMaterial({ edition: 'BASIC' });

    expect(material).toContain(`"canonicalisationVersion":${CANONICALISATION_VERSION}`);
  });

  it('does not sign the signature or the envelope around it', () => {
    // The signature field itself must not be inside the signed bytes (that is
    // circular), and the envelope's other metadata (key_id) travels beside
    // the signed material, not inside it — otherwise choosing a key would
    // change the message the key signs.
    const material = canonicaliseLicenceMaterial({ edition: 'BASIC' });

    expect(material).not.toContain('signature');
    expect(material).not.toContain('keyId');
  });
});
