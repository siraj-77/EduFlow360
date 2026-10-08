import { Card, CardContent, CardFooter, CardHeader } from '@eduflow/ui-kit';

import { SignInForm } from '../components/sign-in-form';
import { SignInFooter } from '../components/sign-in-footer';
import { SignInMasthead } from '../components/sign-in-masthead';

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
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
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
          </CardContent>

          <CardFooter className="border-t border-border p-6 pt-4">
            <SignInFooter locale={locale} />
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
