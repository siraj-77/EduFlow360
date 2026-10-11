import { setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { ResetPasswordScreen } from '@/features/auth/pages/reset-password-screen';

/**
 * The reset-confirm route (`PLT-105` T2's screen).
 *
 * The token arrives in the query string — the emailed link carries
 * `?token=...` — and is read HERE, once, as a server component's `searchParams`.
 * It is passed down as a prop and never stored: it lives in the URL for one
 * redemption, and the store holds only the SHA-256.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  const { token } = await searchParams;

  return <ResetPasswordScreen locale={locale} token={token ?? ''} />;
}
