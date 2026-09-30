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
const RAW_HTML_PRIMITIVES = ['button', 'input', 'select', 'textarea', 'table', 'dialog'];

// no-restricted-syntax takes `selector`; `group` is no-restricted-imports.
//
// ⚠️ THIRD defect in this rule, and the one that made the other two invisible.
// The selector was written as `JSXElement[name.name='<tag>']`. **In the ESTree
// spec a `JSXElement` has no `name` property** — it has `openingElement`,
// `children` and `closingElement`. The node that carries `name` is
// `JSXOpeningElement`. So this selector could never match, in any file, under
// any configuration.
//
// Three defects were stacked here, and all three had to be fixed before the
// rule could fire:
//   1. this selector        — `JSXElement` has no `name`      (this one)
//   2. rule-array overwrite — a later `no-restricted-syntax` block replaced
//                             the earlier one for the same files
//   3. `parserOptions: {}`   — replaced the JSX parser option, so no JSX nodes
//                             were produced at all
//
// It read as enforced, it was cited in a WORKLOG entry as the reason a screen
// had to be built without a button, and it had never rejected anything. Found
// 2026-09-30 by `apps/web/src/config/ui-primitive-rules.spec.ts`, which is the
// first suite to execute the *next* config — `lint-rules.spec.ts` only ever
// exercised the *node* config, whose rules contain no JSX selectors.
const RAW_ELEMENT_PATTERN = RAW_HTML_PRIMITIVES.map((tag) => ({
  selector: `JSXOpeningElement[name.name='${tag}']`,
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
    // ⚠️ These two `no-restricted-syntax` blocks used to be written as
    // `files: ['**/*.tsx']` (raw elements) followed by
    // `files: ['**/*.tsx', '**/*.ts']` (colour). **The second overwrote the
    // first for every .tsx file**, because a later flat-config object replaces
    // the whole rule array rather than merging into it. AGENTS.md 3.2.1's raw
    // -element ban had therefore never fired, in any file, since it was
    // written - and nothing noticed, because `lint-rules.spec.ts` exercises
    // the *node* config and no suite ran the *next* one.
    //
    // Found 2026-09-30 by `apps/web/src/config/ui-primitive-rules.spec.ts`,
    // which asserts the ban actually fires before asserting the primitives
    // are exempt from it. `AUD-30-01` class: a rule that reads as enforced and
    // is not.
    //
    // The sets are now disjoint - .tsx gets both, .ts gets only the colour
    // rule - so neither can clobber the other. `B-1`.
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...RAW_ELEMENT_PATTERN, ...HARDCODED_COLOUR_PATTERN],
    },
  },
  {
    files: ['**/*.ts'],
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
    // B-1, 2026-09-30: the shadcn primitives are EXEMPT from the raw-element
    // ban, and from nothing else.
    //
    // The contradiction this resolves: the ban's own message tells a developer
    // to "use the shadcn/ui component from @eduflow/ui-kit", and a shadcn
    // component necessarily CONTAINS the raw element - `button.tsx` renders
    // `<button>`. Until the primitives existed, section 3.2.1 banned what did
    // not yet exist, so the first interactive screen could not be written. The
    // landing page shipped with no theme toggle for exactly this reason.
    // `FIX-11`.
    //
    // 3.2.1 says primitives must be shadcn; it does not say the raw element
    // ceases to exist somewhere. This is the only reading that can be
    // satisfied.
    //
    // Scoped NARROWLY, and the colour rule is re-declared rather than turned
    // off, because 3.2.5 must still hold inside a primitive - a component that
    // hard-codes a hex cannot work in both themes, and the primitives are
    // exactly where that mistake would land. Two globs are needed because this
    // config is shared between two working directories: `packages/ui-kit` when
    // it lints itself, and the repo root or `apps/web` otherwise. An exemption
    // anchored at only one of them passes locally and fails in CI.
    files: ['src/components/ui/**/*.tsx', '**/ui-kit/src/components/ui/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...HARDCODED_COLOUR_PATTERN],
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
