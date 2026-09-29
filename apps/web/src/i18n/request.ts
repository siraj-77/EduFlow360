import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { messages } from '@eduflow/i18n-resources';

/**
 * Resolve the active locale and its messages.
 *
 * The locale comes from next-intl's routing, which validates against the
 * supported set -- so a hand-typed /xx path cannot produce a locale with
 * no resource file.
 *
 * AGENTS.md 4.2: "Never ship a silent English fallback in a non-English
 * locale." Enforced upstream by the key-parity test in
 * @eduflow/i18n-resources, which fails the build if any locale is missing
 * a key present in en.json.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: string = routing.locales.includes(requested as never)
    ? (requested as string)
    : routing.defaultLocale;

  return {
    locale,
    messages: messages[locale as keyof typeof messages],
  };
});
