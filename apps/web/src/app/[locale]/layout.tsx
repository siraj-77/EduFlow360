import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SUPPORTED_LOCALES, directionFor, type SupportedLocale } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { ThemeScript } from '@/components/theme-script';
import '../globals.css';

/**
 * Root layout for every locale.
 *
 * This is the document shell and nothing else: `<html lang dir>`, the pre-paint
 * theme script, and the i18n provider. It carries no product copy, because it is
 * shared by every route — a tagline here would follow the user into the
 * dashboard, the sign-in screen and the 404 page. Page content belongs to the
 * page.
 *
 * AGENTS.md 3.2.6 requires real RTL, not a landing page with four
 * `direction: rtl` rules. `dir` is set here on <html> from the resolved locale,
 * and every style below uses logical properties so the shell mirrors without a
 * second rule set. The template mirrored a landing page with exactly those four
 * rules and called it RTL; app-shell RTL is built from scratch instead.
 *
 * AGENTS.md 3.2.5 requires `data-theme` before first paint, which is why
 * ThemeScript is rendered inside <head> rather than in the body.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = directionFor(locale as SupportedLocale);

  return (
    <html lang={locale} dir={dir} data-theme="" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
