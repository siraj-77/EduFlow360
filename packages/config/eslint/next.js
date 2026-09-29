import { base } from './base.js';

/**
 * EduFlow — web (Next.js) ESLint configuration.
 *
 * AGENTS.md section 3.2.1: "All UI primitives are shadcn/ui components --
 * no raw <button>, <input>, <select>, <textarea>, <table>, <dialog>."
 * Raw elements are banned so that every interactive surface inherits
 * the design system's focus, touch-target and disabled behaviour.
 *
 * AGENTS.md section 3.2.5: "never hard-code a hex value in a component".
 * Colours are CSS variables, so a component that hard-codes a hex cannot
 * work in both themes -- which AGENTS.md forbids.
 *
 * NOT enforced here: "no user-facing literal strings" (AGENTS.md 2.8).
 * A heuristic here produces false positives, which is worse than no check.
 * It is implemented as `scripts/check-i18n` in P3, where it can be tuned
 * against real screens.
 */

/** @type {import('eslint').Linter.Config[]} */
const RAW_HTML_PRIMITIVES = [
  'button',
  'input',
  'select',
  'textarea',
  'table',
  'dialog',
];

// no-restricted-syntax takes `selector`; `group` is no-restricted-imports.
const RAW_ELEMENT_PATTERN = RAW_HTML_PRIMITIVES.map((tag) => ({
  selector: `JSXElement[name.name='${tag}']`,
  message:
    `AGENTS.md 3.2.1: raw <${tag}> is not allowed. Use the shadcn/ui component ` +
    `from @eduflow/ui-kit so the element inherits theming, focus, and ` +
    `touch-target behaviour.`,
}));

const HARDCODED_COLOUR_PATTERN = [
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message:
      'AGENTS.md 3.2.5: never hard-code a colour in a component. Use the CSS ' +
      'variable tokens (--brand, --surface, --muted, --danger, ...) defined in ' +
      'globals.css so the component works in both light and dark themes.',
  },
];

/** @type {import('eslint').Linter.Config[]} */
export const next = [
  ...base,
  {
    // Not root-anchored: eslint runs from apps/web and packages/ui-kit.
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...RAW_ELEMENT_PATTERN],
    },
  },
  {
    files: ['**/*.tsx', '**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...HARDCODED_COLOUR_PATTERN],
    },
  },
  {
    // Tests are exempt from the colour rule, because a test that pins the
    // token values MUST name them. `expect(valueOf('--bg')).toBe('#0d0f16')`
    // is the mechanism that stops a silent palette change, and banning it
    // would mean either weakening the assertion or adding an inline
    // disable to every one of them.
    //
    // Scoped to `*.spec.*` / `*.test.*` only, so production components
    // remain covered.
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // AGENTS.md section 2.8 + 4.2: one inline comment marking a
      // translation as unreviewed is allowed; a silent English fallback
      // is not. Kept narrow on purpose.
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'hack', 'xxx'], location: 'start' },
      ],
    },
  },
];
