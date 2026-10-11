import { UI_KIT_TOKENS } from './index.js';
import { describe, expect, it } from 'vitest';

/**
 * The token contract.
 *
 * AGENTS.md 3.2.5: "Tokens are CSS variables; never hard-code a hex
 * value in a component" and "Light and dark are both required".
 *
 * AGENTS.md 3.2.5 gives a specific token set, of which FIVE are
 * overridden per theme:
 *
 *   [data-theme="dark"] { --bg:#0d0f16; --surface:#141824; --text:#eef0f6;
 *                         --muted:#9099ad; --border:#242938; }
 *
 * The five brand tokens (--brand, --brand-2, --accent, --danger, --ok)
 * are theme-INDEPENDENT in that specification. This suite asserts that
 * distinction rather than demanding an override that the spec does not
 * call for -- asserting a rule that does not exist produces a test that
 * can only ever be satisfied by changing the design tokens.
 */
const SURFACE_TOKENS = ['--bg', '--surface', '--text', '--muted', '--border'] as const;
const BRAND_TOKENS = ['--brand', '--brand-2', '--accent', '--danger', '--ok'] as const;

async function readStyles(): Promise<string> {
  const { readFileSync } = await import('node:fs');
  return readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
}

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[[\]{}()*+?.\\^$|]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

describe('UI_KIT_TOKENS', () => {
  it('exposes every token named in AGENTS.md 3.2.5', () => {
    for (const token of [...SURFACE_TOKENS, ...BRAND_TOKENS]) {
      expect(UI_KIT_TOKENS, `${token} must be exported`).toContain(token);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(UI_KIT_TOKENS).size).toBe(UI_KIT_TOKENS.length);
  });
});

describe('light and dark themes (AGENTS.md 3.2.5)', () => {
  it('defines every token in :root', async () => {
    const root = block(await readStyles(), ':root');

    for (const token of UI_KIT_TOKENS) {
      expect(root, `${token} must be defined in :root`).toContain(`${token}:`);
    }
  });

  it('overrides every SURFACE token in the dark block', async () => {
    const dark = block(await readStyles(), `[data-theme='dark']`);

    for (const token of SURFACE_TOKENS) {
      expect(dark, `${token} must be overridden in [data-theme='dark']`).toContain(`${token}:`);
    }
  });

  it('gives each surface token a DIFFERENT dark value, or dark mode is cosmetic', async () => {
    const dark = block(await readStyles(), `[data-theme='dark']`);
    const root = block(await readStyles(), ':root');
    // `?? ''` is required by noUncheckedIndexedAccess: a regex match group
    // is `string | undefined`. An absent token then compares unequal and
    // fails the "must change" assertion above, which is the right outcome.
    const valueOf = (css: string, token: string) =>
      css.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim() ?? '';

    for (const token of SURFACE_TOKENS) {
      expect(
        valueOf(dark, token),
        `${token} must change between light and dark, otherwise the theme is a no-op for it`,
      ).not.toBe(valueOf(root, token));
    }
  });

  it('uses the exact dark values AGENTS.md 3.2.5 specifies', async () => {
    const dark = block(await readStyles(), `[data-theme='dark']`);
    const valueOf = (token: string) => dark.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();

    // Pinned so a well-meaning tweak to the design tokens shows up as a
    // deliberate decision rather than as drift.
    expect(valueOf('--bg')).toBe('#0d0f16');
    expect(valueOf('--surface')).toBe('#141824');
    expect(valueOf('--text')).toBe('#eef0f6');
    expect(valueOf('--muted')).toBe('#9099ad');
    expect(valueOf('--border')).toBe('#242938');
  });

  it('respects prefers-reduced-motion, which the template lacked (DSN-05)', async () => {
    expect(await readStyles()).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});

/**
 * NOT asserted here, and deliberately so: whether the brand tokens meet
 * contrast requirements against BOTH surfaces. That is a design-system
 * judgement about which brand shade reads well on near-black, it depends on
 * the final component set, and it belongs to DSN-01 with a real screen
 * to look at. Asserting a guessed contrast ratio now would be a rule
 * nobody chose.
 */
describe('brand tokens', () => {
  it('are theme-independent, as AGENTS.md 3.2.5 specifies', async () => {
    const dark = block(await readStyles(), `[data-theme='dark']`);

    for (const token of BRAND_TOKENS) {
      expect(dark, `${token} is not overridden per-theme by design`).not.toContain(`${token}:`);
    }
  });
});

/**
 * The approved font stack (`DSN-04`, decided by `ADR-022`).
 *
 * `AGENTS.md` 3.2.7: "Fonts must cover Tamil, Sinhala and Arabic, on screen
 * and in generated PDFs." The screen half is what this suite pins. The PDF
 * half waits for the Document/Print pipeline (milestone 2) and `ADR-022`
 * records that gap rather than pretending it away.
 *
 * What is asserted is the shape of the stack, not the rendering of any glyph:
 * a CSS value cannot prove a Tamil letter displayed, and a test that claimed
 * otherwise would be lying. The order is the real content — Latin first, so
 * an English label never falls through to a Tamil or Sinhala family just
 * because that family also carries Latin.
 */
describe('the approved font stack (ADR-022)', () => {
  const readBodyFontFamily = async (): Promise<string> => {
    const body = block(await readStyles(), 'body');
    return body.match(/font-family:\s*([^;]+);/)?.[1] ?? '';
  };

  it('names a family for every one of the four locales', async () => {
    const stack = await readBodyFontFamily();

    for (const family of [
      'Noto Sans', // Latin — the default body face
      'Noto Sans Tamil', // ta
      'Noto Sans Sinhala', // si
      'Noto Naskh Arabic', // ar — naskh is the readable style for extended Arabic
    ]) {
      expect(stack, `${family} must be in the stack`).toContain(family);
    }
  });

  it('puts Latin before the script faces, so English never falls through to one', async () => {
    const stack = await readBodyFontFamily();

    // `Noto Sans` is a PREFIX of `Noto Sans Tamil`, so the first match for
    // the bare name is the Latin entry itself — which is exactly the claim:
    // it appears before every script face.
    expect(stack.indexOf('Noto Sans')).toBeLessThan(stack.indexOf('Noto Sans Tamil'));
    expect(stack.indexOf('Noto Sans')).toBeLessThan(stack.indexOf('Noto Naskh Arabic'));
  });

  it('still ends at the system stack, so an OS with its own coverage is honoured', async () => {
    // Delivery is system-first (`ADR-022`): a per-school deployment has no
    // reason to download a font it already has. The self-hosted fallback is
    // a named follow-up, not a silent omission.
    expect(await readBodyFontFamily()).toContain('system-ui');
  });
});
