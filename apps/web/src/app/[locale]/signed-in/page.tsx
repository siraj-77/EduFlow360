import { setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { SignedInScreen } from '@/features/auth/pages/signed-in-screen';

/**
 * The interim authenticated landing.
 *
 * ## Why this route exists at all
 *
 * A successful sign-in needs somewhere to go. The app shell
 * (`PLT-EPIC-10`) does not exist yet, and bouncing back to the public landing
 * page after a successful sign-in is a lie by omission: the person just proved
 * who they are and the page behaves as though nothing happened. So this
 * screen says the true thing — the session works, here is who it belongs to,
 * here is the way out — and it is REPLACED by the shell, not extended, when
 * the shell lands.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function SignedInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  return <SignedInScreen locale={locale} />;
}
