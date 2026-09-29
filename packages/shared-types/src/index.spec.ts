import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_DISPLAY_ORDER,
  SUPPORTED_LOCALES,
  directionFor,
} from './index.js';

describe('directionFor', () => {
  it('returns rtl for Arabic', () => {
    expect(directionFor('ar')).toBe('rtl');
  });

  it('returns ltr for every other launch locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'ar') continue;
      expect(directionFor(locale)).toBe('ltr');
    }
  });

  it('defaults to English, which is ltr', () => {
    expect(directionFor(DEFAULT_LOCALE)).toBe('ltr');
  });
});

/**
 * Display order is a separate contract from support.
 *
 * `SUPPORTED_LOCALES` is what `generateStaticParams`, the i18n router and the
 * middleware iterate, so it must not be reordered for a visual preference —
 * that would silently change route generation everywhere. The language picker
 * shows a different order, so the order gets its own constant and its own test.
 */
describe('LOCALE_DISPLAY_ORDER', () => {
  it('is English, Sinhala, Tamil, Arabic', () => {
    expect(LOCALE_DISPLAY_ORDER).toEqual(['en', 'si', 'ta', 'ar']);
  });

  it('covers exactly the supported locales, so no option is unreachable', () => {
    expect([...LOCALE_DISPLAY_ORDER].sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('has no duplicates', () => {
    expect(new Set(LOCALE_DISPLAY_ORDER).size).toBe(LOCALE_DISPLAY_ORDER.length);
  });

  it('starts with the default locale, so the picker opens on the active one', () => {
    expect(LOCALE_DISPLAY_ORDER[0]).toBe(DEFAULT_LOCALE);
  });
});
