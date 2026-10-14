import { readFileSync } from 'node:fs';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthAlert } from './auth-alert';

/**
 * The template's `.alert` slot, measured against the template itself
 * (`PLT-1004` T2 / AC-2).
 *
 * ## What this proves
 *
 * `PLT-1004` T2 requires the three auth screens to "show server responses
 * (401 generic, 429 lockout) using the template's alert styles". That is a
 * claim about CSS values, and a claim about CSS values is worthless unless
 * the values are read from the document they are supposed to equal. So this
 * spec parses the template's own `.alert`, `.alert.error` and `.alert.ok`
 * rules and the kit's own token sheet, and asserts that the component the
 * three screens share encodes those numbers. Nothing here is typed from
 * memory, because a value typed from memory is a value nobody checked.
 *
 * ## Why the kit's tokens are the bridge, not the utility names
 *
 * The template writes `border-radius: 9px`; Tailwind has no `rounded-9px`
 * unless someone hard-codes one, which `AGENTS.md` 3.2.5 forbids. The
 * template's number reaches a component through a TOKEN — here
 * `--radius-control` — so the assertion that matters is "the template's
 * radius equals the kit's control radius", and the utility (`rounded-control`)
 * is the rendering of that token. Asserting the utility alone would pass if
 * the token were silently retuned; asserting the token alone would pass if
 * the component stopped using it.
 *
 * ## The recorded divergence
 *
 * The template carries ONE value per token and no dark half. The kit
 * deliberately pairs `--radius-control` (9px light / 8px dark) — a light
 * control on a dark surface reads heavier than a dark one. That is a real
 * difference from the template's 9px, it is part of the radius discrepancy
 * the owner has already been asked to rule on, and it is pinned here with its
 * reason rather than left to be discovered later as drift. A divergence with
 * a recorded reason is a decision; a divergence without one is the thing
 * `PLT-1003` T3's table exists to prevent.
 */

/*
 * Both bases are held in variables for the reason `session-cookie-name.spec.ts`
 * records: Vite rewrites a `new URL()` whose second argument is LITERALLY
 * `import.meta.url` into an asset reference, and that rewrite resolves to a
 * non-`file:` scheme under jsdom, so `readFileSync` dies with "The URL must be
 * of scheme file".
 */
const HERE = import.meta.url;

const TEMPLATE = readFileSync(
  new URL('../../../../../../docs/template/EduFlow360_Template_Landing_Auth.html', HERE),
  'utf8',
);

const KIT_STYLES = readFileSync(
  new URL('../../../../../../packages/ui-kit/src/styles.css', HERE),
  'utf8',
);

/** One rule body out of a stylesheet, by exact selector. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

/** A custom property's value. `occurrence` picks the light (0) or dark (1) block. */
function tokenValue(css: string, token: string, occurrence = 0): string {
  const pattern = new RegExp(`--${token}\\s*:\\s*([^;}]+)`, 'g');

  for (let index = 0; index <= occurrence; index += 1) {
    const match = pattern.exec(css);

    if (match === null) return '';
  }

  return pattern.exec(css)?.[1]?.trim() ?? '';
}

/** `#rrggbb` to the `r,g,b` triple the template writes without its hash. */
function hexToTriple(hex: string): string {
  const value = hex.trim().replace('#', '');

  return [0, 2, 4].map((at) => Number.parseInt(value.slice(at, at + 2), 16)).join(',');
}

/** The template's `.alert` rule — the shape both tones inherit. */
const ALERT = ruleBody(TEMPLATE, '.alert');
const ALERT_ERROR = ruleBody(TEMPLATE, '.alert.error');
const ALERT_OK = ruleBody(TEMPLATE, '.alert.ok');

/** The template's colour tokens, resolved from its own `:root`. */
const TEMPLATE_DANGER = tokenValue(TEMPLATE, 'danger');
const TEMPLATE_OK = tokenValue(TEMPLATE, 'ok');

/**
 * The template's numbers, decoded once so each assertion below reads as a
 * sentence rather than as a regular expression.
 */
