import { getTranslations } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';

/**
 * The hero.
 *
 * Ported from the template: mesh-gradient background, 42px grid overlay with a
 * radial mask, four drifting orbs, a badge with a pulsing dot, a heading whose
 * accent phrase sheens across the gradient, a glowing primary call to action,
 * and a product mockup in a window frame. The CSS is in `landing.css`.
 *
 * The mockup's chips carry LABELS AND NO FIGURES. The template filled them
 * with "1,482 students", "94.5% present", "$284,200 collected", "7 open
 * requests" and a "200+ / 1.2M / 99.9%" row. `AGENTS.md` 2.8 names two of
 * those as false, and D28 records what happens when a removed figure is
 * replaced with a different unverified one, so none was invented.
 *
 * `id="capabilities"` is the target of the second call to action.
 */
export async function Hero() {
  const t = await getTranslations('landing');

  const capabilities = ['kpiStudents', 'kpiAttendance', 'kpiFees', 'kpiLeave'] as const;

  return (
    <section className="landing-hero">
      <div className="landing-hero-bg" aria-hidden="true" />
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-orb landing-orb-1" aria-hidden="true" />
      <div className="landing-orb landing-orb-2" aria-hidden="true" />
      <div className="landing-orb landing-orb-3" aria-hidden="true" />
      <div className="landing-orb landing-orb-4" aria-hidden="true" />

      <p className="landing-badge">
        <span className="pulse" aria-hidden="true" />
        {t('badge')}
      </p>

      <h1>
        {t('heroTitle')}{' '}
        <span className="grad">{t('heroTitleAccent')}</span>
      </h1>

      <p data-testid="hero-sub" className="landing-hero-sub">
        {t('heroSub')}
      </p>

      <div className="landing-hero-cta">
        <a href="#features" className="landing-btn landing-btn-primary landing-btn-glow">
          {t('ctaFeatures')}
        </a>
        <a href="#capabilities" className="landing-btn landing-btn-ghost">
          {t('ctaCapabilities')}
        </a>
      </div>

      <div id="capabilities" className="landing-preview" aria-label={t('previewLabel')}>
        <div className="bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="body">
          {capabilities.map((key) => (
            <div key={key} className="chip">
              <small>{t(key)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The sticky top navigation.
 *
 * The template's version carries a language dropdown built from four
 * `<button>`s and a theme toggle that is also a `<button>`. `AGENTS.md` 3.2.1
 * bans raw `<button>`, and the shadcn primitives that would replace one do not
 * exist yet (`FIX-11`) — so:
 *
 *   - the language switcher is rebuilt as LINKS, which is what it is: a set of
 *     navigations. That satisfies 3.2.1 rather than circumventing it, and it is
 *     the reason this screen was buildable before the design system landed.
 *   - the theme toggle is OMITTED. A toggle has to be a button, and inventing
 *     one is `FIX-10`, which lands with shadcn. `ThemeScript` still honours
 *     `prefers-color-scheme` and a stored choice, so a dark-mode visitor is
 *     served correctly; they simply cannot flip it from this page yet.
 */
export async function TopNav({ locale }: { locale: string }) {
  const t = await getTranslations('language');
  const langLabel = t('label');
  // `getTranslations('auth')` returns a translator FUNCTION, not the messages
  // object. Calling `.signIn` on it is a type error, and because the page
  // fails to compile the whole route 500s — which is what happened the first
  // time. The key already exists in all four locales, so nothing new is needed.
  const authT = await getTranslations('auth');
  const signInLabel = authT('signIn');

  return (
    <nav className="landing-topnav">
      <span className="landing-brand">
        <span className="dot" aria-hidden="true" />
        EduFlow
      </span>

      <div className="landing-nav-right">
        <a href={`/${locale}/sign-in`} className="landing-btn landing-btn-ghost">
          {signInLabel}
        </a>
        <div className="landing-lang" aria-label={langLabel}>
          {SUPPORTED_LOCALES.map((code) => (
            <a
              key={code}
              href={`/${code}`}
              hrefLang={code}
              lang={code}
              aria-current={code === locale}
            >
              {t(code)}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
