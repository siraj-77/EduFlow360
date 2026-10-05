'use client';

import { Button, MoonIcon, SunIcon } from '@eduflow/ui-kit';
import { useTranslations } from 'next-intl';

import { useTheme } from '../hooks/use-theme';

/**
 * The one-click theme toggle `AGENTS.md` 3.2.5 requires.
 *
 * ## Why it is a ui-kit `Button` and not a `<button>`
 *
 * 3.2.1 bans raw `<button>`. That ban is easy to regress here specifically,
 * because this is the one control on the marketing shell whose entire reason for
 * existing is an `onClick` — so a `<button>` is the path of least resistance and
 * the ESLint rule is the only thing in the way. `Button` carries the 44px touch
 * floor from `--touch-target-min`, the focus ring, and the reduced-motion
 * handling, none of which this control should re-implement.
 *
 * ## Why the label names the TARGET, not the current state
 *
 * The control says "Light" when it will switch to light, and "Dark" when it will
 * switch to dark. The alternative — labelling it with what is currently active —
 * means the name changes on every click, so a screen-reader user has to
 * re-listen to work out what the button does now. A name that describes the
 * action stays true across a toggle.
 *
 * The visible text is the icon plus the target's word, and `aria-label` repeats
 * it in a sentence, because an icon alone names the control "button".
 *
 * ## Why both glyphs are rendered and one is hidden
 *
 * The glyph that matches what pressing will DO is shown; the current state is
 * carried by the text. Both are in the DOM so the swap is a CSS-free React swap
 * with no layout jump between themes — and both are `aria-hidden`, so the
 * accessible name comes only from the label and is never "sun graphic".
 *
 * Neither icon is directional, so neither carries `rtl:rotate-180`. That is the
 * rule in `icons.tsx`'s header, and a sun that rotated under Arabic would be a
 * bug with no upside.
 *
 * ## Why it is disabled until mounted
 *
 * The server cannot know the theme — `ThemeScript` resolves it in the browser
 * before first paint. A control that picked a target on the server would render
 * "Dark" to a light-mode visitor and then correct itself, which is both a visible
 * flicker and a hydration mismatch (React discards the server HTML). So the
 * target is only rendered once `mounted` is true; before that the control is
 * present, correctly named and correctly sized, but inert.
 */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const { theme, toggleTheme, mounted } = useTheme();

  const willSwitchTo = theme === 'dark' ? 'light' : 'dark';
  const targetLabel = willSwitchTo === 'dark' ? t('dark') : t('light');

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!mounted}
      onClick={toggleTheme}
      aria-label={`${t('toggle')}: ${targetLabel}`}
      data-testid="theme-toggle"
      // `size-5` on the glyph, and the floor comes from the Button itself.
      className="gap-2 px-3"
    >
      <SunIcon className={`size-5 ${mounted && theme === 'dark' ? 'hidden' : ''}`} />
      <MoonIcon className={`size-5 ${mounted && theme === 'light' ? 'hidden' : ''}`} />
      <span>{mounted ? targetLabel : t('toggle')}</span>
    </Button>
  );
}