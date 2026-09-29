import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@eduflow/shared-types';

/**
 * Locale routing.
 *
 * The supported set is imported from @eduflow/shared-types rather than
 * re-listed, so it cannot drift from the resource files. A locale with no
 * resource file would be a silent English fallback, which AGENTS.md 4.2
 * forbids -- so there is exactly one place to add a locale.
 */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Prefix every path, including the default locale, so /ar is a
  // first-class route and the RTL shell is reachable without a redirect.
  localePrefix: 'always',
});
