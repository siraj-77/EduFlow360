'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ResetPasswordForm } from '../components/reset-password-form';
import { sendPasswordResetConfirm } from '../password-reset-confirm';

/**
 * The reset-confirm screen (`PLT-105` T3), on the approved template's card.
 *
 * The token arrives from the route (the emailed link's query string) and is
 * passed straight into the form, which never renders it.
 */
export function ResetPasswordScreen({
  locale,
  token,
}: {
  readonly locale: string;
  readonly token: string;
}) {
  const t = useTranslations();
  const [outcome, setOutcome] = useState<'reset' | 'refused' | null>(null);

  const onSubmit = async (params: { readonly token: string; readonly password: string }) => {
    const result = await sendPasswordResetConfirm(params);

    // The service collapses the two 400s into one refusal, and this screen
    // shows one sentence that covers both honestly: the link may still be
    // good if the password was too weak, and the API did not spend it.
    setOutcome(result.kind === 'reset' ? 'reset' : 'refused');
  };

  return (
    <main className="flex min-h-[calc(100vh-70px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow)]">
        <h1 className="text-[22px] font-semibold text-text">{t('auth.resetTitle')}</h1>
        <p className="mt-1.5 mb-5 text-[13.5px] text-muted">{t('auth.resetSub')}</p>

        <ResetPasswordForm
          labels={(key) => t(key)}
          token={token}
          onSubmit={onSubmit}
          locale={locale}
          outcome={outcome}
        />
      </div>
    </main>
  );
}
