import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SUPPORTED_LOCALES, directionFor, type SupportedLocale } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { ThemeScript } from '@/components/theme-script';
import '../globals.css';

/**
 * Root layout for every locale.
 *
 * AGENTS.md 3.2.6 requires real RTL, not a landing page with four
 * `direction: rtl` rules. `dir` is set here on <html> from the resolved
 * locale, and every style below uses logical properties so the shell
 * mirrors without a second rule set.
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
  const t = await getTranslations();
  const dir = directionFor(locale as SupportedLocale);

  return (
    <html lang={locale} dir={dir} data-theme="" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="app-shell">
        <NextIntlClientProvider messages={messages}>
          {/*
            P2 shell: the app frame with no feature pages. A Sidebar
            becomes a Sheet drawer on mobile and full on lg:
            (AGENTS.md 3.2.2) — that arrives with the first feature
            module, not before.
          */}
          <main className="flex-1 p-6">
            <header>
              <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
              <p className="text-muted mt-1">{t('app.tagline')}</p>
            </header>
            <div className="mt-6">{children}</div>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
