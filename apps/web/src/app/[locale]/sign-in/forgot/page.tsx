import { setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { ForgotPasswordScreen } from '@/features/auth/pages/forgot-password-screen';

/**
 * The forgot-password route (`PLT-105` T1's screen).
 *
 * The same contract shape as the sign-in route: thin, locale-resolving, and
 * composed from the feature's screen. The backend route
 * (`POST /auth/password-reset/request`) answers a constant 200 whether or
 * not the address exists, and this screen's copy is the dictionary's own
 * "If that email is registered, a reset link is on its way." — true in both
 * branches.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  return <ForgotPasswordScreen locale={locale} />;
}
