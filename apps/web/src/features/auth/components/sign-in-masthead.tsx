import { getTranslations } from 'next-intl/server';

/**
 * The masthead above the form: who this is, what the screen is for.
 *
 * ## Why this is not `CardTitle`
 *
 * `CardTitle` renders an `<h3>`, which is right inside a page of cards and wrong
 * here: a sign-in screen has exactly one heading and it is the page's, so it is
 * an `<h1>`. `CardHeader` still does the layout work - the padding and the
 * `flex-col gap` - so nothing is given up but the level, which is the one thing
 * that has to be right.
 *
 * ## The identity line
 *
 * `app.name` is the product's own name and is identical in all four locales,
 * because a proper noun is not translated. It is set small, in `text-muted`, and
 * above the heading rather than beside it: it identifies the software, the
 * heading identifies the task, and they are not the same kind of information.
 *
 * The square before it is the landing page's dot, squared. A school's working
 * objects are ruled and boxed - a register, a mark sheet, a fee card - and the
 * landing page's soft dot belongs to that page's own language rather than to the
 * whole product. It carries the one brand colour this screen spends, alongside
 * the submit button.
 */
export async function SignInMasthead() {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-normal text-muted">
        <span aria-hidden="true" className="size-1.5 rounded-[2px] bg-brand" />
        {t('app.name')}
      </p>

      {/*
        `text-balance` because a heading that wraps to a ragged three lines in
        Tamil or Sinhala reads as a layout fault rather than as a heading, and
        `text-pretty` on the subtitle because the subtitle is the one paragraph
        that must not end on a single orphaned word - which is exactly what
        happens to it in Arabic at 320px.
      */}
      <h1 className="text-balance text-2xl leading-tight font-bold text-text">
        {t('signIn.title')}
      </h1>

      <p className="text-pretty text-sm leading-relaxed text-muted">{t('signIn.subtitle')}</p>
    </div>
  );
}
