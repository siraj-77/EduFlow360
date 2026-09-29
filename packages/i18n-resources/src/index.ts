import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type IntlMessages,
  type SupportedLocale,
} from '@eduflow/shared-types';
import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import si from './locales/si.json' with { type: 'json' };
import ta from './locales/ta.json' with { type: 'json' };

/**
 * @eduflow/i18n-resources
 *
 * AGENTS.md 2.8: "No hard-coded user-facing strings." All UI text goes
 * through these files.
 * AGENTS.md 4.2: "Strings added to en.json first, then ta.json, si.json,
 * ar.json. Never ship a silent English fallback in a non-English locale."
 *
 * The template in docs/template/ has 21 keys, all landing-page marketing
 * copy, and zero application keys -- so none of it was carried over. Every
 * key here is authored for the application.
 */

export const messages: Record<SupportedLocale, IntlMessages> = { en, ta, si, ar };

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
export type { SupportedLocale, IntlMessages };

/**
 * Flatten a nested resource object to dotted key paths.
 * `{ auth: { signIn } }` becomes `auth.signIn`.
 */
export function flattenKeys(input: unknown, prefix = ''): string[] {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [prefix];
  }

  return Object.entries(input as Record<string, unknown>)
    .flatMap(([key, value]) => flattenKeys(value, prefix ? `${prefix}.${key}` : key))
    .sort();
}

/** Every key present in a locale, as dotted paths. */
export function keysFor(locale: SupportedLocale): string[] {
  return flattenKeys(messages[locale]);
}

/**
 * Keys present in `locale` but missing from English.
 * A non-empty result is a build failure, not a warning: a missing key
 * means that locale silently falls back to English at runtime.
 */
export function missingKeysFor(locale: SupportedLocale): string[] {
  const reference = new Set(keysFor(DEFAULT_LOCALE));
  return keysFor(locale).filter((key) => !reference.has(key));
}
