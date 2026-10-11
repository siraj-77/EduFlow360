'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Spinner } from '@eduflow/ui-kit';

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
 */
export function SignedInScreen({ locale }: { readonly locale: string }) {
  const t = useTranslations();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/auth/sign-out', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-eduflow-csrf': 'eduflow-web',
        },
        // Required: the session cookie is the credential being revoked, and
        // without `include` the request carries none of it.
        credentials: 'include',
        body: '{}',
      });

      // The revoke is server-side first and the cookie clear is the API's
      // job; this screen then replaces itself with the sign-in route so a
      // Back cannot resurrect a signed-in page.
      setSignedOut(true);
      window.location.replace(`/${locale}/sign-in`);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-70px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[480px] rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow)]">
        <h1 className="text-[22px] font-semibold text-text">{t('signedIn.title')}</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">{t('signedIn.subtitle')}</p>

        <div role="status" aria-live="polite" className="mt-5">
          {signedOut ? (
            <p className="rounded-control border border-ok bg-ok/5 px-3 py-2.5 text-sm font-medium text-ok">
              {t('signedIn.signedOut')}
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
