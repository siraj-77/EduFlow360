/**
 * @eduflow/shared-types
 *
 * Cross-app contracts. The web app, the API and (from milestone 2) the
 * mobile app all speak these types, so a mismatch here is a compile
 * error in three places rather than a production bug in one.
 *
 * Nothing in this package may import a framework, an ORM, or a UI
 * library. It is a contract, not an implementation.
 */

/** The four launch locales. Arabic is RTL; the other three are LTR. */
export const SUPPORTED_LOCALES = ['en', 'ta', 'si', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** English is the default. AGENTS.md section 1. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export type Direction = 'ltr' | 'rtl';

/**
 * The shape of a locale resource file.
 *
 * Structurally compatible with next-intl's `AbstractIntlMessages`, which
 * is why `messages[locale]` is assignable to it without a cast. Typed
 * here rather than as `Record<string, unknown>`, because `unknown` is
 * NOT assignable to `string | AbstractIntlMessages` and the mismatch
 * would otherwise need an unsafe cast at the i18n boundary.
 */
export interface IntlMessages {
  readonly [key: string]: string | IntlMessages;
}


/**
 * Arabic is the only RTL locale at launch (Master Plan 5.3).
 * Derived rather than duplicated, so adding a locale is one edit.
 */
export function directionFor(locale: SupportedLocale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Product editions. Gating is by FEATURE KEY, never by edition name (ADR-009). */
export const EDITIONS = ['Basic', 'Standard', 'Deluxe', 'Enterprise'] as const;
export type Edition = (typeof EDITIONS)[number];

/** A money amount. Integer minor units + explicit currency. Never a float (ADR-002). */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: string;
}

/** Severity levels written to the structured log and the DB error log. */
export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * The stable error-code contract returned to clients.
 * Mapped by one global exception filter; never leaks a stack trace (Prompt Pack P4).
 */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlationId: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}
