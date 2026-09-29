import { DEFAULT_LOCALE, SUPPORTED_LOCALES, directionFor } from '@eduflow/shared-types';
import { describe, expect, it } from 'vitest';

/**
 * The RTL contract (AGENTS.md 3.2.6).
 *
 * The frontend template mirrored a landing page with four CSS rules. The
 * app shell is built from scratch instead, and `dir` comes from the locale
 * rather than from a stylesheet. These tests are the mechanism: if someone
 * hard-codes dir="ltr", or adds a locale without deciding its direction,
 * this fails.
 */
describe('locale direction', () => {
  it('covers every supported locale', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(4);
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('renders Arabic right-to-left', () => {
    expect(directionFor('ar')).toBe('rtl');
  });

  it('renders the LTR locales left-to-right', () => {
    for (const locale of ['en', 'ta', 'si'] as const) {
      expect(directionFor(locale)).toBe('ltr');
    }
  });

  it('exposes a direction for every locale, with no gaps', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(['ltr', 'rtl']).toContain(directionFor(locale));
    }
  });
});
