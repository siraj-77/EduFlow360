import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { Card, CardContent, CardFooter, CardHeader } from '@eduflow/ui-kit';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * The forbidden page — the destination `RequirePermission`
 * sends a caller whose roles do not grant the route.
 *
 * ## Why the heading is `errors.forbidden` and not a new key
 *
 * The message already exists, in all four locales, for
 * exactly this answer. A second key saying the same thing
 * would be a translation to keep in step with the first
 * for no gain.
 *
 * ## Why the body is its own key
 *
 * The heading says WHAT happened; the body says what the
 * caller can do about it, which is ask the school's
 * administrator — the one role that can change a grant.
 * That sentence is new, so it lives under a `forbidden`
 * namespace of its own rather than being appended to the
 * shared `errors` block, which is reserved for one-line
 * answers.
 *
 * ## Why a card, and why an `<h1>`
 *
 * The sign-in screen is the precedent: a school's working
 * objects are ruled and boxed, so this page is a card too,
 * and it keeps the same shell (`min-h-dvh`, centred,
 * `max-w-sm`) so the two screens read as one product. The
 * heading is an `<h1>` because a forbidden page has
 * exactly one heading and it is the page's — `CardTitle`
 * renders an `<h3>`, which is right inside a page of cards
 * and wrong here.
 *
 * Note: `getTranslations`, not `useTranslations`. This is
 * an async Server Component, and next-intl forbids hooks
 * in one — the hook form throws at prerender time, not at
 * type-check time, so the build is where it shows.
 */
export default async function ForbiddenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="gap-3 p-6 pb-5">
            {/*
              `text-balance` because a heading that wraps to a
              ragged three lines in Tamil or Sinhala reads as a
              layout fault rather than as a heading.
            */}
            <h1 className="text-balance text-2xl leading-tight font-bold text-text">
              {t('errors.forbidden')}
            </h1>
          </CardHeader>

          <CardContent className="border-t border-border p-6">
            {/*
              `text-pretty` because the body is the one
              paragraph that must not end on a single
              orphaned word — which is exactly what happens
              to it in Arabic at 320px.
            */}
            <p className="text-pretty text-sm leading-relaxed text-muted">
              {t('forbidden.description')}
            </p>
          </CardContent>

          <CardFooter className="border-t border-border p-6 pt-4">
            {/*
              `replace` is not available on a plain anchor,
              but this is a navigation away from a page the
              caller may not see, and the browser's back
              button returning to it is the lesser of two
              problems: the route itself re-checks the
              permission on mount, so a stale copy shows a
              skeleton and redirects again rather than
              leaking content.
            */}
            <a
              href={`/${locale}`}
              className="text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              {t('forbidden.backToHome')}
            </a>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
