import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages as bundle } from '@eduflow/i18n-resources';
import { describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from './forgot-password-form';

/**
 * The forgot-password form (`PLT-105` T3's first screen).
 *
 * ## Why the screen shows no difference between "sent" and "unknown address"
 *
 * The API answers the same 200 either way, and the screen must too: the only
 * sentence this form ever shows on success is the dictionary's own "If that
 * email is registered, a reset link is on its way." — true in both branches.
 * The alternative is a screen that tells an attacker which addresses exist.
 *
 * The service spec (`password-reset-request.spec.ts`) holds the same rule on
 * the wire side; this spec holds it on the visible side.
 */

/**
 * The literal English strings the component renders, asserted directly.
 *
 * The same convention as `sign-in-form.spec.tsx` ("by label text and in
 * English on purpose"): the label ASSOCIATION is what these tests check, and
 * a test that reads the bundle would pass against a form whose labels are
 * correct but unbound. The bundle's own gate (`i18n-resources`' spec) is what
 * keeps the four locales in step.
 */
const labels = {
  email: 'Email address',
  submit: 'Send reset link',
  submitting: 'Sending…',
  sent: 'If that email is registered, a reset link is on its way.',
};

/** Keyed by the FULL dotted path, because that is what the component passes. */
const strings = {
  'auth.email': labels.email,
  'auth.sendResetLink': labels.submit,
  'auth.sending': labels.submitting,
  'auth.resetRequestSent': labels.sent,
};

const t = (key: string) => strings[key as keyof typeof strings] ?? key;

/** The same provider the sign-in spec uses, so the i18n keys resolve. */
const renderWithLocale = (ui: React.ReactElement, locale: 'en' | 'ta' | 'si' | 'ar' = 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={bundle[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );

describe('ForgotPasswordForm', () => {
  it('renders the template card: one field, one submit, one status slot', () => {
    renderWithLocale(<ForgotPasswordForm labels={t} onSubmit={vi.fn()} locale="en" />);

    expect(screen.getByLabelText(labels.email)).toBeDefined();
    expect(screen.getByRole('button', { name: labels.submit })).toBeDefined();
    expect(screen.getByTestId('forgot-status')).toBeDefined();
  });

  it('submits the trimmed email', () => {
    const submitted = vi.fn();
    renderWithLocale(<ForgotPasswordForm labels={t} onSubmit={submitted} locale="en" />);

    fireEvent.change(screen.getByLabelText(labels.email), {
      target: { value: '  teacher@school.lk ' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.submit }));

    expect(submitted).toHaveBeenCalledWith('teacher@school.lk');
  });

  it('refuses an empty submit without asking the server', () => {
    const submitted = vi.fn();
    renderWithLocale(<ForgotPasswordForm labels={t} onSubmit={submitted} locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: labels.submit }));

    expect(submitted).not.toHaveBeenCalled();
  });

  it('shows the SAME sentence on success, whatever the server knew', async () => {
    // The enumeration defence, visible. A screen that answered differently
    // for an unknown address would be a screen that leaks.
    renderWithLocale(<ForgotPasswordForm labels={t} onSubmit={vi.fn()} locale="en" sent />);

    expect(await screen.findByText(labels.sent)).toBeDefined();
  });

  it('marks the form busy while it submits, and disables its controls', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = vi.fn().mockImplementation(async () => {
      await gate;
    });

    renderWithLocale(<ForgotPasswordForm labels={t} onSubmit={slow} locale="en" />);
    fireEvent.change(screen.getByLabelText(labels.email), { target: { value: 'a@school.lk' } });
    fireEvent.click(screen.getByRole('button', { name: labels.submit }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: labels.submitting })).toBeDefined();
    });
    expect(
      (screen.getByRole('button', { name: labels.submitting }) as HTMLButtonElement).disabled,
    ).toBe(true);

    release();
  });
});
