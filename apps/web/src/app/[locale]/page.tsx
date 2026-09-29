import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * P2 placeholder page.
 *
 * The real dashboard arrives with the first feature module. This exists so
 * the locale routing, the shell and the i18n pipeline are demonstrably
 * working end to end before any domain code is written.
 *
 * Note: `getTranslations`, not `useTranslations`. This is an async Server
 * Component, and next-intl v3 forbids hooks in one -- the hook form throws
 * "useTranslations is not callable within an async component" at
 * prerender time, not at type-check time, so the build is where it shows.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (routing.locales.includes(locale as never)) setRequestLocale(locale as SupportedLocale);

  const t = await getTranslations('nav');

  return (
    <nav aria-label={t('dashboard')} className="flex flex-col gap-2">
      <span className="text-muted text-sm">
        {t('dashboard')} · {t('students')} · {t('staff')} · {t('academics')}
      </span>
    </nav>
  );
}
