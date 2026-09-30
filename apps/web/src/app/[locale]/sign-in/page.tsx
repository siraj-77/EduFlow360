import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import './sign-in.css';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * The sign-in route.
 *
 * WHY THIS PAGE EXISTS AND IS NOT A LOGIN FORM
 * --------------------------------------------
 * The landing page needs a way in — the template's topnav has a "Log in"
 * control, and a page with no route for a returning user is a dead end. But
 * **sign-in is `PLT-101`**, and nothing in this milestone authenticates anyone:
 * no session, no credential check, no API.
 *
 * So this route exists and says so. The alternative was a link to nothing, which
 * is a 404 on a school's front door and a worse first impression than the
 * sentence below. This is a *destination*, not a stub pretending to be a
 * feature: it states what is not yet available, in the visitor's own language,
 * and offers a way back.
 *
 * When `PLT-101` lands this file is replaced by the real form. The i18n keys it
 * uses are the ones the real screen will need, so the copy is not written twice.
 *
 * It reuses `app/[locale]/layout.tsx`, which is a document shell and nothing
 * else — no product copy, no landing styles — so the centred card here does not
 * inherit the hero's mesh gradient. The visual system is this file's own
 * `sign-in.css`, ported from the template's `.auth-card`.
 */
export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  const t = await getTranslations('signIn');

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">{t('title')}</h1>
        <p className="auth-sub">{t('subtitle')}</p>

        <p className="auth-notice" role="status">
          {t('notYet')}
        </p>

        <Link href={`/${locale}`} className="auth-action">
          {t('backToHome')}
        </Link>
      </div>
    </main>
  );
}
