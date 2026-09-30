import { getTranslations } from 'next-intl/server';
import { LOCALE_DISPLAY_ORDER, type SupportedLocale } from '@eduflow/shared-types';

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
        {t('heroTitle')} <span className="grad">{t('heroTitleAccent')}</span>
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
        <LanguagePicker locale={locale as SupportedLocale} />
      </div>
    </nav>
  );
}

/**
 * The locale picker: a disclosure, not a popover.
 *
 * `<details>`/`<summary>` rather than a `<button>` and a scripted menu, and that
 * choice is the reason this control exists today at all. `AGENTS.md` 3.2.1 bans
 * raw `<button>`, and the shadcn `DropdownMenu` that would replace one does not
 * exist (`FIX-11`). `<summary>` is not a button element, so this satisfies the
 * rule rather than working around it — and it opens, closes, takes keyboard
 * focus and is announced as a disclosure by the browser, with **no JavaScript
 * at all**. A menu that needs hydration to appear is a worse degraded state than
 * one that is already there.
 *
 * What it does not do is close on an outside click. That is native behaviour,
 * and for a four-item language menu the cost is a second click on the trigger.
 *
 * Order comes from `LOCALE_DISPLAY_ORDER` in `@eduflow/shared-types` — English,
 * Sinhala, Tamil, Arabic — and deliberately not from `SUPPORTED_LOCALES`, which
 * is what the router and `generateStaticParams` iterate. Reordering that one for
 * a visual preference would change route generation everywhere.
 *
 * The trigger names the ACTIVE locale, not the first option, so the control
 * always tells you where you are. English leads the list and English is also
 * the default, which makes the two agree on first load without a special case.
 */
async function LanguagePicker({ locale }: { locale: SupportedLocale }) {
  const t = await getTranslations('language');
  const langLabel = t('label');

  const current = LOCALE_DISPLAY_ORDER.includes(locale as never) ? locale : 'en';

  return (
    <details className="landing-lang">
      <summary className="landing-lang-trigger">
        <span aria-hidden="true">🌐</span>
        {/* The visible label alone would make the trigger's accessible name
            "English", which does not say what the control does. The label
            prefix is for assistive tech only. */}
        <span className="sr-only">{langLabel}: </span>
        <span>{t(current)}</span>
      </summary>

      <div className="landing-lang-menu">
        <ul>
          {LOCALE_DISPLAY_ORDER.map((code) => (
            <li key={code}>
              <a
                data-testid="lang-option"
                href={`/${code}`}
                hrefLang={code}
                lang={code}
                aria-current={code === current ? 'page' : undefined}
              >
                <span>{t(code)}</span>
                <span className="code" aria-hidden="true">
                  {code.toUpperCase()}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
