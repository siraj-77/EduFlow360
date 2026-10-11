import { Card, CardContent, CardFooter, CardHeader } from '@eduflow/ui-kit';

import { SignInForm } from '../components/sign-in-form';
import { SignInFooter } from '../components/sign-in-footer';
import { SignInMasthead } from '../components/sign-in-masthead';
import { SignInSocialGrid } from '../components/sign-in-social-grid';
import { getTranslations } from 'next-intl/server';

/**
 * The sign-in screen.
 *
 * ## The visual idea, and why it is a register
 *
 * Every school's most characteristic object is a **register**: a ruled book with
 * a margin down one edge, column headings, and a class heading set above the
 * first line. So this card is built from the register's parts rather than from a
 * generic centred panel:
 *
 *   - the **spine** - a brand-coloured rule down the INLINE-START edge, running
 *     the full height of the card. It is the one deliberately bold element, and
 *     it is `border`/`start`-logical so it mirrors in Arabic instead of staying
 *     stubbornly on the left. Every other surface on this page is
 *     `surface`/`border`/`muted`.
 *   - **hairlines** between the masthead, the form and the footer. The card's
 *     shadow says "this is one object"; the rules say where one part ends and
 *     the next begins, which is what a register's rules do.
 *   - the **identity mark** as a small square rather than the landing page's
 *     soft dot, because the objects in a school are ruled and boxed.
 *
 * It is NOT the broadsheet look the hairlines could invite: the card keeps
 * `--radius-card` and `--shadow`, and it is one column, not dense columns of
 * text. The rules are structural - they separate regions that need separating -
 * rather than a texture.
 *
 * ## Why the spine and the submit button can share `--brand`
 *
 * `baseline-ui` suggests limiting accent usage to one per view. A 4px rule and a
 * filled primary button read as one accent *system* - a brand frame and the
 * action inside it - rather than as two unrelated highlights, and it is still a
 * single hue on a surface that is otherwise three neutrals. Splitting them would
 * cost either the rule its colour or the button its prominence, and the button
 * is not where this screen should be memorable.
 *
 * ## Why the card, not the layout shell
 *
 * `app/[locale]/layout.tsx` is the document shell and nothing else, so this page
 * brings its own surface rather than inheriting the landing page's mesh gradient.
 * A sign-in screen that shared the hero's animation budget would be a worse
 * screen: a burst of motion behind a form somebody is reading in a corridor.
 */
export async function SignInScreen({ locale }: { readonly locale: string }) {
  // A server component: the divider's label comes from the bundle through
  // getTranslations, not the client hook.
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        {/*
          The approved template's login card
          (`docs/template/EduFlow360_Template_Landing_Auth.html`): a heading,
          a sub-line, an alert slot, the form, the divider, the social grid
          and the footer — in that order. The visual language is the
          register's (spine, hairlines) the previous revision established,
          which is what this screen's tokens already are; the STRUCTURE is
          now the approved markup, so the screen stops drifting from the
          template the owner signed off.

          The "Remember me" checkbox is the one template element not
          reproduced: the API accepts no third field (`.strict()`) and has no
          persistent-session toggle, so the control would be a lie. Recorded
          in the form's header.
        */}
        <Card className="relative overflow-hidden">
          {/*
            The spine. `start-0` and `inset-y-0` are logical, so it sits on the
            right in Arabic with no second rule set - which is the difference
            between real RTL and the template's four `direction: rtl` declarations.
            `aria-hidden`: it is decoration carrying no information.
          */}
          <span
            aria-hidden="true"
            data-testid="sign-in-spine"
            className="absolute inset-y-0 start-0 w-1 bg-brand"
          />

          <CardHeader className="gap-3 p-6 pb-5">
            <SignInMasthead />
          </CardHeader>

          <CardContent className="border-t border-border p-6">
            <SignInForm locale={locale} />

            {/*
              The template's divider and social grid, below the form. The
              divider is a real separator, not a visual one: it marks where
              credential sign-in ends and federated sign-in begins.
            */}
            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wide text-muted">
                {t('auth.socialDivider')}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>

            <div className="mt-4">
              <SignInSocialGrid />
            </div>
          </CardContent>

          <CardFooter className="border-t border-border p-6 pt-4">
            <SignInFooter locale={locale} />
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