const TEMPLATE_VALUES = {
  paddingY: /padding:\s*(\d+)px/.exec(ALERT)?.[1],
  paddingX: /padding:\s*\d+px\s+(\d+)px/.exec(ALERT)?.[1],
  radius: /border-radius:\s*(\d+)px/.exec(ALERT)?.[1],
  fontSize: /font-size:\s*(\d+)px/.exec(ALERT)?.[1],
  error: {
    backgroundAlpha: /background:\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(
      ALERT_ERROR,
    )?.[1],
    backgroundTriple: /background:\s*rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,/
      .exec(ALERT_ERROR)?.[1]
      ?.replace(/\s+/g, ''),
    borderAlpha:
      /border:\s*1px\s+solid\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(
        ALERT_ERROR,
      )?.[1],
    borderTriple: /border:\s*1px\s+solid\s*rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,/
      .exec(ALERT_ERROR)?.[1]
      ?.replace(/\s+/g, ''),
  },
  ok: {
    backgroundAlpha: /background:\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(
      ALERT_OK,
    )?.[1],
    backgroundTriple: /background:\s*rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,/
      .exec(ALERT_OK)?.[1]
      ?.replace(/\s+/g, ''),
    borderAlpha:
      /border:\s*1px\s+solid\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/.exec(
        ALERT_OK,
      )?.[1],
    borderTriple: /border:\s*1px\s+solid\s*rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*,/
      .exec(ALERT_OK)?.[1]
      ?.replace(/\s+/g, ''),
  },
} as const;

/**
 * The template's alpha to the Tailwind opacity modifier that renders it.
 *
 * Tailwind v4 takes any integer percentage, so the modifier is the template's
 * own value scaled by 100 — no rounding table, no nearest-of-nine guess.
 */
const opacityModifier = (alpha: string): string => String(Math.round(Number(alpha) * 100));

/**
 * The template's padding to the Tailwind spacing utility that renders it.
 *
 * The kit's spacing scale is 4px per unit, so 10px is 2.5 and 12px is 3. If a
 * template value ever lands off-scale this returns the literal `[…]` form
 * rather than a silently wrong neighbour.
 */
const spacingUtility = (axis: 'x' | 'y', pixels: string): string => {
  const units = Number(pixels) / 4;

  return `${axis === 'x' ? 'px' : 'py'}-${Number.isInteger(units) ? units : `[${pixels}px]`}`;
};

const classNamesOf = (testId: string): string =>
  screen.getByTestId(testId).getAttribute('class') ?? '';

