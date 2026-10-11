import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import { describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from './reset-password-form';

/**
 * The reset-confirm form (`PLT-105` T3's second screen).
 *
 * ## The one thing this form must never do: spend the token twice
 *
 * The API checks the password policy BEFORE it consumes the token, so a
 * caller who mistypes and retries still has a live link. This component's job
 * is to not WASTE that: a submit with mismatched fields is a client-side
 * refusal that never reaches the network, and the spec asserts no request
 * was sent.
 *
 * ## Why the two fields exist here and not on the server
 *
 * The mismatch check is the one that can be honest client-side — it compares
 * two strings the same person just typed. The policy check cannot: the policy
 * is the deployment's (`AGENTS.md` §2.14), lives on the API, and a client
 * copy would say "strong enough" about a password the server then refuses.
 * The refusal message says both.
 */

/**
 * The literal English strings the component renders, asserted directly.
 *
 * The same convention as `sign-in-form.spec.tsx`: what these tests check is
 * the association between label and control, and a test that read the bundle
 * would pass against a form whose labels are correct but unbound.
 */
const strings = {
  'auth.resetTitle': 'Choose a new password',
  'auth.newPassword': 'New password',
  'auth.confirmPassword': 'Repeat the new password',
  'auth.passwordMismatch': 'The two passwords do not match.',
  'auth.resetSubmit': 'Save new password',
  'auth.resetSaving': 'Saving…',
  'auth.resetSuccess': 'Your password has been changed. Sign in with your new password.',
  'auth.resetRefused':
    'That reset link is not valid, or the password does not meet this deployment’s policy. You can try again with the same link.',
  'auth.resetTokenMissing':
    'This page needs the token from your reset email. Open the link from the email again.',
};

const labels = {
  password: strings['auth.newPassword'],
  confirm: strings['auth.confirmPassword'],
  mismatch: strings['auth.passwordMismatch'],
  submit: strings['auth.resetSubmit'],
  saving: strings['auth.resetSaving'],
  success: strings['auth.resetSuccess'],
  refused: strings['auth.resetRefused'],
  tokenMissing: strings['auth.resetTokenMissing'],
};

const t = (key: string) => strings[key as keyof typeof strings] ?? key;

const renderWithLocale = (ui: React.ReactElement, locale: 'en' | 'ta' | 'si' | 'ar' = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );

/** Fill both fields and submit. Returns the submit spy. */
const fillAndSubmit = (password: string, confirmation: string, submit: () => void) => {
  fireEvent.change(screen.getByLabelText(labels.password), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(labels.confirm), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole('button', { name: labels.submit }));
  void submit;
};

describe('ResetPasswordForm', () => {
  it('refuses a mismatched pair without spending a request', () => {
    const submitted = vi.fn();
    renderWithLocale(<ResetPasswordForm labels={t} token="tok" onSubmit={submitted} locale="en" />);

    fillAndSubmit('a-new-sufficiently-long-password', 'a-different-long-password', () => undefined);

    // THE assertion: the token is not spent on a typo, because the API would
    // not spend it either (policy before consume) — but a request that never
    // happens cannot be throttled, logged as failed, or raced.
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText(labels.mismatch)).toBeDefined();
  });

  it('submits the matching pair', () => {
    const submitted = vi.fn();
    renderWithLocale(<ResetPasswordForm labels={t} token="tok" onSubmit={submitted} locale="en" />);

    fillAndSubmit(
      'a-new-sufficiently-long-password',
      'a-new-sufficiently-long-password',
      () => undefined,
    );

    expect(submitted).toHaveBeenCalledWith({
      token: 'tok',
      password: 'a-new-sufficiently-long-password',
    });
  });

  it('names the token it is redeeming, and no other state', () => {
    renderWithLocale(
      <ResetPasswordForm labels={t} token="the-token" onSubmit={vi.fn()} locale="en" />,
    );

    // The token travels in the body and nowhere visible: it is a credential,
    // and rendering it would put it in a screenshot and a DOM snapshot.
    expect(document.body.textContent).not.toContain('the-token');
  });

  it('explains the missing-token case instead of pretending', () => {
    // A reset link is a URL with `?token=`. A visitor who arrives without one
    // (a mailed link that lost its query, a copy-paste that dropped it) must
    // be told, not shown a form that cannot work.
    renderWithLocale(<ResetPasswordForm labels={t} token="" onSubmit={vi.fn()} locale="en" />);

    expect(screen.getByText(labels.tokenMissing)).toBeDefined();
    expect(screen.queryByLabelText(labels.password)).toBeNull();
  });

  it('shows the success sentence, and the honest refusal', async () => {
    // Rendered fresh per outcome rather than re-rendered: a state change is
    // what a navigation to this screen is (the outcome arrives as an initial
    // value), and a `rerender` cannot change a `useState` initialiser.
    const { unmount } = renderWithLocale(
      <ResetPasswordForm labels={t} token="tok" onSubmit={vi.fn()} locale="en" outcome="reset" />,
    );
    expect(await screen.findByText(labels.success)).toBeDefined();
    unmount();

    renderWithLocale(
      <ResetPasswordForm labels={t} token="tok" onSubmit={vi.fn()} locale="en" outcome="refused" />,
    );
    expect(await screen.findByText(labels.refused)).toBeDefined();
  });

  it('marks the form busy while it saves', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = vi.fn().mockImplementation(async () => {
      await gate;
    });

    renderWithLocale(<ResetPasswordForm labels={t} token="tok" onSubmit={slow} locale="en" />);
    fillAndSubmit(
      'a-new-sufficiently-long-password',
      'a-new-sufficiently-long-password',
      () => undefined,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: labels.saving })).toBeDefined();
    });
    release();
  });
});
