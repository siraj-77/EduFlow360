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
 */
export default [...next, { rules: {} }];
