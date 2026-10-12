import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { Card, CardContent, CardHeader } from '@eduflow/ui-kit';

/**
 * The console, as far as it exists until `PLT-1005` ports the shell.
 *
 * This is a placeholder with a job: it proves the guard. Everything
 * under `/admin` now requires a session AND the
 * `ADMIN_CONSOLE_ACCESS` permission — an anonymous caller is redirected
 * to sign-in by the middleware, and a signed-in caller without the key
 * is sent to the forbidden page by the layout's wrapper. This page is
 * what a caller who passes both gates sees, and it is REPLACED by the
 * shell, not extended, when the shell lands.
 *
 * It follows the `signed-in` screen's precedent — a centred card in the
 * product's own shell — so the two interim screens read as one product.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  const t = await getTranslations('admin.console');

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="gap-3 p-6 pb-5">
            <h1 className="text-balance text-2xl leading-tight font-bold text-text">
              {t('title')}
            </h1>
          </CardHeader>

          <CardContent className="border-t border-border p-6">
            <p className="text-pretty text-sm leading-relaxed text-muted">{t('description')}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
