import { next } from '@eduflow/config/eslint/next';

/**
 * EduFlow web lint configuration.
 *
 * Inherits the load-bearing AGENTS.md 3.2 rules from
 * @eduflow/config/eslint/next:
 *   no raw <button>/<input>/<select>/<textarea>/<table>/<dialog>   3.2.1
 *   no hard-coded colour literals                                    3.2.5
 *
 * `eslint-config-next` is deliberately NOT used. It patches ESLint
 * internals and fails against ESLint 9.39 with "Failed to patch ESLint
 * because the calling module was not recognized". Its only unique
 * contribution here would be react-hooks rules, which are added in P3 once
 * there are hooks to check. The two rules above are the ones that would
 * actually have been violated by writing a screen today, and they work.
 *
 * PLT-1003 T4: the one script-scoped block. `scripts/visual-capture.mjs`
 * is a Node CLI whose only reason for living under apps/web is that
 * `@playwright/test` resolves here and nowhere else in the repository.
 * The shared config is browser-targeted, so without this block the script
 * failed lint on `console` and `process` — and the "fix" of sprinkling
 * disables through a gate would be exactly the inline-exemption habit
 * this repository's rules exist to prevent. The block is scoped to the
 * .mjs files under scripts/ and grants Node globals there and nowhere
 * else, following the same shape `apps/api/eslint.config.mjs` uses for
 * its prisma/ and erd/ generators.
 */
export default [
  ...next,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        // The visual-capture script drives a page through
        // `page.evaluate`, whose callback runs in the BROWSER, so the
        // document/window it touches are real there and absent in Node.
        // Declared for exactly this one script — nothing else under
        // apps/web runs browser code outside the src/ tree.
        document: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      // A generator reports what it wrote. `console.log` is the output.
      'no-console': 'off',
    },
  },
  { rules: {} },
];
