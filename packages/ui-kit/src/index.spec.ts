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
 * Approved-template parity — PLT-EPIC-10 pre-work, 2026-10-12.
 *
 * The three templates under `docs/template/` are owner-approved
 * "reproduce as-is" sources, and `PLT-EPIC-10` ports the dashboard's
 * CSS into the app shell. An UNDEFINED custom property is not an error:
 * `var(--brand2)` resolves to nothing, so a gradient renders as
 * `transparent` and a radius as `0` — silently, in both themes, with no
 * console output. That is the failure class `RESUME_2026-10-11-session-2`
 * recorded: the kit ships `--brand-2` while every template spells the
 * token `--brand2`.
 *
 * The oracle is deliberately GENERAL — it reads each template's own
 * `:root` and requires the kit to define every token they define. A test
 * pinning only `--brand2` would pass on the day a template adds
 * `--warn`, which is exactly how the gap survived the landing port: the
 * landing page *translated* the name (`landing.css` documents the
 * rename) instead of the kit being made compatible.
 */
describe('approved template parity (PLT-EPIC-10 pre-work)', () => {
  const TEMPLATES = [
    'EduFlow — Frontend Template.html',
    'EduFlow360_Template_Landing_Auth.html',
    'EduFlow360_Template_Admin_Dashboard.html',
  ] as const;

  const readTemplate = async (name: string): Promise<string> => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    // packages/ui-kit/src -> repo root, anchored to this file rather than
    // to the working directory, so the assertion holds from any CWD.
    const templateDir = fileURLToPath(new URL('../../../docs/template/', import.meta.url));
    return readFileSync(join(templateDir, name), 'utf8');
  };

  it('defines every token the approved templates define', async () => {
    const root = block(await readStyles(), ':root');

    for (const name of TEMPLATES) {
      const template = block(await readTemplate(name), ':root');
      const tokens = [...template.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? '');

      expect(
        tokens.length,
        `${name} defines no tokens — is its :root still there?`,
      ).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(root, `${name} defines ${token} but the kit does not`).toContain(`${token}:`);
      }
    }
  });

  it('resolves the template spellings THROUGH the kit tokens, not to a second literal', async () => {
    // `--brand2` and `--radius` exist because the templates spell them
    // that way while AGENTS.md 3.2.5 spells the brand token `--brand-2`
    // (a conflict this suite cannot resolve — the contract wins until
    // the owner normalizes it). The alias form `var(--canonical)` keeps
    // ONE value: a second `#7c3aed` literal would drift the day one of
    // them moves. `--warn` has no kit equivalent and carries the
    // harvested literal itself.
    const root = block(await readStyles(), ':root');

    expect(root).toContain('--brand2: var(--brand-2)');
    expect(root).toContain('--radius: var(--radius-card)');
    expect(root).toMatch(/--warn:\s*#d97706/);
  });
});

/**
 * Approved template VALUES (`PLT-1003` T3 / AC-2).
 *
 * The parity oracle above proves every template token EXISTS in the
 * kit. This one proves the VALUES are the same, because a kit that
 * defines `--brand2: #7c3aed` while the template says `#6d28d9` passes
 * the existence test and ships a different design.
 *
 * ## The two normalisations, and why each is a formatting choice
 *
 *   - **Short hex is expanded** (`#fff` = `#ffffff`), because the
 *     dashboard template spells the short form and the kit the long
 *     one. They are the same colour; a test that failed on the
 *     spelling would be testing spelling.
 *   - **Whitespace and `rgba` alpha are normalised**
 *     (`rgba(20,20,40,.08)` = `rgba(20, 20, 40, 0.08)`), for the same
 *     reason: minifiers rewrite one into the other, and the kit's
 *     hand-written form is not a design decision.
 *
 * ## The alias rule
 *
 * `--brand2` and `--radius` are ALIASES in the kit
 * (`var(--brand-2)`, `var(--radius-card)`), because AGENTS.md 3.2.5
 * spells the brand token `--brand-2` while every template spells it
 * `--brand2` — one value, two spellings, and the owner has been asked
 * to normalise the contract. An alias resolves to the canonical
 * token's value before comparison, so the alias form is a spellings
 * difference and not a value difference. The value is compared AFTER
 * resolution, which is the only comparison that can be right: the
 * browser resolves the chain too.
 */
