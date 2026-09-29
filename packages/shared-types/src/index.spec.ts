import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, directionFor } from './index.js';

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
