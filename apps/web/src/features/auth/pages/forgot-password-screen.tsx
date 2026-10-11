'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForgotPasswordForm } from '../components/forgot-password-form';
import { sendPasswordResetRequest } from '../password-reset-request';

/**
 * The forgot-password screen (`PLT-105` T3), on the approved template's
 * card shape: a topnav with the brand, a centred card with a heading, a
 * sub-line, an alert slot, the form, and a way back.
 *
 * ## Why the screen owns the API base URL
 *
 * The service takes it as a parameter rather than importing it, so a future
 * same-origin deployment (`NEXT_PUBLIC_API_BASE_URL` unset) is a one-line
 * change here and not a change in the wire contract's tests.
 */
export function ForgotPasswordScreen({ locale }: { readonly locale: string }) {
  const t = useTranslations();
  const [sent, setSent] = useState(false);

  const onSubmit = async (email: string) => {
    const outcome = await sendPasswordResetRequest(email);

    // Only the 200 path is visible; every other outcome shows the SAME
    // status as success would, because the API answered the same way for a
    // registered address and an unknown one. A throttle message would be a
    // difference an attacker could measure — see the service spec.
    void outcome;
    setSent(true);
  };

  return (
    <main className="flex min-h-[calc(100vh-70px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow)]">
        <h1 className="text-[22px] font-semibold text-text">{t('auth.forgotPassword')}</h1>
        <p className="mt-1.5 mb-5 text-[13.5px] text-muted">{t('auth.resetSub')}</p>

        <ForgotPasswordForm
          labels={(key) => t(key)}
          onSubmit={onSubmit}
          locale={locale}
          sent={sent}
        />

        <p className="mt-5 text-center text-[13px] text-muted">
          <a href={`/${locale}/sign-in`} className="font-medium text-brand hover:underline">
            {t('auth.backToSignIn')}
          </a>
        </p>
      </div>
    </main>
  );
}
