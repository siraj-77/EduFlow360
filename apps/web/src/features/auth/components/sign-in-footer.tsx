import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LOCALE_DISPLAY_ORDER } from '@eduflow/shared-types';
import { ArrowBackIcon } from '@eduflow/ui-kit';

/**
 * Below the form: the way back, and the way to another language.
 *
 * ## Why the language switcher is here at all
 *
 * A visitor who types `/ar/sign-in` directly, or follows a link from an Arabic
 * page, arrives with no route back to any other language. `i18n/routing.ts` sets
 * `localePrefix: 'always'`, so every real route is locale-prefixed and there is
 * no negotiation to fall back on: the wrong language is a dead end rather than a
 * default. On a screen that exists to get someone INTO the product, being unable
 * to read it is the worst thing that can happen, so the fix is on this page
 * rather than on the landing page.
 *
 * ## Why links and not the shadcn `Select`
 *
 * A picker is a `<button>` and a popover; four navigations are links. Every
 * option here is a destination, so rendering them as links makes the control work
 * before this component hydrates - and it works with JavaScript off entirely,
 * which a popover does not. The landing page's disclosure has the same argument.
 *
 * `hrefLang` and `lang` are both set: `hrefLang` tells a crawler which locale the
 * destination is in, and `lang` tells the browser which font stack to use, which
 * for Tamil, Sinhala and Arabic is not the same question.
 *
 * Order comes from `LOCALE_DISPLAY_ORDER` (English, Sinhala, Tamil, Arabic) and
 * not from `SUPPORTED_LOCALES`, which is what the router and
 * `generateStaticParams` iterate - reordering that for a visual preference would
 * change route generation everywhere.
 */
export async function SignInFooter({ locale }: { readonly locale: string }) {
  const t = await getTranslations();
  const current = LOCALE_DISPLAY_ORDER.includes(locale as never) ? locale : 'en';

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/${locale}`}
        className="inline-flex min-h-[var(--touch-target-min)] items-center gap-2 self-start text-sm font-medium text-muted no-underline hover:text-text hover:underline"
      >
        {/*
          `ArrowBackIcon` is DIRECTIONAL and carries `rtl:rotate-180` in the
          ui-kit, so it points at the way back in both reading directions. This is
          the only glyph on the screen whose orientation a reader would notice
          being wrong, which is why the RTL test measures it: a single arrow used
          for both directions renders perfectly and reads backwards.
        */}
        <ArrowBackIcon className="size-4 shrink-0" />
        {t('signIn.backToHome')}
      </Link>

      <nav
        aria-label={t('signIn.localeSwitcherLabel')}
        className="flex flex-wrap items-center gap-x-1 gap-y-1"
      >
        {LOCALE_DISPLAY_ORDER.map((code) => {
          const isCurrent = code === current;

          return (
            <Link
              key={code}
              href={`/${code}/sign-in`}
              hrefLang={code}
              lang={code}
              aria-current={isCurrent ? 'page' : undefined}
              className={
                'inline-flex min-h-[var(--touch-target-min)] items-center rounded-control px-3 ' +
                'text-sm no-underline ' +
                (isCurrent
                  ? 'bg-brand/10 font-semibold text-brand'
                  : 'text-muted hover:bg-bg hover:text-text')
              }
            >
              {t(`language.${code}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
