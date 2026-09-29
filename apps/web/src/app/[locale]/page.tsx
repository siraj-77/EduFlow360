import { setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { LandingPage } from '@/features/landing/pages/landing-page';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * The landing page, for every locale.
 *
 * The product name and tagline moved into the hero — the template's own
 * hierarchy — rather than living in the layout. `layout.tsx` now renders only
 * the document shell: `<html lang dir>`, the pre-paint theme script, and the
 * i18n provider. That matters for more than tidiness: the layout is shared by
 * every future route, and a product name hard-coded into it would follow the
 * user into the dashboard, the sign-in screen and the 404 page.
 *
 * Note: `getTranslations`, not `useTranslations`. This is an async Server
 * Component, and next-intl v3 forbids hooks in one — the hook form throws
 * "useTranslations is not callable within an async component" at prerender
 * time, not at type-check time, so the build is where it shows.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (routing.locales.includes(locale as never)) setRequestLocale(locale as never);

  return <LandingPage />;
}
