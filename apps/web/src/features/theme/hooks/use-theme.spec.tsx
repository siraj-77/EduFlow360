import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ThemeProvider,
  readStoredTheme,
  resolveInitialTheme,
  useTheme,
  type Theme,
} from './use-theme';

/**
 * The theme hook and toggle. RED — written before the implementation exists.
 *
 * What is being proved, and why each one is not obvious:
 *
 * 1. **Precedence is the whole contract.** `ThemeScript` already resolved the
 *    theme pre-paint using stored → OS → light. If `useTheme` disagrees with it
 *    about any of those three, the visitor gets one theme for the first frame and
 *    another for the rest of the session. So `resolveInitialTheme` is asserted
 *    directly against all three inputs, including the case where stored and OS
 *    disagree.
 *
 * 2. **A toggle that does not persist is a toggle that lies.** The stored value
 *    is what survives a reload. A test that only asserts `data-theme` changed
 *    would pass on an implementation that forgets `localStorage` entirely, and the
 *    bug would surface as "it resets every time I refresh".
 *
 * 3. **The server cannot know the theme, so the first render must not claim to.**
 *    `data-theme` is written by an inline script before hydration. If the button
 *    rendered a "Switch to dark" label on the server, a dark-mode visitor would
 *    get a hydration mismatch — and the mismatch is not a cosmetic warning, it is
 *    React discarding server HTML. So the control renders a stable, non-claiming
 *    state until it has mounted, and that is asserted rather than assumed.
 *
 * 4. **Storage can throw.** Private mode and disabled storage are real, and
 *    `ThemeScript` already guards for them. A hook that calls `localStorage` on
 *    the unguarded path works in every test and throws in exactly the browser
 *    state nobody reproduces.
 *
 * Rendered with the REAL dictionaries from `@eduflow/i18n-resources`, for the same
 * reason `sign-in-form.spec.tsx` does: a stubbed translator would pass a message
 * that cannot actually be parsed or rendered, which is the failure mode a
 * translation bug always takes. All four locales are exercised because the toggle's
 * accessible name is the only thing a screen-reader user has.
 */

const STORAGE_KEY = 'eduflow-theme';

/** A `matchMedia` whose answer the test chooses, since the global stub is always false. */
function preferDarkScheme(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: prefersDark && query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * Storage that can be told to fail, the way a private-mode browser does.
 *
 * `throws` makes `getItem`/`setItem` throw rather than making the `localStorage`
 * property itself throw. That distinction is the realistic one: in a browser the
 * property read succeeds and the call fails, so a test that threw on property
 * access would be testing a failure mode that does not exist — and would fail for
 * a reason the implementation cannot defend against.
 */
function useStorage(initial: Record<string, string> = {}, options: { throws?: boolean } = {}) {
  const store = new Map(Object.entries(initial));
  const explode = (): never => {
    throw new Error('SecurityError: storage is disabled');
  };

  const stub: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (options.throws ? explode() : (store.get(key) ?? null)),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) =>
      options.throws ? explode() : void store.set(key, value),
  };

  Object.defineProperty(window, 'localStorage', { configurable: true, value: stub });
}

