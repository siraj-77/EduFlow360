import { getTranslations } from 'next-intl/server';

/** The page footer. */
export async function SiteFooter() {
  const t = await getTranslations('landing');

  return <footer className="landing-footer">{t('footer')}</footer>;
}
