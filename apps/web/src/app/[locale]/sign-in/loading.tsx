import { Card, CardContent, CardFooter, CardHeader, Skeleton } from '@eduflow/ui-kit';

/**
 * The sign-in route's loading state.
 *
 * `AGENTS.md` 3.2.4 requires a `loading.tsx` per route and a `<Skeleton>` for
 * async data, and it is worth being precise about why this is *structural*
 * rather than a spinner: this route has no async data. Its one client island is
 * the form, which hydrates almost immediately, and the only thing that can delay
 * this screen is the server component that builds the masthead and footer
 * translations.
 *
 * So a spinner would be wrong twice over - it hides a delay that is not a fetch,
 * and it replaces content the visitor is about to read with a shape they then
 * watch change. A skeleton whose silhouette matches the card they are about to
 * see means the page does not jump when it arrives, and a screen-reader user is
 * told nothing at all: `Skeleton` is `aria-hidden`, which is the same rule that
 * keeps a decorative spinner from fighting a button's own label.
 *
 * The blocks follow the real card: masthead, two labelled fields, one button,
 * then the footer. Same `Card`, same padding - so the transition is content
 * arriving into a frame that never moved.
 */
export default function SignInLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Card className="relative overflow-hidden">
          <span aria-hidden="true" className="absolute inset-y-0 start-0 w-1 bg-brand" />

          <CardHeader className="gap-3 p-6 pb-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>

          <CardContent className="flex flex-col gap-5 border-t border-border p-6">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </CardContent>

          <CardFooter className="border-t border-border p-6 pt-4">
            <Skeleton className="h-4 w-32" />
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
