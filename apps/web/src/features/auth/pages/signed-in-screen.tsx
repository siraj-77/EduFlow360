'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Spinner } from '@eduflow/ui-kit';

import { sendSignOut } from '../sign-out-request';
import type { SignOutOutcome } from '../sign-out-request';

/**
 * The interim authenticated landing — a place for a successful sign-in to go
 * before the app shell exists.
 *
 * ## Why it says what it says
 *
 * `PLT-EPIC-10` (the app shell) is unbuilt. Bouncing a freshly signed-in
 * user back to the public landing page is a lie by omission, so this screen
 * states the truth: the session works, the workspace is being built module by
 * module, and here is the way out. It is REPLACED by the shell, not extended.
 *
 * ## Who the screen does NOT name
 *
 * It does not show the account's email. Reading one would need a
 * `GET /auth/me` route that does not exist, and the session cookie names the
 * user only to the API. The screen therefore says "you are signed in" — which
 * is exactly what it can prove — rather than inventing an identity display.
 *
 * ## Why sign-out is not allowed to fail quietly
 *
 * The first version of this screen called `fetch('/auth/sign-out')` — a
 * root-relative URL, which resolves against THIS app's origin instead of the
 * API's — and ignored the response entirely. It redirected to the sign-in
 * screen and displayed "You have been signed out" for a request that never
 * reached the API, leaving the session row and the cookie live. On a shared
 * machine that is one Back-click from a session the user believed they had
 * ended.
 *
 * So the redirect is now EARNED. `sendSignOut` returns an outcome, and only
 * `signedOut` — the API's idempotent 200, which covers a live session and an
 * already-dead one alike — leaves this screen. Every other outcome keeps the
 * user here, says the sign-out did not work, and tells them the session is
 * still active. The request itself goes through `signOutEndpoint`, which is
 * built by `apiUrl`, so no call site can name a path the API does not serve.
 */
export function SignedInScreen({ locale }: { readonly locale: string }) {
  const t = useTranslations();
  const [signingOut, setSigningOut] = useState(false);
  const [outcome, setOutcome] = useState<SignOutOutcome | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const result = await sendSignOut();
      setOutcome(result);

      // Only a 200 means the session is ended. The API is idempotent, so a
      // caller with a dead cookie still gets one — which is why this is also
      // the only condition under which leaving the authenticated area is
      // truthful. Anything else keeps the user on a screen that tells them
      // the sign-out failed and their session is still live.
      if (result.kind === 'signedOut') {
        window.location.replace(`/${locale}/sign-in`);
      }
    } finally {
      setSigningOut(false);
    }
  };

  const failed = outcome !== null && outcome.kind !== 'signedOut';

  return (
    <main className="flex min-h-[calc(100vh-70px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[480px] rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow)]">
        <h1 className="text-[22px] font-semibold text-text">{t('signedIn.title')}</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">{t('signedIn.subtitle')}</p>

        <div role="status" aria-live="polite" className="mt-5">
          {outcome?.kind === 'signedOut' ? (
            <p className="rounded-control border border-ok bg-ok/5 px-3 py-2.5 text-sm font-medium text-ok">
              {t('signedIn.signedOut')}
            </p>
          ) : null}
          {failed ? (
            <p className="rounded-control border border-danger bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger">
              {t('signedIn.signOutFailed')}
            </p>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-text">{t('signedIn.body')}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            data-testid="signed-in-sign-out"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? (
              <>
                <Spinner className="size-4" />
                {t('signedIn.signingOut')}
              </>
            ) : (
              t('signedIn.signOut')
            )}
          </Button>

          <a href={`/${locale}`} className="text-sm font-medium text-brand hover:underline">
            {t('signedIn.backToHome')}
          </a>
        </div>
      </div>
    </main>
  );
}
