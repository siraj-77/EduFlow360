import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { RequirePermission } from '@/features/rbac/components/require-permission';
import { PermissionsProvider } from '@/features/rbac/hooks/use-permissions';
import { AdminShell } from '@/features/admin-shell/components/admin-shell';
import { Card, CardContent, CardHeader } from '@eduflow/ui-kit';

export function generateStaticParams() {
  const locales = SUPPORTED_LOCALES.length ? SUPPORTED_LOCALES : routing.locales.map((l) => l as SupportedLocale);
  return locales.map((locale) => ({ locale }));
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  const t = await getTranslations('admin.console');

  return (
    <PermissionsProvider>
      <RequirePermission permission="ADMIN_CONSOLE_ACCESS">
        <AdminShell
          sidebar={<nav aria-label="primary navigation" className="admin-shell-sidebar" data-testid="admin-shell-sidebar" />}
        >
          <main className="admin-main-content">
            <Card>
              <CardHeader className="gap-3 p-6 pb-5">
                <h1 className="text-balance text-2xl leading-tight font-bold text-text">{t('title')}</h1>
              </CardHeader>
              <CardContent className="border-t border-border p-6">
                <p className="text-pretty text-sm leading-relaxed text-muted">{t('description')}</p>
              </CardContent>
            </Card>
          </main>
        </AdminShell>
      </RequirePermission>
    </PermissionsProvider>
  );
}
