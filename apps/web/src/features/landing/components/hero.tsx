import { getTranslations } from 'next-intl/server';

/**
 * The hero.
 *
 * The gradient-accented heading is the template's signature move
 * (`docs/template/`), and the two halves are separate translation keys rather
 * than one string containing markup. The template stored
 * `"Run your entire school on<br><span class=\"grad\">one connected platform</span>"`
 * as a single value, which puts HTML inside a translation: untranslatable by
 * anyone who cannot read the tags, and impossible to restyle. Splitting it
 * keeps the visual and makes the copy translatable. (D45)
 *
 * WHY THE CTAS ARE IN-PAGE ANCHORS
 * -------------------------------
 * The template's CTAs were "Start Free Trial" and "Watch Demo". Both point
 * somewhere that does not exist: there is no trial (D2/D4 — one deployment per
 * school, sold on editions), no demo route, and no auth until `PLT-101`. A
 * landing page whose primary button 404s is worse than one that scrolls.
 *
 * So both call to action anchor to sections that are genuinely on the page. The
 * copy says what they do. When `/demo` and a real sign-in exist, these become
 * `next/link` and the copy changes with them — and the four-locale strings have
 * to change together, which is what the parity suite in
 * `packages/i18n-resources` is for.
 *
 * Plain `<a>`, not `next/link`: these are same-document fragments, so there is
 * no client-side navigation to do, and `AGENTS.md` 3.2.1's ban on raw
 * `<button>` is not implicated. That ban is also why this screen is buildable
 * before `FIX-11` lands shadcn at all — there is no button on it.
 */
export async function Hero() {
  const t = await getTranslations('landing');

  return (
    <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-12 text-center">
      <p className="border-border text-muted inline-block rounded-full border px-4 py-1 text-sm">
        {t('badge')}
      </p>

      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {t('heroTitle')}{' '}
        <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
          {t('heroTitleAccent')}
        </span>
      </h1>

      <p
        data-testid="hero-sub"
        className="text-muted mx-auto mt-4 max-w-2xl text-lg text-pretty"
      >
        {t('heroSub')}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#features"
          className="bg-brand text-surface rounded-control px-5 py-3 font-medium hover:opacity-90"
        >
          {t('ctaFeatures')}
        </a>
        <a
          href="#capabilities"
          className="border-border text-text rounded-control border px-5 py-3 font-medium hover:bg-surface"
        >
          {t('ctaCapabilities')}
        </a>
      </div>
    </section>
  );
}
