import { getTranslations } from 'next-intl/server';

/** The page footer. The only chrome on the screen that is not the hero. */
export async function SiteFooter() {
  const t = await getTranslations('landing');

  return (
    <footer className="border-border border-t">
      <div className="text-muted mx-auto w-full max-w-5xl px-6 py-8 text-center text-sm">
        {t('footer')}
      </div>
    </footer>
  );
}
