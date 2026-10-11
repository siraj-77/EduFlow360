'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SocialButtons } from './social-buttons';

/**
 * The social grid as the sign-in screen needs it.
 *
 * A client component because two of its behaviours are: the Google
 * navigation (a `window.location.assign`) and the not-configured message (a
 * state-driven `role="alert"` rather than a `window.alert`, which a screen
 * reader would never announce and a browser can suppress entirely).
 *
 * ## The message, not a dialog
 *
 * `window.alert` would be three lines of code and wrong: it is not
 * announced, it is not translated by the page's own mechanism, and most
 * browsers allow suppressing it. The message appears in the card's alert
 * slot instead — the same slot the form's refusals use.
 */
export function SignInSocialGrid() {
  const t = useTranslations();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div role="status" aria-live="polite" data-testid="social-status">
        {message === null ? null : (
          <p className="rounded-control border border-danger bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger">
            {message}
          </p>
        )}
      </div>

      <SocialButtons
        labels={(key) => t(key)}
        googleHref={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/auth/oidc/redirect`}
        onGoogleClick={() => setMessage(null)}
        onUnconfigured={(provider) => setMessage(`${provider} ${t('auth.socialNotConfigured')}`)}
      />
    </div>
  );
}
