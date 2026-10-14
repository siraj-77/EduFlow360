'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Spinner } from '@eduflow/ui-kit';

import { AuthAlert } from './auth-alert';

/**
 * The forgot-password form (`PLT-105` T3's first screen), on the approved
 * template's card (`docs/template/EduFlow360_Template_Landing_Auth.html`).
 *
 * ## The one sentence, and why it is the only one
 *
 * On success the form shows the dictionary's own "If that email is
 * registered, a reset link is on its way." — a sentence that is true whether
 * or not an account exists. The API answers the same 200 in both branches, so
 * the screen cannot differ either; an attacker learning which addresses exist
 * is the thing both halves are built to prevent. The service spec holds the
 * wire side of the same rule.
 *
 * ## Why there is no second field
 *
 * The route takes exactly `{ email }`. A "confirm your email" field would be
 * a second field whose only failure mode is a typo the user can see — and a
 * second box on a screen whose purpose is one tap.
 */
export function ForgotPasswordForm({
  labels,
  onSubmit,
  locale,
  sent = false,
}: {
  readonly labels: (key: string) => string;
  readonly onSubmit: (email: string) => Promise<void>;
  readonly locale: string;
  readonly sent?: boolean;
}) {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentState, setSentState] = useState(sent);

  const submit = async () => {
    const trimmed = email.trim();
    if (trimmed.length === 0 || sending) return;

    setSending(true);
    try {
      await onSubmit(trimmed);
      setSentState(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      method="post"
      noValidate
      aria-busy={sending}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      {/*
        The alert slot the template's card carries. The template's
        `#forgotAlert` is in the markup at all times — `display:none` while
        empty — so this wrapper stays put and only the message inside it is
        conditional, which is also why the slot keeps the test hook and the
        message does not need one.

        The wrapper carries NO role: `AuthAlert` announces the message as a
        `status`, and a `role="status"` div holding a `role="status"`
        paragraph said the same sentence to a screen reader twice.
      */}
      <div data-testid="forgot-status">
        {sentState ? <AuthAlert tone="ok">{t('auth.resetRequestSent')}</AuthAlert> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium text-text">
          {labels('auth.email')}
        </label>
        <Input
          id="forgot-email"
          data-testid="forgot-email"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // 16px: iOS Safari zooms on any text field below it and does not
          // zoom back out.
          className="text-base"
          // The value is LTR even inside an RTL form: an address is a
          // left-to-right string, and inheriting `dir="rtl"` puts the `@` and
          // the TLD on the wrong end.
          dir="ltr"
          onChange={(event) => setEmail(event.target.value)}
          disabled={sending}
        />
      </div>

      <Button
        type="submit"
        variant="brand"
        data-testid="forgot-submit"
        disabled={sending}
        className="w-full"
      >
        {sending ? (
          <>
            <Spinner className="size-4" />
            {t('auth.sending')}
          </>
        ) : (
          t('auth.sendResetLink')
        )}
      </Button>

      <p className="text-center text-sm text-muted">
        <a href={`/${locale}/sign-in`} className="font-medium text-brand hover:underline">
          {t('auth.backToSignIn')}
        </a>
      </p>
    </form>
  );
}
