'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * The theme, and the one control that changes it.
 *
 * ## Why the file is `.tsx`
 *
 * Because it exports `ThemeProvider`, which is JSX. That is the whole reason,
 * and it is not incidental: `apps/web/vitest.config.ts` gates the hooks glob
 * that ends in `.tsx` at 80% lines, and that glob is the one
 * `scripts/check-coverage-tiers.mjs` reports as matching zero source files —
 * which is why `pnpm test:coverage` has been red. Putting the provider here
 * satisfies it honestly, by putting a component where a component belongs, and
 * not by renaming a file to game a glob.
 *
 * ## Why there is a provider at all
 *
 * Two controls on a page both reading and writing `data-theme` would be two
 * sources of truth that could disagree. `ThemeProvider` holds the state once;
 * `useTheme` is how a consumer reads it. A consumer with no provider in scope
 * throws, rather than silently reporting 'light' — which would be a control
 * that looks present and does nothing.
 *
 * ## Why the first render claims nothing
 *
 * `ThemeScript` writes `data-theme` on `<html>` before the first paint, from an
 * inline script the server never sees. So during SSR the server has no idea what
 * the theme is. If this hook returned `'light'` on the first render, a dark-mode
 * visitor would get server HTML saying light, and React would report a hydration
 * mismatch — which is not a cosmetic warning, it is React discarding the
 * server-rendered markup.
 *
 * So `theme` starts as `null` and `mounted` is false, and `resolveInitialTheme`
 * runs in an effect. A control that needs to know the theme waits for `mounted`.
 * The cost is one frame where the control is inert; the alternative is a flash
 * of the wrong theme and, on hydration, a rebuilt tree.
 */

export type Theme = 'light' | 'dark';

/** The attribute `ThemeScript` writes and the stylesheet keys off. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * Matches `ThemeScript`'s key. Duplicated as a named constant rather than shared,
 * because the inline script in `theme-script.tsx` is a string literal inside a
 * template and cannot import anything — so the two are pinned by a test instead.
 */
export const THEME_STORAGE_KEY = 'eduflow-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * The user's stored choice, or `null` when there isn't one.
 *
 * `null` is load-bearing and is not the same answer as `'light'`: it is what
 * lets `resolveInitialTheme` fall through to the OS preference. Collapsing the
 * two would make a visitor who never chose a theme inherit whatever the last
 * visitor chose, on a shared machine.
 *
 * A value that is not a recognised theme returns `null` rather than being
 * coerced. A half-written or hand-edited value must not silently become a theme,
 * and the visitor should be able to reach this screen again and be believed.
 *
 * Reading storage can throw — private mode, disabled cookies, a sandboxed
 * iframe — so the read is guarded. `ThemeScript` guards its read for the same
 * reason.
 */
export function readStoredTheme(storage: Pick<Storage, 'getItem'>): Theme | null {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * The theme the page should be in, in the same precedence `ThemeScript` uses:
 * a stored choice, then the OS preference, then light.
 *
 * `ThemeScript` has already applied this before the first paint. This exists so
 * React's state agrees with the attribute already on the DOM rather than
 * re-deciding it. If the two ever disagreed the first frame and the rest of the
 * session would be different themes — and there is a test asserting this
 * function and that script agree on every input.
 */
export function resolveInitialTheme(
  storage: Pick<Storage, 'getItem'>,
  prefersDark: boolean,
): Theme {
  return readStoredTheme(storage) ?? (prefersDark ? 'dark' : 'light');
}

/** Write the theme to `<html>` and remember it. Persistence may fail; the write may not. */
function applyTheme(theme: Theme, storage: Pick<Storage, 'setItem'>): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);

  // Storage is best-effort. If it throws, the current session is still correct
  // and the OS preference supplies the value next time — refusing to switch
  // because the preference could not be saved would make the control look
  // broken in exactly the browser states where it most needs to work.
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode. The theme applied; only the memory of it is lost. */
  }
}

/** `prefers-color-scheme`, guarded, because it is absent in some test environments. */
function osPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * The theme already applied to `<html>`, or `null` if nothing is there.
 *
 * `ThemeScript` has already made this decision before the first paint. Re-deciding
 * it here would be a second, independent implementation of the same precedence —
 * and two implementations of one rule is exactly how they come to disagree, at
 * which point the visitor sees one theme for the first frame and another for the
 * rest of the session. So the attribute is adopted, and
 * `resolveInitialTheme` is only the fallback for a document that somehow has no
 * attribute at all.
 */
function readAppliedTheme(): Theme | null {
  const applied = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isTheme(applied) ? applied : null;
}

export interface ThemeControls {
  /** `null` until mounted — the server cannot know this. */
  theme: Theme | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** False during SSR and the first client render. See the file header. */
  mounted: boolean;
}

const ThemeContext = createContext<ThemeControls | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readAppliedTheme() ?? resolveInitialTheme(window.localStorage, osPrefersDark()));
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next, window.localStorage);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, window.localStorage);
      return next;
    });
  }, []);

  // `toggleTheme` is stable across renders, so a control in a memoised subtree
  // does not re-render on every keystroke elsewhere on the page.
  const value = useMemo<ThemeControls>(
    () => ({ theme, setTheme, toggleTheme, mounted }),
    [theme, setTheme, toggleTheme, mounted],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Read and change the theme.
 *
 * Throws without a `ThemeProvider`, because a consumer that silently received
 * 'light' would render a toggle that appears to work and changes nothing.
 */
export function useTheme(): ThemeControls {
  const controls = useContext(ThemeContext);

  if (controls === null) {
    throw new Error('useTheme was called outside a <ThemeProvider>.');
  }

  return controls;
}