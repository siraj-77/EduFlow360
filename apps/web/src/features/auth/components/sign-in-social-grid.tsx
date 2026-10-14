'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { AuthAlert } from './auth-alert';
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
      {/*
        The card's alert slot, always present and hidden while empty — the
        same shape `forgot-password-form.tsx` and `reset-password-form.tsx`
        use, for the same reason: the template's alert element is in the
        markup at all times. It carries no role; `AuthAlert` announces, and
        a wrapper with the same role announced it twice.

        This slot used to hold a hand-written copy of the class list while
        the other three alert sites moved to `AuthAlert`, which is how a
        shared component gets bypassed. `sign-in-social-grid.spec.tsx` pins
        it shut.
      */}
      <div data-testid="social-status">
        {message === null ? null : <AuthAlert tone="error">{message}</AuthAlert>}
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