describe('approved template values (PLT-1003 T3 / AC-2)', () => {
  const TEMPLATES = [
    'EduFlow — Frontend Template.html',
    'EduFlow360_Template_Landing_Auth.html',
    'EduFlow360_Template_Admin_Dashboard.html',
  ] as const;

  /**
   * The block with its comments removed.
   *
   * NOT optional, and this is the second time today a comment has
   * broken a parser that scanned for strings: `read-declaration.mjs`
   * counted brackets and strings but not comments, so an apostrophe in
   * a comment swallowed the seed's array. Here the kit's `--warn`
   * declaration is preceded by a comment that itself contains the
   * literal `--warn: #d97706`, and a `--name: value;` scan that starts
   * inside that comment captures the whole comment body as the value.
   * Comments are prose ABOUT the CSS; they are never part of it.
   */
  function withoutComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  /** `--name: value;` pairs from a block, trimmed. */
  function declarations(css: string): Map<string, string> {
    const found = new Map<string, string>();
    for (const [, name, value] of withoutComments(css).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      if (name !== undefined) found.set(name, value.trim());
    }
    return found;
  }

  /**
   * The formatting-insensitive form of a token value.
   *
   * Deliberately conservative: it normalises SPELLING, never MEANING.
   * A case difference in a hex digit, a space inside `rgba(...)`, or a
   * `.5` alpha written `0.5` are the same value; any other difference
   * is a real one and survives.
   */
  function normaliseValue(value: string): string {
    return (
      value
        // A minifier writes `rgba(20,20,40,.08)` where a hand-written
        // sheet writes `rgba(20, 20, 40, 0.08)` — the same colour, so
        // each component is trimmed and a leading-dot alpha gains its
        // zero. Same colour, different spelling, must not be a failure.
        .replace(/rgba\(([^)]*)\)/g, (_match, components: string) => {
          const parts = components.split(',').map((part) => {
            const trimmed = part.trim();
            return trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
          });
          return `rgba(${parts.join(', ')})`;
        })
        .replace(/\s+/g, ' ')
        // `#fff` is `#ffffff`; the dashboard spells the short form and
        // the kit the long one.
        .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/gi, '#$1$1$2$2$3$3')
        .toLowerCase()
    );
  }

  /** The kit's value for `name`, resolving one level of alias. */
  function kitValue(kit: Map<string, string>, name: string): string {
    const declared = kit.get(name);
    if (declared === undefined) return '<<not defined>>';

    const alias = /^var\((--[a-z0-9-]+)\)$/.exec(declared)?.[1];
    if (alias === undefined) return declared;

    const canonical = kit.get(alias);
    return canonical === undefined ? declared : canonical;
  }

  it.each(TEMPLATES)('matches every value %s declares, light and dark', async (name) => {
    const { readFileSync } = await import('node:fs');
    const template = readFileSync(
      new URL(`../../../docs/template/${name}`, import.meta.url),
      'utf8',
    );

    const styles = await readStyles();
    const kit = declarations(block(styles, ':root'));
    const kitDark = declarations(block(styles, `[data-theme='dark']`));

    for (const [selector, templateBlock, kitBlock] of [
      [':root', block(template, ':root'), kit],
      ['[data-theme="dark"]', block(template, `[data-theme='dark']`), kitDark],
    ] as const) {
      const declared = declarations(templateBlock);

      // A template with no dark block declares no dark values, and an
      // assertion per missing token would be noise. The brand tokens are
      // theme-independent (AGENTS.md 3.2.5), so light-only is normal.
      if (declared.size === 0) continue;

      for (const [token, value] of declared) {
        expect(
          normaliseValue(kitValue(kitBlock, token)),
          `${name} ${selector} declares ${token}: ${value}, but the kit declares a different value`,
        ).toBe(normaliseValue(value));
      }
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
