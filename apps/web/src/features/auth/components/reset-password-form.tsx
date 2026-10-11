'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Spinner } from '@eduflow/ui-kit';

/**
 * The reset-confirm form (`PLT-105` T3's second screen), on the approved
 * template's card.
 *
 * ## The one thing this form must never do: spend the token twice
 *
 * The API checks the password policy BEFORE it consumes the token, so a
 * caller who mistypes and retries still has a live link. The mismatch check is
 * the one comparison that is honest client-side — two strings the same person
 * just typed — and a refusal that happens here is a request that never
 * reached the throttle, the log, or a race with a second tab.
 *
 * ## Why the policy is not checked here
 *
 * The policy is the deployment's (`AGENTS.md` §2.14) and lives on the API. A
 * client copy would say "strong enough" about a password the server then
 * refuses, and the sentence it produces would be wrong in a locale. The
 * refusal message names both possibilities instead.
 *
 * ## The token is never rendered
 *
 * It is a credential. It travels in the body and appears in no DOM node, so a
 * screenshot or a DOM snapshot carries nothing redeemable.
 */
export function ResetPasswordForm({
  labels,
  token,
  onSubmit,
  locale,
  outcome = null,
}: {
  readonly labels: (key: string) => string;
  /** The plaintext from the emailed link, or `''` when it is missing. */
  readonly token: string;
  readonly onSubmit: (params: {
    readonly token: string;
    readonly password: string;
  }) => Promise<void>;
  readonly locale: string;
  readonly outcome?: 'reset' | 'refused' | null;
}) {
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(outcome);

  if (token.length === 0) {
    // The honest answer for a link that lost its token. A form here would be
    // a form that cannot work, and a stranger would blame the school.
    return (
      <p
        role="alert"
        data-testid="reset-token-missing"
        className="rounded-control border border-danger bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger"
      >
        {t('auth.resetTokenMissing')}
      </p>
    );
  }

  const submit = async () => {
    if (saving) return;

    if (password !== confirmation) {
      // The client-side refusal, and the whole reason two fields exist.
      setMismatch(true);
      return;
    }

    setMismatch(false);
    setSaving(true);
    try {
      await onSubmit({ token, password });
      setResult('reset');
    } catch {
      // The service answers with outcomes rather than throwing; this catch is
      // the belt over the braces for a caller that ever does.
      setResult('refused');
    } finally {
      setSaving(false);
    }
  };

  if (result === 'reset') {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <p className="rounded-control border border-ok bg-ok/5 px-3 py-2.5 text-sm font-medium text-ok">
          {t('auth.resetSuccess')}
        </p>
        <a
          href={`/${locale}/sign-in`}
          className="text-center text-sm font-medium text-brand hover:underline"
        >
          {t('auth.backToSignIn')}
        </a>
      </div>
    );
  }

  return (
    <form
      method="post"
      noValidate
      aria-busy={saving}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div role="status" aria-live="polite" data-testid="reset-status">
        {result === 'refused' ? (
          <p className="rounded-control border border-danger bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger">
            {t('auth.resetRefused')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-password" className="text-sm font-medium text-text">
          {labels('auth.newPassword')}
        </label>
        <Input
          id="reset-password"
          data-testid="reset-password"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          maxLength={1024}
          className="text-base pe-14"
          dir="ltr"
          onChange={(event) => setPassword(event.target.value)}
          disabled={saving}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-confirm" className="text-sm font-medium text-text">
          {labels('auth.confirmPassword')}
        </label>
        <Input
          id="reset-confirm"
          data-testid="reset-confirm"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          maxLength={1024}
          className="text-base"
          dir="ltr"
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={saving}
          aria-invalid={mismatch}
        />
        {mismatch ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t('auth.passwordMismatch')}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        variant="brand"
        data-testid="reset-submit"
        disabled={saving}
        className="w-full"
      >
        {saving ? (
          <>
            <Spinner className="size-4" />
            {t('auth.resetSaving')}
          </>
        ) : (
          t('auth.resetSubmit')
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
