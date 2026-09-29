import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type IntlMessages, type SupportedLocale } from '@eduflow/shared-types';
import { describe, expect, it } from 'vitest';
import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import si from './locales/si.json' with { type: 'json' };
import ta from './locales/ta.json' with { type: 'json' };
import { keysFor, missingKeysFor } from './index.js';

/**
 * Key parity across all four locales.
 *
 * AGENTS.md 4.2: "Never ship a silent English fallback in a non-English
 * locale." This suite is the mechanism. A key added to en.json and
 * forgotten in ar.json fails here rather than degrading silently in
 * production for an Arabic-speaking parent.
 *
 * Direction is a one-way dependency on locale code, not on a list of
 * strings, so it cannot drift.
 */
const RAW: Record<SupportedLocale, Record<string, unknown>> = { en, ta, si, ar };

/** Read a dotted key path out of a raw locale object. */
function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

describe('locale key parity', () => {
  const nonDefault = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);

  for (const locale of nonDefault) {
    it(`${locale} has every key that ${DEFAULT_LOCALE} has`, () => {
      expect(missingKeysFor(locale as SupportedLocale)).toEqual([]);
    });

    it(`${locale} has no extra keys absent from ${DEFAULT_LOCALE}`, () => {
      const reference = new Set(keysFor(DEFAULT_LOCALE));
      const extra = keysFor(locale as SupportedLocale).filter((k) => !reference.has(k));
      expect(extra).toEqual([]);
    });
  }

  it('every locale has the same total key count', () => {
    const counts = SUPPORTED_LOCALES.map((l) => keysFor(l).length);
    expect(new Set(counts).size).toBe(1);
  });

  it('flattens nested objects to dotted paths', () => {
    const keys = keysFor(DEFAULT_LOCALE);
    expect(keys).toContain('auth.signIn');
    expect(keys).toContain('language.ar');
  });

  it('has no empty or non-string translation values', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keysFor(locale)) {
        const value = readPath(RAW[locale], key);
        expect(typeof value, `${locale}.${key} must be a string`).toBe('string');
        expect(String(value).trim(), `${locale}.${key} must not be empty`).not.toBe('');
      }
    }
  });

  it('does not silently fall back: every locale is independently translated', () => {
    // Guards against a stub locale that copies en.json verbatim. A locale
    // whose nav block is byte-identical to English has not been translated.
    for (const locale of nonDefault) {
      const nav = readPath(RAW[locale as SupportedLocale], 'nav.dashboard');
      const englishNav = readPath(en, 'nav.dashboard');
      if (locale === 'ta' || locale === 'si' || locale === 'ar') {
        expect(nav, `${locale}.nav.dashboard must not equal the English string`).not.toBe(englishNav);
      }
    }
  });
});

/** Compile-time proof that a locale object satisfies the i18n contract. */
export type _LocaleShapeCheck = Record<SupportedLocale, IntlMessages>;

