import { describe, expect, it } from 'vitest';

import { safeNextPath } from './safe-next-path';

/**
 * `PLT-1002` AC-3 — the open-redirect variants, one row each.
 *
 * Table-driven because this is a rule engine: each row is a rule and
 * its boundary, and a prose test per case would hide which rule moved
 * when one fails. The rows are grouped by the rule they exercise.
 */
describe('safeNextPath', () => {
  const FALLBACK = '/en/signed-in';

  describe('accepts the paths this app serves', () => {
    it.each([
      ['a plain in-app path', '/admin', '/admin'],
      ['a deep path', '/en/admin/users/42', '/en/admin/users/42'],
      ['a path with a query', '/admin?tab=fees', '/admin?tab=fees'],
      ['a path with a fragment', '/admin#fees', '/admin#fees'],
      // Browsers trim a URL before parsing it, so the trimmed form is
      // what would actually be requested.
      ['surrounding whitespace', '  /admin  ', '/admin'],
      // A double encoding decodes to a single-encoded slash, which is a
      // literal path character and not a separator.
      ['an encoded slash inside the path', '/admin%2Ffees', '/admin/fees'],
    ])('accepts %s', (_label, raw, expected) => {
      expect(safeNextPath(raw, FALLBACK)).toBe(expected);
    });
  });

  describe('refuses every absolute URL, by construction', () => {
    it.each([
      ['https', 'https://evil.example'],
      ['http', 'http://evil.example/admin'],
      // Scheme-relative: an absolute URL with the scheme inherited.
      ['protocol-relative', '//evil.example'],
      ['protocol-relative with a path', '//evil.example/admin'],
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:text/html,<script>alert(1)</script>'],
      ['a scheme-ish relative path', 'about:blank'],
    ])('refuses %s', (_label, raw) => {
      expect(safeNextPath(raw, FALLBACK)).toBe(FALLBACK);
    });
  });

  describe('refuses the normalisation attacks', () => {
    it.each([
      // Browsers normalise `/\` to `//` before the request leaves, so
      // the two forms are the same attack.
      ['backslash after the leading slash', '/\\evil.example'],
      ['encoded protocol-relative', '%2F%2Fevil.example'],
      ['encoded with a path', '%2F%2Fevil.example%2Fadmin'],
      // TAB/LF/CR are STRIPPED from a URL before parsing, so
      // `/%09/evil.example` parses as `//evil.example` — a
      // protocol-relative URL assembled from a string that passed the
      // leading-`//` check.
      ['a tab before the second slash', '/\t/evil.example'],
      ['a newline before the second slash', '/\n/evil.example'],
      ['a carriage return before the second slash', '/\r/evil.example'],
      ['an encoded tab', '/%09/evil.example'],
      ['an encoded newline', '/%0A/evil.example'],
      // A backslash anywhere else is an attempt to assemble `//`.
      ['a backslash in the middle', '/admin\\..\\evil'],
      ['an encoded backslash', '/admin%5C..%5Cevil'],
    ])('refuses %s', (_label, raw) => {
      expect(safeNextPath(raw, FALLBACK)).toBe(FALLBACK);
    });
  });

  describe('refuses what is not a string at all', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['the empty string', ''],
      ['whitespace only', '   '],
      // A malformed percent-escape is not a path this app produced, and
      // decoding it throws rather than yielding something checkable.
      ['a malformed escape', '/admin%zz'],
      ['a lone percent', '/admin%'],
    ])('refuses %s', (_label, raw) => {
      expect(safeNextPath(raw, FALLBACK)).toBe(FALLBACK);
    });
  });

  it('never returns the fallback for a valid path, whatever the fallback is', () => {
    // The two arguments are independent: a hostile `raw` must not be
    // able to influence WHICH fallback is used either.
    expect(safeNextPath('/admin', '')).toBe('/admin');
    expect(safeNextPath(undefined, '/ta/signed-in')).toBe('/ta/signed-in');
  });
});
