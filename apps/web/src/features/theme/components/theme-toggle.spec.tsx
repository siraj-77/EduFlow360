import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../hooks/use-theme';

import { ThemeToggle } from './theme-toggle';

/**
 * The theme toggle, as a person meets it.
 *
 * ## What is being held here
 *
 * `AGENTS.md` 3.2.1 bans raw `<button>`, so this control cannot be one — it is a
 * ui-kit `Button`. That is asserted directly rather than assumed, because the
 * primitive and the ban are both easy to regress independently: someone can
 * reach for a `<button>` the moment a control needs an `onClick`, and the ESLint
 * rule is the only thing standing between that and a review comment.
 *
 * ## The accessible name is the real feature
 *
 * A theme toggle that renders only a glyph names itself to a screen reader as
 * "button". That is worse than no toggle: it looks like a control, it is
 * focusable, and pressing it does something the user was never told about. So the
 * name comes from `theme.toggle` in all four locales and is asserted by getting
 * the control BY that name — if the key went missing or a locale fell back to
 * English, `getByRole('button', { name: ... })` stops finding it.
 *
 * `theme.light` / `theme.dark` name what the control will switch TO, not what is
 * currently active. That is the convention that keeps the label stable across a
 * toggle: if the name changed on every click, a screen-reader user would have to
 * re-listen to work out what the button does now.
 */

const LOCALES: SupportedLocale[] = ['en', 'ta', 'si', 'ar'];

function renderToggle(locale: SupportedLocale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  vi.stubGlobal(
    'localStorage',
    Object.assign(Object.create(null), {
      getItem: () => null,
      setItem: () => {},
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('is a ui-kit Button, not a raw <button> (AGENTS.md 3.2.1)', () => {
    renderToggle();
    // The primitive renders `data-slot="button"`, which is how the ban is
    // checked everywhere else in the codebase too.
    expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button');
  });

  it('names itself with the translated label in every locale it ships in', () => {
    for (const locale of LOCALES) {
      const theme = (messages[locale] as { theme: Record<string, string> }).theme;
      // The full accessible name is the toggle label plus the theme it will
      // switch TO. Both halves are built from that locale's own messages, so a
      // key that went missing, or a locale silently falling back to English,
      // makes the lookup fail rather than pass on the English string.
      const expected = `${theme.toggle}: ${theme.dark}`;

      const { unmount } = renderToggle(locale);
      expect(screen.getByRole('button', { name: expected }), `${locale} name`).toBeTruthy();
      unmount();
    }
  });

  it('says which theme it will switch to, not which one is active', () => {
    renderToggle();
    const toDark = (messages.en as { theme: Record<string, string> }).theme.dark;

    // `aria-label` is the accessible name; the visible text is separate. Asserting
    // the label contains the TARGET is what proves the naming convention.
    const name = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(name).toContain(toDark);
  });

  it('uses no physical Tailwind utilities, so RTL mirroring is not needed', () => {
    const { container } = renderToggle();
    // AGENTS.md 3.2.6. Checked on the rendered className rather than the source,
    // for the reason primitives.spec.tsx gives: a class can arrive via a variant.
    expect(container.innerHTML).not.toMatch(
      /\b(?:m[lr]-|p[lr]-|left-|right-|text-left|text-right|border-[lr]\b|rounded-[lr]\b)/,
    );
  });

  it('carries both glyphs in the DOM only as decoration, never as the name', () => {
    const { container } = renderToggle();
    const svgs = container.querySelectorAll('svg');

    for (const svg of svgs) {
      // Every icon here is `aria-hidden`, so the glyph contributes nothing to the
      // accessible name and the label alone carries it.
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
    }
  });
});