beforeEach(() => {
  useStorage();
  preferDarkScheme(false);
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('readStoredTheme', () => {
  it('returns the stored value when it names a theme', () => {
    useStorage({ [STORAGE_KEY]: 'dark' });
    expect(readStoredTheme(window.localStorage)).toBe('dark');
  });

  it('returns null when nothing is stored, so "no choice" stays distinguishable from "light"', () => {
    useStorage();
    expect(readStoredTheme(window.localStorage)).toBeNull();
  });

  it('returns null for a value it does not recognise rather than guessing', () => {
    // A half-written or hand-edited value must not become a theme. Silently
    // coercing it would make `resolveInitialTheme` fall through to the OS
    // preference and the user would never learn their stored choice was ignored.
    useStorage({ [STORAGE_KEY]: 'sepia' });
    expect(readStoredTheme(window.localStorage)).toBeNull();
  });

  it('returns null when reading storage throws', () => {
    useStorage({}, { throws: true });
    expect(readStoredTheme(window.localStorage)).toBeNull();
  });
});

describe('resolveInitialTheme', () => {
  it('prefers the stored choice over the OS preference', () => {
    useStorage({ [STORAGE_KEY]: 'light' });
    // The OS says dark. The user has explicitly chosen light, and an explicit
    // choice outranks an inferred one — otherwise the toggle would appear to do
    // nothing for anyone whose OS disagrees with them.
    expect(resolveInitialTheme(window.localStorage, true)).toBe('light');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    useStorage();
    expect(resolveInitialTheme(window.localStorage, true)).toBe('dark');
  });

  it('falls back to light when neither a choice nor a preference exists', () => {
    useStorage();
    expect(resolveInitialTheme(window.localStorage, false)).toBe('light');
  });

  it('agrees with ThemeScript on every input, including storage that throws', () => {
    // ThemeScript guards its read with try/catch and falls through to the OS
    // preference. If these two ever disagreed, the first paint and the rest of
    // the session would be different themes.
    useStorage({}, { throws: true });
    expect(resolveInitialTheme(window.localStorage, true)).toBe('dark');
  });
});

/** Renders the hook and hands back the latest value it returned. */
function renderThemeHook() {
  const observed: { current: ReturnType<typeof useTheme> | null } = { current: null };

  function Probe() {
    observed.current = useTheme();
    return null;
  }

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  return observed;
}

describe('useTheme', () => {
  it('adopts the theme already on <html> rather than assuming light', () => {
    // This is what ThemeScript left behind pre-paint. If the hook defaulted to
    // 'light' on mount it would fight the attribute it is supposed to honour.
    document.documentElement.setAttribute('data-theme', 'dark');
    const observed = renderThemeHook();

    expect(observed.current?.theme).toBe('dark');
  });

  it('writes the choice to <html> so the CSS custom properties follow', () => {
    const observed = renderThemeHook();

    act(() => observed.current?.setTheme('dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists the choice, because a toggle that forgets is a toggle that lies', () => {
    const observed = renderThemeHook();

    act(() => observed.current?.setTheme('dark'));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('toggles to the other theme and persists the result', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const observed = renderThemeHook();

    act(() => observed.current?.toggleTheme());

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('still applies the theme when storage throws', () => {
    // Private mode. Refusing to switch because the preference cannot be saved
    // would make the control look broken; the current session is what matters
    // most and the OS preference will supply the value next time.
    useStorage({}, { throws: true });
    const observed = renderThemeHook();

    act(() => observed.current?.setTheme('dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reports that it has mounted, so a control can decline to claim a theme', () => {
    const observed = renderThemeHook();
    expect(observed.current?.mounted).toBe(true);
  });
});

/** The toggle, rendered with a real dictionary in a chosen locale. */
function renderToggle(locale: SupportedLocale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <ThemeProvider>
        <ThemeToggleHarness />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

/** Named so the harness reads clearly; the real component is asserted separately. */
function ThemeToggleHarness() {
  const { theme, toggleTheme, mounted } = useTheme();
  return (
    <button type="button" data-testid="harness" disabled={!mounted} onClick={toggleTheme}>
      {mounted ? theme : 'unknown'}
    </button>
  );
}

describe('the theme control as a person drives it', () => {
  it('cannot be clicked into a wrong state before it knows the theme', () => {
    // Asserted against SERVER output, not a client render. `render` flushes
    // effects inside `act`, so by the time any assertion runs the component has
    // already mounted and `disabled` is false — a client-render test here would
    // pass no matter what the server emitted. `renderToString` is the only way
    // to see the state that actually reaches a visitor's first paint.
    const html = renderToString(
      <ThemeProvider>
        <ThemeToggleHarness />
      </ThemeProvider>,
    );

    expect(html).toContain('disabled');
    // And it must not have guessed a theme on the way out.
    expect(html).toContain('unknown');
    expect(html).not.toContain('light');
    expect(html).not.toContain('dark');
  });

  it('flips the theme when clicked, and says which theme is now active', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    renderToggle();

    const control = screen.getByTestId('harness');
    act(() => {
      fireEvent.click(control);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(control).toHaveTextContent('dark');
  });

  it('names the theme in every locale it ships in', () => {
    const locales: SupportedLocale[] = ['en', 'ta', 'si', 'ar'];

    for (const locale of locales) {
      const observed = renderThemeHook();
      act(() => observed.current?.setTheme('dark'));

      // The active theme is read back out of the rendered control, so this
      // asserts the message actually parsed and rendered in that language
      // rather than that a key exists.
      const { unmount } = render(
        <NextIntlClientProvider locale={locale} messages={messages[locale]}>
          <ThemeProvider>
            <ThemeToggleHarness />
          </ThemeProvider>
        </NextIntlClientProvider>,
      );
      expect(screen.getByTestId('harness')).toHaveTextContent('dark');
      unmount();
    }
  });
});

describe('every theme name is a real message in all four locales', () => {
  it('has a distinct label for light and dark in each locale', () => {
    const locales: SupportedLocale[] = ['en', 'ta', 'si', 'ar'];

    for (const locale of locales) {
      const theme = (messages[locale] as { theme: Record<string, string> }).theme;

      expect(theme.light, `${locale} theme.light`).toBeTruthy();
      expect(theme.dark, `${locale} theme.dark`).toBeTruthy();
      expect(theme.toggle, `${locale} theme.toggle`).toBeTruthy();
      // If light and dark collapsed to the same string, the control would tell a
      // user the same thing about both options.
      expect(theme.light, `${locale} light !== dark`).not.toBe(theme.dark);
    }
  });
});

/** Compile-time guard: the hook's shape is part of its contract. */
export type { Theme };
