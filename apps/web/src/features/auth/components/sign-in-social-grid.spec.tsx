import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages as bundle } from '@eduflow/i18n-resources';
import { describe, expect, it } from 'vitest';
import { SignInSocialGrid } from './sign-in-social-grid';

/**
 * The social grid as the sign-in screen carries it, and the message it
 * answers with (`PLT-1004` T3).
 *
 * ## What this spec is really for
 *
 * Three of the four providers are not configured for this deployment
 * (`AGENTS.md` 13: no real OAuth without confirmed credentials), so pressing
 * one must say so rather than navigate somewhere that fails. That part was
 * already covered in `social-buttons.spec.tsx` at the component boundary.
 *
 * What was NOT covered is the visible half on the actual screen, and the
 * reason that matters is the drift this file pins shut: the message used to
 * be rendered with a hand-written class list — `rounded-control border
 * border-danger bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger` —
 * while the three other alert sites in this feature had just moved to
 * `AuthAlert`. A fourth copy of the same visual language is exactly how a
 * shared component gets bypassed, and bypassing it means the template's
 * `.alert` rule now lives in two places and drifts.
 *
 * So the assertion here is the template's alert slot, on the grid's own
 * message.
 */

describe('SignInSocialGrid', () => {
  const renderGrid = (locale: 'en' | 'ta' | 'si' | 'ar' = 'en') =>
    render(
      <NextIntlClientProvider locale={locale} messages={bundle[locale]}>
        <SignInSocialGrid />
      </NextIntlClientProvider>,
    );

  it('renders the four buttons the template carries', () => {
    renderGrid();

    for (const name of ['Google', 'Microsoft', 'Apple', 'Facebook']) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
  });

  it('names the provider in the message when it is not configured', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Microsoft' }));

    // The provider is named, because "not configured for this deployment" on
    // its own does not tell the reader WHICH one they pressed.
    expect(screen.getByTestId('social-status').textContent).toContain('Microsoft');
    expect(screen.getByTestId('social-status').textContent).toContain(
      'not configured for this deployment',
    );
  });

  it('shows nothing before anything is pressed', () => {
    renderGrid();

    // An alert that is present and empty is an announcement of nothing, and a
    // screen reader that fires on page load has told the user a non-fact.
    expect(screen.getByTestId('social-status').textContent).toBe('');
  });

  it('renders that message in the template alert slot, like every other alert', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Microsoft' }));

    const slot = screen.getByTestId('social-status').querySelector('p');

    expect(slot, 'the not-configured message rendered no element to style').not.toBeNull();

    // The template's `.alert` rule as `AuthAlert` derives it — see
    // `auth-alert.spec.tsx` for the same values read out of the template
    // itself. Asserting them HERE rather than trusting the component is what
    // makes this a guard instead of a screenshot: the grid is the fourth
    // consumer of the slot and the one most likely to be re-forked.
    expect(slot?.className).toContain('rounded-control');
    expect(slot?.className).toContain('px-3');
    expect(slot?.className).toContain('py-2.5');
    expect(slot?.className).toContain('text-[13px]');
    expect(slot?.className).toContain('bg-danger/12');
    expect(slot?.className).toContain('border-danger/30');
    expect(slot?.className).toContain('text-danger');

    // And the forbidden spellings, named rather than left to review: the old
    // hand-written list this component used to carry.
    expect(slot?.className).not.toContain('bg-danger/5');
    expect(slot?.className).not.toContain('text-sm');
    expect(slot?.className).not.toContain('font-medium');
  });
});
