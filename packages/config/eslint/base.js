import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * EduFlow — base ESLint configuration.
 *
 * Every rule here maps to a clause in AGENTS.md. A rule that is not
 * mechanically enforced is a suggestion (ARCHITECTURE.md section 17),
 * so each one carries its justification inline.
 */

/** @type {import('eslint').Linter.Config[]} */
export const base = tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // Setting `parserOptions` here REPLACES whatever
      // `tseslint.configs.recommended` set, rather than merging into it. With
      // the object empty, no JSX is produced, so every
      // `JSXElement[...]` selector in AGENTS.md 3.2.1's raw-element ban
      // matched nothing and the rule had never fired. Found 2026-09-30 by
      // `apps/web/src/config/ui-primitive-rules.spec.ts`; see `next.js` for
      // the matching overwrite bug in the rule blocks themselves.
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // AGENTS.md section 8: TypeScript strict everywhere, and an
      // unenforced convention is a suggestion.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // AGENTS.md section 8: no @ts-ignore / @ts-expect-error at all.
      // Fix the type. There is no exception and no escape comment.
      //
      // In typescript-eslint v8 these are booleans: `true` bans the form.
      // `ts-allow-without-description` and `ts-allow` were removed in v8,
      // so a plain ban is the whole policy.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // AGENTS.md section 8: "No bare catch {}" and never swallow errors.
      'no-empty': ['error', { allowEmptyCatch: false }],

      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