describe("the template's alert slot (PLT-1004 T2 / AC-2)", () => {
  it('reads the rules it is comparing against', () => {
    // Not a tautology: a restructured template would make every assertion
    // below compare against an empty string, which is the "a check that
    // matches nothing" failure this repository keeps finding. Anchor each
    // extraction to a value only the template's own rule carries.
    expect(ALERT).toContain('padding');
    expect(ALERT_ERROR).toContain('background');
    expect(ALERT_OK).toContain('background');
    expect(TEMPLATE_DANGER).toBe('#dc2626');
    expect(TEMPLATE_OK).toBe('#059669');

    // And every decoded number actually decoded, so a renamed property fails
    // HERE, naming the missing rule, rather than three assertions down as an
    // unexplained class mismatch.
    for (const [name, value] of [
      ['paddingY', TEMPLATE_VALUES.paddingY],
      ['paddingX', TEMPLATE_VALUES.paddingX],
      ['radius', TEMPLATE_VALUES.radius],
      ['fontSize', TEMPLATE_VALUES.fontSize],
      ['error.backgroundAlpha', TEMPLATE_VALUES.error.backgroundAlpha],
      ['error.backgroundTriple', TEMPLATE_VALUES.error.backgroundTriple],
      ['error.borderAlpha', TEMPLATE_VALUES.error.borderAlpha],
      ['error.borderTriple', TEMPLATE_VALUES.error.borderTriple],
      ['ok.backgroundAlpha', TEMPLATE_VALUES.ok.backgroundAlpha],
      ['ok.backgroundTriple', TEMPLATE_VALUES.ok.backgroundTriple],
      ['ok.borderAlpha', TEMPLATE_VALUES.ok.borderAlpha],
      ['ok.borderTriple', TEMPLATE_VALUES.ok.borderTriple],
    ] as const) {
      expect(value, `the template's ${name} could not be decoded`).toBeTruthy();
    }
  });

  it("uses the kit's control radius, and that radius is the template's", () => {
    // The template's 9px must be the kit's light control radius, or
    // `rounded-control` is not the template's radius and the component is
    // quietly on some other number.
    expect(tokenValue(KIT_STYLES, 'radius-control')).toBe(`${TEMPLATE_VALUES.radius}px`);

    expect(classNamesOf('auth-alert-error')).toContain('rounded-control');
  });

  it.each([
    { axis: 'x', template: TEMPLATE_VALUES.paddingX },
    { axis: 'y', template: TEMPLATE_VALUES.paddingY },
  ] as const)("pads the slot by the template's own $axis value", ({ axis, template }) => {
    expect(classNamesOf('auth-alert-error')).toContain(spacingUtility(axis, template ?? '0'));
  });

  it("sets the template's own font size on the slot", () => {
    // 13px is the template's auth-slot size. The kit has no `text-13`
    // utility, so this is the one place an arbitrary value is honest rather
    // than a hard-coded hex equivalent.
    expect(classNamesOf('auth-alert-error')).toContain(`text-[${TEMPLATE_VALUES.fontSize}px]`);
  });

  it("paints the error slot with the template's danger token at its alpha", () => {
    // The background and the border come from the SAME triple the template
    // resolves `--danger` to. Asserting the triple rather than the word
    // `danger` is what stops a retuned token from quietly moving the alert.
    expect(TEMPLATE_VALUES.error.backgroundTriple).toBe(hexToTriple(TEMPLATE_DANGER));
    expect(TEMPLATE_VALUES.error.borderTriple).toBe(hexToTriple(TEMPLATE_DANGER));

    const classes = classNamesOf('auth-alert-error');

    expect(classes).toContain(
      `bg-danger/${opacityModifier(TEMPLATE_VALUES.error.backgroundAlpha ?? '0')}`,
    );
    expect(classes).toContain(
      `border-danger/${opacityModifier(TEMPLATE_VALUES.error.borderAlpha ?? '0')}`,
    );
    expect(classes).toContain('text-danger');
    // `1px solid`, which is the template's whole border declaration.
    expect(classes).toContain('border');
  });

  it("paints the ok slot with the template's ok token at its alpha", () => {
    expect(TEMPLATE_VALUES.ok.backgroundTriple).toBe(hexToTriple(TEMPLATE_OK));
    expect(TEMPLATE_VALUES.ok.borderTriple).toBe(hexToTriple(TEMPLATE_OK));

    const classes = classNamesOf('auth-alert-ok');

    expect(classes).toContain(
      `bg-ok/${opacityModifier(TEMPLATE_VALUES.ok.backgroundAlpha ?? '0')}`,
    );
    expect(classes).toContain(
      `border-ok/${opacityModifier(TEMPLATE_VALUES.ok.borderAlpha ?? '0')}`,
    );
    expect(classes).toContain('text-ok');
    expect(classes).toContain('border');
  });

  it('announces an error assertively and a success politely', () => {
    // The template's `.alert` is a demo div with no role at all. The port
    // cannot copy that: a screen-reader user who is told a sign-in failed
    // with no focus change and no announcement has been told nothing. The
    // two roles are the standard split, and they are the reason `tone`
    // exists rather than a bare className.
    render(
      <>
        <AuthAlert tone="error" testId="role-error">
          failed
        </AuthAlert>
        <AuthAlert tone="ok" testId="role-ok">
          sent
        </AuthAlert>
      </>,
    );

    expect(screen.getByTestId('role-error').getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('role-ok').getAttribute('role')).toBe('status');
  });

  it("reproduces the template's radius pairing rather than hiding the dark difference", () => {
    // The template carries one `--radius-control` value and no dark half; the
    // kit carries 9px light / 8px dark. So the LIGHT half is exact parity and
    // the DARK half is a recorded divergence, pinned here so a later session
    // finds it written down instead of rediscovering it as drift.
    //
    // The kit's dark value sits in its `[data-theme='dark']` block, which is
    // the SECOND `--radius-control` in the sheet.
    const dark = tokenValue(KIT_STYLES, 'radius-control', 1);
    const light = tokenValue(KIT_STYLES, 'radius-control');

    expect(light).not.toBe(dark);
    expect(dark).toBe('8px');
    // And the light half — the one the template actually specifies — matches.
    expect(light).toBe(`${TEMPLATE_VALUES.radius}px`);
  });
});
